import { useEffect, useState, useRef } from 'react';
import { StepTracker } from '../components/processing/StepTracker';
import { useEpisodeStore } from '../store/episodeStore';
import { Button } from '../components/ui/Button';
import { pollJobStatus } from '../lib/api';

export function AudioProcessingView() {
  const jobId = useEpisodeStore((state) => state.jobId);
  const steps = useEpisodeStore((state) => state.steps);
  const updateStep = useEpisodeStore((state) => state.updateStep);
  const setView = useEpisodeStore((state) => state.setView);
  const markStepComplete = useEpisodeStore((state) => state.markStepComplete);

  const [displayProgress, setDisplayProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Estimate 3 minutes (180s) for cleanup: stitch + denoise + silence
  const estimatedTotalSeconds = 180;

  // Poll for status
  useEffect(() => {
    if (!jobId) return;

    pollIntervalRef.current = setInterval(async () => {
      try {
        const status = await pollJobStatus(jobId);

        // Update steps
        status.steps.forEach((step) => {
          updateStep(step.id, step);
        });

        // Check if cleanup steps are complete
        const cleanupComplete = status.steps.every((s) =>
          ['stitch', 'noise', 'silence'].includes(s.id) ? s.status === 'complete' : true
        );

        if (cleanupComplete) {
          setIsComplete(true);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
        }
      } catch (error) {
        console.error('Poll error:', error);
      }
    }, 1000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [jobId, updateStep]);

  // Calculate actual progress
  const relevantSteps = steps.filter((s) =>
    ['stitch', 'noise', 'silence'].includes(s.id)
  );
  let actualProgress = 0;
  relevantSteps.forEach((step) => {
    if (step.status === 'complete') {
      actualProgress += 100 / relevantSteps.length;
    } else if (step.status === 'active') {
      actualProgress += (step.progressPercent / 100) * (100 / relevantSteps.length);
    }
  });
  actualProgress = Math.round(actualProgress);

  // Smoothly animate display progress towards actual progress
  useEffect(() => {
    if (displayProgress === actualProgress) return;

    progressIntervalRef.current = setInterval(() => {
      setDisplayProgress((prev) => {
        const diff = actualProgress - prev;
        if (Math.abs(diff) < 1) return actualProgress;
        return prev + Math.sign(diff);
      });
    }, 50);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [actualProgress, displayProgress]);

  // Timer for elapsed time
  useEffect(() => {
    if (isComplete) return;

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isComplete]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const estimatedRemaining = Math.max(0, estimatedTotalSeconds - elapsedSeconds);

  const handleNextSteps = () => {
    markStepComplete('audio');
    setView('dashboard');
  };

  if (isComplete) {
    const downloadUrl = `http://localhost:3001/jobs/${jobId}/files/silence-compressed.mp3`;

    return (
      <div className="flex flex-col items-center justify-center w-full py-8">
        <div className="w-full max-w-2xl mx-auto space-y-4">
          <div className="text-center">
            <h1 className="text-2xl font-heading font-semibold text-satsang-bark">
              ✅ Audio Processing Complete!
            </h1>
          </div>

          <div className="space-y-3 w-full">
            <a
              href={downloadUrl}
              download="processed-audio.mp3"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full px-6 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition text-center"
            >
              📥 Download Audio File
            </a>

            <Button
              onClick={handleNextSteps}
              variant="primary"
              size="md"
              className="w-full"
            >
              Next Steps →
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 py-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-3xl font-heading font-semibold text-satsang-bark mb-1">
          Processing Audio
        </h1>
        <p className="text-satsang-ash">
          Stitching, denoising, and compressing silence... 🎙️
        </p>
      </div>

      {/* Overall Progress Bar */}
      <div className="w-full max-w-2xl space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-satsang-bark">Progress</span>
          <span className="text-lg font-bold text-satsang-bark">{displayProgress}%</span>
        </div>
        <div className="w-full h-10 bg-satsang-parchment rounded-full overflow-hidden border-2 border-satsang-sandalwood">
          <div
            className="h-full bg-black transition-all duration-200 flex items-center justify-center"
            style={{ width: `${displayProgress}%` }}
          >
            {displayProgress > 10 && (
              <span className="text-sm font-bold text-white">{displayProgress}%</span>
            )}
          </div>
        </div>
      </div>

      {/* Time Remaining */}
      <div className="w-full max-w-2xl p-4 rounded-lg bg-satsang-parchment border-2 border-satsang-sandalwood text-center">
        <p className="text-xs text-satsang-ash mb-1 font-medium">Est. Time Remaining</p>
        <p className="text-3xl font-bold text-satsang-bark">{formatTime(estimatedRemaining)}</p>
      </div>

      {/* Step Details */}
      <StepTracker activePhase="cleanup" />
    </div>
  );
}
