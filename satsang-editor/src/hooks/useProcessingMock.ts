import { useEffect, useRef } from 'react';
import { useEpisodeStore } from '../store/episodeStore';
import type { EpisodeOutput } from '../types/episode';

export function useProcessingMock() {
  const updateStep = useEpisodeStore((state) => state.updateStep);
  const setOutput = useEpisodeStore((state) => state.setOutput);
  const setView = useEpisodeStore((state) => state.setView);

  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const stepIds = ['stitch', 'noise', 'silence', 'music', 'thumbnail'];
    let currentStepIndex = 0;

    const processNextStep = () => {
      if (currentStepIndex >= stepIds.length) {
        // All steps complete
        const mockAudio = new Blob(['mock audio data'], {
          type: 'audio/mpeg',
        });
        const mockAudioUrl = URL.createObjectURL(mockAudio);

        const mockImage = new Blob(['mock image data'], {
          type: 'image/png',
        });
        const mockImageUrl = URL.createObjectURL(mockImage);

        const output: EpisodeOutput = {
          finalAudioUrl: mockAudioUrl,
          thumbnailUrl: mockImageUrl,
          thumbnailAltText: 'Generated podcast thumbnail',
        };

        setOutput(output);
        setTimeout(() => setView('preview'), 500);
        return;
      }

      const stepId = stepIds[currentStepIndex];
      updateStep(stepId, { status: 'active', progressPercent: 0 });

      // Simulate progress
      const progressInterval = setInterval(() => {
        updateStep(stepId, {
          progressPercent: 95, // Will be overridden by animation
        });
      }, 200);

      intervalsRef.current.push(progressInterval);

      // Complete the step after 2 seconds
      const timeout = setTimeout(() => {
        clearInterval(progressInterval);
        updateStep(stepId, { status: 'complete', progressPercent: 100 });
        currentStepIndex++;
        processNextStep();
      }, 2000);

      timeoutsRef.current.push(timeout);
    };

    processNextStep();

    // Cleanup
    return () => {
      intervalsRef.current.forEach((interval) => clearInterval(interval));
      timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    };
  }, []);
}
