import { useEffect, useState, useRef } from 'react';
import { StepTracker } from '../components/processing/StepTracker';
import { useEpisodeStore } from '../store/episodeStore';
import { Button } from '../components/ui/Button';
import { runStepCleanup, runStepMixing, runStepThumbnail, pollJobStatus } from '../lib/api';

export function ProcessingView() {
  const processingStatus = useEpisodeStore((state) => state.processingStatus);
  const steps = useEpisodeStore((state) => state.steps);
  const jobId = useEpisodeStore((state) => state.jobId);
  const metadata = useEpisodeStore((state) => state.metadata);
  const setView = useEpisodeStore((state) => state.setView);
  const reset = useEpisodeStore((state) => state.reset);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showStepSelection, setShowStepSelection] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [activePhase, setActivePhase] = useState<'cleanup' | 'mixing' | 'thumbnail' | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const updateStep = useEpisodeStore((state) => state.updateStep);

  // Estimate time based on active phase
  const getEstimatedTime = () => {
    switch (activePhase) {
      case 'cleanup':
        return 180; // 3 minutes for stitch + denoise + silence
      case 'mixing':
        return 120; // 2 minutes for normalize + music mixing
      case 'thumbnail':
        return 30; // 30 seconds for thumbnail generation
      default:
        return 300; // 5 minutes default (all steps)
    }
  };

  const estimatedTotalSeconds = getEstimatedTime();

  // Poll for status when a step is running
  useEffect(() => {
    if (!isRunning || !jobId) return;

    console.log('Starting polling for job:', jobId);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const status = await pollJobStatus(jobId);
        console.log('Job status:', status.status, 'steps:', status.steps);

        // Update steps
        status.steps.forEach((step) => {
          updateStep(step.id, step);
        });

        // Check if phase is complete (all relevant steps are done)
        const phaseComplete = () => {
          if (activePhase === 'cleanup') {
            return status.steps.every(s => ['stitch', 'noise', 'silence'].includes(s.id) ? s.status === 'complete' : true);
          } else if (activePhase === 'mixing') {
            return status.steps.find(s => s.id === 'music')?.status === 'complete';
          } else if (activePhase === 'thumbnail') {
            return status.steps.find(s => s.id === 'thumbnail')?.status === 'complete';
          }
          return status.status === 'complete';
        };

        if (phaseComplete()) {
          console.log(`Step phase (${activePhase}) complete!`);
          setIsRunning(false);
          setShowStepSelection(true); // Show buttons again to pick next step
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        } else if (status.status === 'error') {
          console.error('Job error detected');
          setIsRunning(false);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      } catch (error) {
        console.error('Poll error:', error);
      }
    }, 1000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isRunning, jobId, updateStep]);

  // Log steps for debugging
  useEffect(() => {
    console.log('Processing view - steps:', steps.map(s => ({ id: s.id, status: s.status, progress: s.progressPercent })));
  }, [steps]);

  // Timer for elapsed time
  useEffect(() => {
    if (processingStatus !== 'processing') return;

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [processingStatus]);

  // Calculate overall progress - includes only relevant steps for active phase
  const getRelevantSteps = () => {
    if (!activePhase) return steps;
    if (activePhase === 'cleanup') {
      return steps.filter((s) => ['stitch', 'noise', 'silence'].includes(s.id));
    } else if (activePhase === 'mixing') {
      return steps.filter((s) => s.id === 'music');
    } else if (activePhase === 'thumbnail') {
      return steps.filter((s) => s.id === 'thumbnail');
    }
    return steps;
  };

  const relevantSteps = getRelevantSteps();
  const totalSteps = relevantSteps.length;
  let overallProgress = 0;

  relevantSteps.forEach((step) => {
    if (step.status === 'complete') {
      overallProgress += (100 / totalSteps);
    } else if (step.status === 'active') {
      overallProgress += (step.progressPercent / totalSteps);
    }
  });

  overallProgress = Math.round(overallProgress);

  console.log('Overall progress:', overallProgress, '% (completed:', relevantSteps.filter(s => s.status === 'complete').length, '/', totalSteps, ')');

  // Time formatting
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const estimatedRemaining = Math.max(0, estimatedTotalSeconds - elapsedSeconds);

  const handleReset = () => {
    reset();
    setView('landing');
  };

  const handleRunCleanup = async () => {
    if (!jobId) return;
    setShowStepSelection(false);
    setIsRunning(true);
    setActivePhase('cleanup');
    try {
      await runStepCleanup(jobId);
    } catch (error) {
      console.error('Error running cleanup:', error);
    }
  };

  const handleRunMixing = async () => {
    if (!jobId) return;
    setShowStepSelection(false);
    setIsRunning(true);
    setActivePhase('mixing');
    try {
      await runStepMixing(jobId);
    } catch (error) {
      console.error('Error running mixing:', error);
    }
  };

  const handleRunThumbnail = async () => {
    if (!jobId) return;
    setShowStepSelection(false);
    setIsRunning(true);
    setActivePhase('thumbnail');
    try {
      await runStepThumbnail(jobId, metadata.thumbnailPrompt);
    } catch (error) {
      console.error('Error running thumbnail:', error);
    }
  };

  // Show step selection if not running and user hasn't started yet
  if (showStepSelection && !isRunning) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-4 py-8">
        <div className="text-center max-w-2xl mb-4">
          <h1 className="text-4xl font-heading font-semibold text-satsang-bark mb-2">
            Choose Processing Steps
          </h1>
          <p className="text-satsang-ash text-lg">
            Select which steps to run for your episode
          </p>
        </div>

        <div className="max-w-2xl w-full space-y-4">
          {/* Step 1-3 Button */}
          <button
            onClick={handleRunCleanup}
            className="w-full p-6 rounded-lg bg-satsang-parchment border-2 border-satsang-sandalwood transition-all duration-200 hover:bg-satsang-sandalwood hover:shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
          >
            <h3 className="text-xl font-semibold text-satsang-bark mb-2">
              🎙️ Audio Cleanup (Steps 1-3)
            </h3>
            <p className="text-sm text-satsang-ash mb-4">
              Stitch files • Remove noise • Compress silence
            </p>
            <div className="font-bold text-satsang-saffron bg-white rounded px-4 py-2 inline-block">
              Run Audio Cleanup →
            </div>
          </button>

          {/* Step 4 Button */}
          <button
            onClick={handleRunMixing}
            className="w-full p-6 rounded-lg bg-satsang-parchment border-2 border-satsang-sandalwood transition-all duration-200 hover:bg-satsang-sandalwood hover:shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
          >
            <h3 className="text-xl font-semibold text-satsang-bark mb-2">
              🎵 Audio Mixing (Step 4)
            </h3>
            <p className="text-sm text-satsang-ash mb-4">
              Normalize audio • Mix background music
            </p>
            <div className="font-bold text-satsang-saffron bg-white rounded px-4 py-2 inline-block">
              Run Audio Mixing →
            </div>
          </button>

          {/* Step 5 Button */}
          <button
            onClick={handleRunThumbnail}
            className="w-full p-6 rounded-lg bg-satsang-parchment border-2 border-satsang-sandalwood transition-all duration-200 hover:bg-satsang-sandalwood hover:shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
          >
            <h3 className="text-xl font-semibold text-satsang-bark mb-2">
              🖼️ Generate Thumbnail (Step 5)
            </h3>
            <p className="text-sm text-satsang-ash mb-4">
              Create AI-generated podcast cover art
            </p>
            <div className="font-bold text-satsang-saffron bg-white rounded px-4 py-2 inline-block">
              Run Thumbnail Generation →
            </div>
          </button>

          <Button
            onClick={handleReset}
            variant="outlined"
            size="md"
            className="w-full mt-6"
          >
            ← Back to Upload
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-4 py-8">
      {/* Header */}
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl font-heading font-semibold text-satsang-bark mb-2">
          Processing Your Episode
        </h1>
        <p className="text-satsang-ash text-lg">
          Transforming your audio now... 🎙️
        </p>
      </div>

      {/* Overall Progress Bar */}
      <div className="w-full max-w-2xl space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-satsang-bark">Overall Progress</span>
          <span className="text-lg font-bold text-satsang-saffron">{overallProgress}%</span>
        </div>
        <div className="w-full h-6 bg-satsang-parchment rounded-full overflow-hidden border-2 border-satsang-sandalwood">
          <div
            className="h-full bg-gradient-to-r from-satsang-turmeric to-satsang-saffron transition-all duration-300 flex items-center justify-center"
            style={{ width: `${overallProgress}%` }}
          >
            {overallProgress > 10 && (
              <span className="text-xs font-bold text-white">{overallProgress}%</span>
            )}
          </div>
        </div>
      </div>

      {/* Time Estimate */}
      <div className="w-full max-w-2xl grid grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-satsang-parchment border-2 border-satsang-sandalwood">
          <p className="text-xs text-satsang-ash mb-1 font-medium">Elapsed</p>
          <p className="text-2xl font-bold text-satsang-bark">{formatTime(elapsedSeconds)}</p>
        </div>
        <div className="p-4 rounded-lg bg-satsang-parchment border-2 border-satsang-sandalwood">
          <p className="text-xs text-satsang-ash mb-1 font-medium">Est. Remaining</p>
          <p className="text-2xl font-bold text-satsang-bark">{formatTime(estimatedRemaining)}</p>
        </div>
      </div>

      {/* Step Details (no spinner) */}
      <StepTracker activePhase={activePhase} />

      {/* Error State */}
      {processingStatus === 'error' && (
        <div className="mt-8 p-6 bg-red-100 border-2 border-red-400 rounded-lg text-red-700 text-center max-w-md">
          <p className="font-bold text-lg mb-3">⚠️ Processing Failed</p>
          <p className="text-sm mb-4">Check browser console (F12) for error details.</p>
          <Button onClick={handleReset} variant="outlined" size="md">
            ← Back to Upload
          </Button>
        </div>
      )}

      {/* Success State - Show when a phase completes */}
      {!isRunning && showStepSelection && (
        <div className="mt-8 p-6 bg-green-100 border-2 border-green-400 rounded-lg text-green-700 text-center max-w-md">
          <p className="font-bold text-lg mb-4">✅ Phase Complete!</p>
          <p className="text-sm mb-4">You can run more steps or view your results.</p>
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => setShowStepSelection(true)}
              variant="primary"
              size="md"
              className="w-full"
            >
              Run Another Step
            </Button>
            <Button
              onClick={() => setView('preview')}
              variant="outlined"
              size="md"
              className="w-full"
            >
              View All Results →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
