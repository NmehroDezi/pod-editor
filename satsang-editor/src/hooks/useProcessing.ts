import { useEffect, useRef } from 'react';
import { useEpisodeStore } from '../store/episodeStore';
import { submitJob, pollJobStatus, getAudioUrl, getThumbnailUrl } from '../lib/api';

export function useProcessing() {
  const files = useEpisodeStore((state) => state.files);
  const metadata = useEpisodeStore((state) => state.metadata);
  const jobId = useEpisodeStore((state) => state.jobId);
  const setJobId = useEpisodeStore((state) => state.setJobId);
  const updateStep = useEpisodeStore((state) => state.updateStep);
  const setOutput = useEpisodeStore((state) => state.setOutput);
  const setView = useEpisodeStore((state) => state.setView);

  const hasSubmittedRef = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Step 1: Submit job if not yet submitted
    if (!hasSubmittedRef.current && !jobId) {
      hasSubmittedRef.current = true;
      
      (async () => {
        try {
          console.log('Submitting job with', files.length, 'files');
          const newJobId = await submitJob(
            files.map((f) => f.file),
            metadata
          );
          console.log('Job submitted:', newJobId);
          setJobId(newJobId);
        } catch (error) {
          console.error('Failed to submit job:', error);
          hasSubmittedRef.current = false;
        }
      })();
    }
  }, []); // Only on mount

  useEffect(() => {
    // Step 2: Start polling once we have a jobId
    if (jobId && !pollIntervalRef.current) {
      console.log('Starting to poll job:', jobId);
      
      pollIntervalRef.current = setInterval(async () => {
        try {
          const status = await pollJobStatus(jobId);
          console.log('Job status:', status.status);

          // Update each step with latest status
          status.steps.forEach((step) => {
            updateStep(step.id, step);
          });

          // When complete, fetch output URLs and transition to preview
          if (status.status === 'complete') {
            console.log('Job complete! Transitioning to preview...');
            
            setOutput({
              finalAudioUrl: getAudioUrl(jobId),
              thumbnailUrl: getThumbnailUrl(jobId),
              thumbnailAltText: 'Generated podcast thumbnail',
            });

            // Stop polling
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }

            // Transition to preview
            setTimeout(() => {
              setView('preview');
            }, 500);
          }
        } catch (error) {
          console.error('Poll error:', error);
        }
      }, 1000); // Poll every 1 second
    }

    // Cleanup
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [jobId, updateStep, setOutput, setView]);
}
