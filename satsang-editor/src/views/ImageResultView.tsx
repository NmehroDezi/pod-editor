import { useEffect, useState, useRef } from 'react';
import { useEpisodeStore } from '../store/episodeStore';
import { Button } from '../components/ui/Button';
import { pollJobStatus, runStepThumbnail } from '../lib/api';

export function ImageResultView() {
  const jobId = useEpisodeStore((state) => state.jobId);
  const metadata = useEpisodeStore((state) => state.metadata);
  const generatedImages = useEpisodeStore((state) => state.generatedImages);
  const addGeneratedImage = useEpisodeStore((state) => state.addGeneratedImage);
  const setView = useEpisodeStore((state) => state.setView);
  const markStepComplete = useEpisodeStore((state) => state.markStepComplete);

  const [displayProgress, setDisplayProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start thumbnail generation on mount
  useEffect(() => {
    if (!jobId || hasStarted) return;

    setHasStarted(true);
    runStepThumbnail(jobId, metadata.thumbnailPrompt).catch((err) => {
      console.error('Error starting thumbnail generation:', err);
      setIsGenerating(false);
    });
  }, [jobId, hasStarted, metadata.thumbnailPrompt]);

  // Poll for thumbnail generation
  useEffect(() => {
    if (!jobId || !isGenerating) return;

    pollIntervalRef.current = setInterval(async () => {
      try {
        const status = await pollJobStatus(jobId);

        // Update progress
        const thumbnailStep = status.steps.find((s) => s.id === 'thumbnail');
        if (thumbnailStep) {
          setDisplayProgress(thumbnailStep.progressPercent);

          if (thumbnailStep.status === 'complete' && isGenerating) {
            const thumbnailUrl = `http://localhost:3001/jobs/${jobId}/thumbnail`;
            addGeneratedImage(thumbnailUrl);
            setIsGenerating(false);
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }
          }
        }
      } catch (error) {
        console.error('Poll error:', error);
      }
    }, 1000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [jobId, isGenerating, addGeneratedImage]);

  const handleNextSteps = () => {
    markStepComplete('image');
    setView('dashboard');
  };

  const handleRegenerateImage = () => {
    if (jobId) {
      setIsGenerating(true);
      setDisplayProgress(0);
      runStepThumbnail(jobId, metadata.thumbnailPrompt).catch((err) => {
        console.error('Error regenerating image:', err);
        setIsGenerating(false);
      });
    }
  };

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 py-4">
        <div className="text-center max-w-2xl">
          <h1 className="text-3xl font-heading font-semibold text-satsang-bark mb-1">
            Generating Cover Image
          </h1>
          <p className="text-satsang-ash">
            Creating artwork from your prompt... 🖼️
          </p>
        </div>

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
      </div>
    );
  }

  const latestImage = generatedImages[generatedImages.length - 1];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 py-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-3xl font-heading font-semibold text-satsang-bark mb-1">
          ✅ Cover Image Created!
        </h1>
        <p className="text-satsang-ash">
          Your podcast cover is ready
        </p>
      </div>

      <div className="max-w-2xl w-full space-y-6">
        {latestImage && (
          <div className="rounded-lg overflow-hidden border-2 border-satsang-sandalwood">
            <img
              src={latestImage}
              alt="Generated cover"
              className="w-full h-auto"
            />
          </div>
        )}

        <div className="space-y-3">
          <a
            href={latestImage}
            download={`cover-${jobId}.png`}
            className="block text-center px-6 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600"
          >
            📥 Download Image
          </a>

          <Button
            onClick={handleRegenerateImage}
            variant="outlined"
            size="md"
            className="w-full"
          >
            ✨ Generate Another
          </Button>
        </div>

        {generatedImages.length > 1 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-satsang-bark">Previous Generations</p>
            <div className="grid grid-cols-3 gap-3">
              {generatedImages.slice(0, -1).map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    // Switch to this image
                  }}
                  className="rounded border-2 border-satsang-sandalwood hover:border-satsang-saffron overflow-hidden"
                >
                  <img src={img} alt={`Generation ${idx + 1}`} className="w-full h-auto" />
                </button>
              ))}
            </div>
          </div>
        )}

        <Button
          onClick={handleNextSteps}
          variant="primary"
          size="md"
          className="w-full"
        >
          Next Steps →
        </Button>

        <Button
          onClick={() => setView('dashboard')}
          variant="outlined"
          size="md"
          className="w-full"
        >
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
