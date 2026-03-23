import { useEffect, useState, useRef } from 'react';
import { useEpisodeStore } from '../store/episodeStore';
import { Check } from 'lucide-react';
import { DropZone } from '../components/upload/DropZone';
import { FileList } from '../components/upload/FileList';
import { StepTracker } from '../components/processing/StepTracker';
import { ProcessingSpinner } from '../components/processing/ProcessingSpinner';
import { pollJobStatus, runStepCleanup, runStepMixing, runStepFadeout, runStepDescription, getMusicOptions } from '../lib/api';
import type { MusicTrack } from '../types/episode';

export function DashboardView() {
  const projectTitle = useEpisodeStore((state) => state.projectTitle);
  const setProjectTitle = useEpisodeStore((state) => state.setProjectTitle);
  const activeStep = useEpisodeStore((state) => state.activeStep);
  const setActiveStep = useEpisodeStore((state) => state.setActiveStep);
  const completedSteps = useEpisodeStore((state) => state.completedSteps);
  const markStepComplete = useEpisodeStore((state) => state.markStepComplete);
  const uncompleteSteps = useEpisodeStore((state) => state.uncompleteSteps);
  const completeProject = useEpisodeStore((state) => state.completeProject);

  const files = useEpisodeStore((state) => state.files);
  const addFiles = useEpisodeStore((state) => state.addFiles);
  const removeFile = useEpisodeStore((state) => state.removeFile);
  const metadata = useEpisodeStore((state) => state.metadata);
  const setMetadata = useEpisodeStore((state) => state.setMetadata);

  const jobId = useEpisodeStore((state) => state.jobId);
  const steps = useEpisodeStore((state) => state.steps);
  const updateStep = useEpisodeStore((state) => state.updateStep);
  const startProcessing = useEpisodeStore((state) => state.startProcessing);
  const resetForNewProject = useEpisodeStore((state) => state.resetForNewProject);

  const selectedMusicTrack = useEpisodeStore((state) => state.selectedMusicTrack);
  const setSelectedMusicTrack = useEpisodeStore((state) => state.setSelectedMusicTrack);
  const generatedImages = useEpisodeStore((state) => state.generatedImages);
  const addGeneratedImage = useEpisodeStore((state) => state.addGeneratedImage);

  // LOCAL STATE - not saved to store until button pressed
  const [titleInput, setTitleInput] = useState('');
  const [audioTitle, setAudioTitle] = useState('');
  const [audioDescription, setAudioDescription] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [musicLibrary, setMusicLibrary] = useState<MusicTrack[]>([]);
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoStartFadeoutRef = useRef(false);

  // Processing state for inline display
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessComplete, setIsProcessComplete] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isAudioComplete = completedSteps.includes('audio');
  const isMusicComplete = completedSteps.includes('music');
  const isFadeoutComplete = completedSteps.includes('fadeout');
  const isDescriptionComplete = completedSteps.includes('description');
  const allComplete = isAudioComplete && isMusicComplete && isDescriptionComplete;

  // Debug logging
  console.log('🔍 Dashboard render - completedSteps:', completedSteps, 'isMusicComplete:', isMusicComplete);

  // Check if music step was completed in backend (for bug fix - ensure Done button always appears)
  // This uses the store's step status, not the poll, so it works even after polling stops
  const musicStepDone = steps.find((s) => s.id === 'music')?.status === 'complete' || isProcessComplete;

  // Load music options on mount
  useEffect(() => {
    const fetchMusicOptions = async () => {
      try {
        const options = await getMusicOptions();
        setMusicLibrary(options);
      } catch (err) {
        console.error('Failed to load music options:', err);
      }
    };

    fetchMusicOptions();
  }, []);

  // Poll for job status
  useEffect(() => {
    if (!jobId || (!isProcessing && activeStep === null)) {
      console.log('Poll effect skipped - jobId:', jobId, 'isProcessing:', isProcessing, 'activeStep:', activeStep);
      return;
    }

    console.log('Starting poll for jobId:', jobId);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const status = await pollJobStatus(jobId);
        console.log('Poll result:', status);

        // Log music progress for visibility
        if (activeStep === 'music') {
          const musicStep = status.steps.find((s: any) => s.id === 'music');
          if (musicStep?.status === 'active') {
            console.log(`🎵 Music mixing: ${musicStep.progressPercent}%`);
          }
        }

        // Update steps
        status.steps.forEach((step) => {
          updateStep(step.id, step);
        });

        // Check if current step is complete based on activeStep
        let stepComplete = false;
        if (activeStep === 'audio') {
          const audioSteps = status.steps.filter((s) => ['stitch', 'noise', 'silence'].includes(s.id));
          stepComplete = audioSteps.every((s) => s.status === 'complete');
        } else if (activeStep === 'music') {
          stepComplete = status.steps.find((s) => s.id === 'music')?.status === 'complete';
          console.log('Music step complete check:', stepComplete);
          // Mark music as complete in store when backend finishes
          if (stepComplete && !isMusicComplete) {
            console.log('Marking music step complete in store');
            markStepComplete('music');
          }
        } else if (activeStep === 'fadeout') {
          stepComplete = status.steps.find((s) => s.id === 'fadeout')?.status === 'complete';
        } else if (activeStep === 'description') {
          stepComplete = status.steps.find((s) => s.id === 'description')?.status === 'complete';
          console.log('Description step complete check:', stepComplete);
          // Mark description as complete in store when backend finishes
          if (stepComplete && !isDescriptionComplete) {
            console.log('Marking description step complete in store');
            markStepComplete('description');
          }
        }

        if (stepComplete) {
          console.log('Step complete!');
          // If description step completed, fetch the generated description
          if (activeStep === 'description' && jobId) {
            try {
              const descriptionUrl = `http://localhost:3001/jobs/${jobId}/files/description.txt`;
              const response = await fetch(descriptionUrl);
              if (response.ok) {
                const descriptionText = await response.text();
                console.log('Fetched description:', descriptionText);
                addGeneratedImage(descriptionText);
              } else {
                console.error('Failed to fetch description:', response.statusText);
              }
            } catch (err) {
              console.error('Failed to add generated image:', err);
            }
          }
          setIsProcessing(false);
          setIsProcessComplete(true);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
        } else if (!isProcessing && !isProcessComplete && activeStep === 'music') {
          // If we stopped processing but music step is complete in backend, still mark it
          const musicComplete = status.steps.find((s) => s.id === 'music')?.status === 'complete';
          if (musicComplete) {
            console.log('Music complete detected after polling stopped, marking complete');
            setIsProcessComplete(true);
          }
        }
      } catch (error) {
        console.error('Poll error:', error);
      }
    }, 1000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [jobId, isProcessing, activeStep, updateStep]);

  // Calculate progress based on active step
  let actualProgress = 0;
  if (activeStep === 'audio') {
    const audioSteps = steps.filter((s) => ['stitch', 'noise', 'silence'].includes(s.id));
    console.log('Audio steps:', audioSteps);
    audioSteps.forEach((step) => {
      if (step.status === 'complete') {
        actualProgress += 100 / audioSteps.length;
      } else if (step.status === 'active') {
        actualProgress += (step.progressPercent / 100) * (100 / audioSteps.length);
      } else if (step.status === 'pending') {
        // Show minimal progress for pending steps so user sees something is happening
        actualProgress += 1 / audioSteps.length;
      }
    });
    actualProgress = Math.round(actualProgress);
    console.log('Actual progress:', actualProgress);
  } else if (activeStep === 'music') {
    const musicStep = steps.find((s) => s.id === 'music');
    if (musicStep?.status === 'complete') {
      actualProgress = 100;
    } else if (musicStep?.status === 'active') {
      actualProgress = musicStep.progressPercent;
    }
  } else if (activeStep === 'fadeout') {
    const fadeoutStep = steps.find((s) => s.id === 'fadeout');
    if (fadeoutStep?.status === 'complete') {
      actualProgress = 100;
    } else if (fadeoutStep?.status === 'active') {
      actualProgress = fadeoutStep.progressPercent;
    } else if (fadeoutStep?.status === 'pending') {
      actualProgress = 5; // Show minimal progress for pending state
    }
  } else if (activeStep === 'description') {
    const descriptionStep = steps.find((s) => s.id === 'description');
    if (descriptionStep?.status === 'complete') {
      actualProgress = 100;
    } else if (descriptionStep?.status === 'active') {
      actualProgress = descriptionStep.progressPercent;
    } else if (descriptionStep?.status === 'pending') {
      actualProgress = 5; // Show minimal progress for pending state
    }
  }

  // Animate progress bar
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
    if (!isProcessing || isProcessComplete) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isProcessing, isProcessComplete]);

  // Auto-start fadeout when music is complete
  useEffect(() => {
    if (isProcessComplete && activeStep === 'music' && !isProcessing && isMusicComplete && !autoStartFadeoutRef.current) {
      console.log('Auto-starting fadeout after music complete');
      autoStartFadeoutRef.current = true;
      handleStartFadeout();
    }
  }, [isProcessComplete, activeStep, isProcessing, isMusicComplete]);

  const clearAllIntervals = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Estimated time in seconds for each step
  const estimatedAudioSeconds = 180; // 3 minutes for audio processing
  const estimatedMusicSeconds = 120; // 2 minutes for music mixing
  const estimatedFadeoutSeconds = 30; // 30 seconds for fade out effect
  const estimatedImageSeconds = 60; // 1 minute for image generation

  let estimatedRemaining = 0;
  if (activeStep === 'audio') {
    estimatedRemaining = Math.max(0, estimatedAudioSeconds - elapsedSeconds);
  } else if (activeStep === 'music') {
    estimatedRemaining = Math.max(0, estimatedMusicSeconds - elapsedSeconds);
  } else if (activeStep === 'fadeout') {
    estimatedRemaining = Math.max(0, estimatedFadeoutSeconds - elapsedSeconds);
  } else if (activeStep === 'description') {
    estimatedRemaining = Math.max(0, estimatedImageSeconds - elapsedSeconds);
  }

  const handleStartAudio = async () => {
    if (files.length === 0) {
      alert('Please upload at least one audio file');
      return;
    }
    console.log('Starting audio processing...');
    // Save metadata to store ONLY when button is pressed
    setMetadata({
      title: audioTitle,
      description: audioDescription,
      thumbnailPrompt: metadata.thumbnailPrompt,
    });
    setActiveStep('audio');
    setIsProcessing(true);
    setIsProcessComplete(false);
    setDisplayProgress(0);
    setElapsedSeconds(0);
    try {
      const newJobId = await startProcessing();
      console.log('Job submitted successfully:', newJobId);
    } catch (error) {
      console.error('Error starting processing:', error);
    }
  };

  const handleCancelAudio = () => {
    clearAllIntervals();
    setIsProcessing(false);
    setIsProcessComplete(false);
    setDisplayProgress(0);
    setElapsedSeconds(0);
  };

  const handleCancelMusic = () => {
    clearAllIntervals();
    autoStartFadeoutRef.current = false;
    setIsProcessing(false);
    setIsProcessComplete(false);
    setDisplayProgress(0);
    setElapsedSeconds(0);
    uncompleteSteps(['music', 'fadeout']);
  };

  const handleRedoMusic = () => {
    clearAllIntervals();
    autoStartFadeoutRef.current = false;
    uncompleteSteps(['music', 'fadeout']);
    setIsProcessing(false);
    setIsProcessComplete(false);
    setDisplayProgress(0);
    setElapsedSeconds(0);
    setActiveStep('music');
  };

  const handleAudioComplete = () => {
    autoStartFadeoutRef.current = false;  // Reset for next project
    markStepComplete('audio');
    setActiveStep(null);
    setIsProcessing(false);
    setIsProcessComplete(false);
    setDisplayProgress(0);
    setAudioTitle('');
    setAudioDescription('');
  };

  const handleMusicComplete = () => {
    console.log('handleMusicComplete called');
    markStepComplete('music');
    console.log('Music step marked complete, completedSteps now includes:', useEpisodeStore.getState().completedSteps);
    setActiveStep(null);
    setIsProcessing(false);
    setIsProcessComplete(false);
    setDisplayProgress(0);
    console.log('Music step UI reset, should show dashboard now');
  };

  const handleStartFadeout = async () => {
    setActiveStep('fadeout');
    setIsProcessing(true);
    setIsProcessComplete(false);
    setDisplayProgress(0);
    setElapsedSeconds(0);
    try {
      await runStepFadeout(jobId || '');
    } catch (error) {
      console.error('Error starting fadeout:', error);
      alert('Failed to start fadeout effect');
    }
  };

  const handleFadeoutComplete = () => {
    markStepComplete('fadeout');
    markStepComplete('music');  // Mark music as complete when fadeout is done
    setActiveStep(null);
    setIsProcessing(false);
    setIsProcessComplete(false);
    setDisplayProgress(0);
  };

  const handleStartImage = async () => {
    if (!imagePrompt.trim()) {
      alert('Please enter a description of your podcast');
      return;
    }
    // Save metadata ONLY when button is pressed
    setMetadata({
      title: metadata.title,
      description: imagePrompt,
      thumbnailPrompt: '',
    });
    setActiveStep('description');
    setIsProcessing(true);
    setIsProcessComplete(false);
    setDisplayProgress(0);
    setElapsedSeconds(0);
    try {
      await runStepDescription(jobId || '', imagePrompt);
    } catch (error) {
      console.error('Error starting description optimization:', error);
      alert('Failed to optimize description');
    }
  };

  const handleImageComplete = () => {
    markStepComplete('description');
    setActiveStep(null);
    setIsProcessing(false);
    setIsProcessComplete(false);
    setDisplayProgress(0);
    setImagePrompt('');
  };

  const handleProjectComplete = () => {
    autoStartFadeoutRef.current = false;  // Reset for next project
    completeProject();
    setTitleInput('');
  };

  const handleMusicPreview = (trackId: string, filename: string) => {
    // If clicking the same track, toggle play/pause
    if (previewTrackId === trackId && audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play().catch((err) => console.error('Play failed:', err));
        setIsPreviewPlaying(true);
      } else {
        audioRef.current.pause();
        setIsPreviewPlaying(false);
      }
      return;
    }

    // Different track - stop current and play new one
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      setIsPreviewPlaying(false);
    }

    setPreviewTrackId(trackId);
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const audioUrl = `${API_BASE}/music-preview/${encodeURIComponent(filename)}`;

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.addEventListener('play', () => setIsPreviewPlaying(true));
      audioRef.current.addEventListener('pause', () => setIsPreviewPlaying(false));
      audioRef.current.addEventListener('ended', () => setIsPreviewPlaying(false));
    }

    audioRef.current.src = audioUrl;
    audioRef.current.play().catch((err) => {
      console.error('Preview play failed:', err);
      alert('Could not play audio preview. Check browser console.');
    });
    setIsPreviewPlaying(true);
  };

  // Project title screen
  if (!projectTitle.trim()) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 py-8 bg-satsang-cream">
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl font-heading font-semibold text-satsang-bark mb-4">
            Create Your Podcast Episode
          </h1>
          <p className="text-satsang-ash text-lg mb-8">
            Let's start with a project name
          </p>
        </div>

        <div className="max-w-2xl w-full space-y-4">
          <input
            type="text"
            placeholder="Enter your project title..."
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            className="w-full px-6 py-4 rounded-lg border-2 border-satsang-sandalwood bg-white text-satsang-bark placeholder-satsang-ash focus:outline-none focus:border-satsang-saffron"
          />
          <button
            onClick={() => {
              if (titleInput.trim()) {
                // Reset all progress FIRST to clear any persisted state
                resetForNewProject();
                // Then set the new project title which triggers re-render
                setTimeout(() => {
                  setProjectTitle(titleInput);
                }, 0);
              }
            }}
            className="w-full px-6 py-4 bg-satsang-saffron text-black font-bold rounded-lg hover:bg-satsang-turmeric transition cursor-pointer"
          >
            Start Project →
          </button>
        </div>
      </div>
    );
  }

  // Main dashboard with 3 horizontal buttons and inline content
  return (
    <div className="min-h-screen bg-satsang-cream flex flex-col">
      {/* Header */}
      <div className="bg-white border-b-2 border-satsang-sandalwood px-6 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-heading font-semibold text-satsang-bark mb-4">
            {projectTitle}
          </h1>

          {/* 3-Segment Progress Bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 rounded-full overflow-hidden bg-satsang-parchment border border-satsang-sandalwood">
              <div
                className={`h-full transition-all ${
                  isAudioComplete ? 'w-full bg-green-500' : 'w-0 bg-satsang-saffron'
                }`}
              />
            </div>
            <div className="flex-1 h-3 rounded-full overflow-hidden bg-satsang-parchment border border-satsang-sandalwood">
              <div
                className={`h-full transition-all ${
                  isMusicComplete ? 'w-full bg-green-500' : 'w-0 bg-satsang-saffron'
                }`}
              />
            </div>
            <div className="flex-1 h-3 rounded-full overflow-hidden bg-satsang-parchment border border-satsang-sandalwood">
              <div
                className={`h-full transition-all ${
                  isDescriptionComplete ? 'w-full bg-green-500' : 'w-0 bg-satsang-saffron'
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Step Buttons Row */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {/* Audio Button */}
            <button
              onClick={() => {
                if (isAudioComplete) return; // Don't allow clicking completed steps
                if (activeStep === 'audio') {
                  setActiveStep(null);
                } else if (!isAudioComplete) {
                  setActiveStep('audio');
                }
              }}
              disabled={isAudioComplete}
              className={`p-4 rounded-lg border-2 transition-all ${
                isAudioComplete
                  ? 'cursor-not-allowed bg-green-100 border-green-500 text-green-800'
                  : activeStep === 'audio'
                  ? 'cursor-pointer bg-satsang-saffron border-satsang-saffron text-white'
                  : 'cursor-pointer bg-satsang-parchment border-satsang-sandalwood text-satsang-bark hover:bg-satsang-sandalwood hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-lg">🎙️ Audio Setup</h3>
                {isAudioComplete && <Check className="w-5 h-5" />}
              </div>
              <p className="text-sm opacity-90">Upload & process audio</p>
            </button>

            {/* Music Button */}
            <div className="relative">
              <button
                onClick={() => {
                  if (isMusicComplete) return; // Don't allow clicking completed steps
                  if (activeStep === 'music') {
                    setActiveStep(null);
                  } else if (!isMusicComplete && isAudioComplete) {
                    setActiveStep('music');
                  }
                }}
                disabled={(!isAudioComplete && !isMusicComplete) || isMusicComplete}
                className={`w-full p-4 rounded-lg border-2 transition-all ${
                  isMusicComplete
                    ? 'cursor-not-allowed bg-green-100 border-green-500 text-green-800'
                    : !isAudioComplete && !isMusicComplete
                    ? 'cursor-not-allowed opacity-50'
                    : activeStep === 'music'
                    ? 'cursor-pointer bg-satsang-saffron border-satsang-saffron text-white'
                    : 'cursor-pointer bg-satsang-parchment border-satsang-sandalwood text-satsang-bark hover:bg-satsang-sandalwood hover:shadow-md'
                }`}
              >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-lg">🎵 Add Music</h3>
                {isMusicComplete && <Check className="w-5 h-5" />}
              </div>
              <p className="text-sm opacity-90">Choose background music</p>
              </button>

              {isMusicComplete && !activeStep && (
                <button
                  onClick={handleRedoMusic}
                  className="absolute top-2 right-8 text-xs text-satsang-ash underline hover:text-satsang-bark"
                >
                  Redo
                </button>
              )}
            </div>

            {/* Image Button */}
            <button
              onClick={() => {
                if (isDescriptionComplete) return; // Don't allow clicking completed steps
                if (activeStep === 'description') {
                  setActiveStep(null);
                } else if (!isDescriptionComplete && (isMusicComplete || isFadeoutComplete)) {
                  setActiveStep('description');
                }
              }}
              disabled={(!isMusicComplete && !isFadeoutComplete && !isDescriptionComplete) || isDescriptionComplete}
              className={`p-4 rounded-lg border-2 transition-all ${
                isDescriptionComplete
                  ? 'cursor-not-allowed bg-green-100 border-green-500 text-green-800'
                  : !isMusicComplete && !isFadeoutComplete && !isDescriptionComplete
                  ? 'cursor-not-allowed opacity-50'
                  : activeStep === 'description'
                  ? 'cursor-pointer bg-satsang-saffron border-satsang-saffron text-white'
                  : 'cursor-pointer bg-satsang-parchment border-satsang-sandalwood text-satsang-bark hover:bg-satsang-sandalwood hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-lg">📝 Description</h3>
                {isDescriptionComplete && <Check className="w-5 h-5" />}
              </div>
              <p className="text-sm opacity-90">Optimize for Spotify</p>
            </button>
          </div>

          {/* AUDIO STEP CONTENT */}
          {activeStep === 'audio' && (
            <div className="bg-white rounded-lg p-8 border-2 border-satsang-sandalwood mb-8">
              {!isProcessing && !isProcessComplete ? (
                <div className="space-y-6">
                  <h2 className="text-2xl font-semibold text-satsang-bark">Upload Audio Files</h2>

                  <DropZone onFilesSelected={addFiles} />

                  {files.length > 0 && (
                    <>
                      <FileList files={files} onRemove={removeFile} />

                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Episode title..."
                          value={audioTitle}
                          onChange={(e) => setAudioTitle(e.target.value)}
                          className="w-full px-4 py-2 rounded border border-satsang-sandalwood"
                        />
                        <textarea
                          placeholder="Episode description..."
                          value={audioDescription}
                          onChange={(e) => setAudioDescription(e.target.value)}
                          className="w-full px-4 py-2 rounded border border-satsang-sandalwood"
                          rows={3}
                        />
                      </div>

                      <button
                        onClick={handleStartAudio}
                        className="w-full px-6 py-3 bg-satsang-saffron text-black font-bold rounded-lg hover:bg-satsang-turmeric transition cursor-pointer"
                      >
                        Process Audio →
                      </button>
                    </>
                  )}
                </div>
              ) : isProcessing && !isProcessComplete ? (
                <div className="space-y-6">
                  <h2 className="text-2xl font-semibold text-satsang-bark">Processing Audio...</h2>

                  <div className="space-y-3">
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

                  <StepTracker activePhase="cleanup" />

                  <button
                    onClick={handleCancelAudio}
                    className="w-full px-6 py-3 border-2 border-satsang-sandalwood text-satsang-bark font-semibold rounded-lg hover:bg-satsang-parchment transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : isProcessComplete ? (
                <div className="space-y-4 text-center">
                  <h2 className="text-2xl font-semibold text-satsang-bark">✅ Audio Ready!</h2>
                  <a
                    href={`http://localhost:3001/jobs/${jobId}/files/silence-compressed.mp3`}
                    download="audio.mp3"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-6 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition"
                  >
                    📥 Download Audio
                  </a>
                  <button
                    onClick={handleAudioComplete}
                    className="w-full px-6 py-3 bg-satsang-saffron text-black font-bold rounded-lg hover:bg-satsang-turmeric transition cursor-pointer"
                  >
                    Done →
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* MUSIC STEP CONTENT */}
          {activeStep === 'music' && (
            <div className="bg-white rounded-lg p-8 border-2 border-satsang-sandalwood mb-8">
              <h2 className="text-2xl font-semibold text-satsang-bark mb-6">Choose Background Music</h2>

              {!isProcessing && !isProcessComplete ? (
                <div className="space-y-4">
                  {/* Real Music Library */}
                  <div className="space-y-3">
                    {musicLibrary
                      .map((track) => (
                        <div
                          key={track.id}
                          className={`flex items-center gap-3 p-4 rounded border-2 transition-all ${
                            selectedMusicTrack?.id === track.id
                              ? 'border-green-500 bg-green-50'
                              : 'border-satsang-sandalwood hover:bg-satsang-parchment'
                          }`}
                        >
                          <button
                            onClick={() => handleMusicPreview(track.id, track.filename)}
                            className="flex-shrink-0 w-10 h-10 rounded-full bg-satsang-saffron text-black font-bold hover:bg-satsang-turmeric transition flex items-center justify-center"
                          >
                            {previewTrackId === track.id && isPreviewPlaying ? '⏸' : '▶'}
                          </button>
                          <button
                            onClick={async () => {
                              setSelectedMusicTrack(track);
                              try {
                                await runStepMixing(jobId || '', track.filename);
                                setIsProcessing(true);
                                setIsProcessComplete(false);
                                setDisplayProgress(0);
                                setElapsedSeconds(0);
                              } catch (err) {
                                console.error('Error starting music mixing:', err);
                              }
                            }}
                            className="flex-1 text-left cursor-pointer"
                          >
                            <h3 className="font-semibold text-satsang-bark">{track.title}</h3>
                            <p className="text-sm text-satsang-ash">{track.artist}</p>
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              ) : isProcessing && !isProcessComplete ? (
                <div className="space-y-6">
                  <h2 className="text-2xl font-semibold text-satsang-bark">Processing Music...</h2>

                  <div className="space-y-3">
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

                  <StepTracker activePhase="mixing" />

                  <button
                    onClick={handleCancelMusic}
                    className="w-full px-6 py-3 border-2 border-satsang-sandalwood text-satsang-bark font-semibold rounded-lg hover:bg-satsang-parchment transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : activeStep === 'music' && (isProcessComplete || musicStepDone) ? (
                <div className="space-y-6">
                  <h2 className="text-2xl font-semibold text-satsang-bark">✅ Music Added! Starting fade out...</h2>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-satsang-bark">Progress</span>
                      <span className="text-lg font-bold text-satsang-bark">{displayProgress}%</span>
                    </div>
                    <div className="w-full h-10 bg-satsang-parchment rounded-full overflow-hidden border-2 border-satsang-sandalwood">
                      <div
                        className="h-full bg-blue-500 transition-all duration-200 flex items-center justify-center"
                        style={{ width: `${displayProgress}%` }}
                      >
                        {displayProgress > 10 && (
                          <span className="text-sm font-bold text-white">{displayProgress}%</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-satsang-ash">Processing your fade out effect...</p>
                </div>
              ) : null}
            </div>
          )}

          {/* FADEOUT STEP CONTENT */}
          {activeStep === 'fadeout' && (
            <div className="bg-white rounded-lg p-8 border-2 border-satsang-sandalwood mb-8">
              <h2 className="text-2xl font-semibold text-satsang-bark mb-6">Add Fade Out Effect</h2>

              {isProcessing && !isProcessComplete ? (
                <div className="space-y-6">
                  <h2 className="text-2xl font-semibold text-satsang-bark">Processing Fadeout...</h2>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-satsang-bark">Progress</span>
                      <span className="text-lg font-bold text-satsang-bark">{displayProgress}%</span>
                    </div>
                    <div className="w-full h-10 bg-satsang-parchment rounded-full overflow-hidden border-2 border-satsang-sandalwood">
                      <div
                        className="h-full bg-blue-500 transition-all duration-200 flex items-center justify-center"
                        style={{ width: `${displayProgress}%` }}
                      >
                        {displayProgress > 10 && (
                          <span className="text-sm font-bold text-white">{displayProgress}%</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : isProcessComplete ? (
                <div className="space-y-4 text-center">
                  <h2 className="text-2xl font-semibold text-satsang-bark">✅ Fade Out Added!</h2>
                  <a
                    href={`http://localhost:3001/jobs/${jobId}/files/with-fadeout.mp3`}
                    download="podcast-with-fadeout.mp3"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-6 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition"
                  >
                    📥 Download Final Audio
                  </a>
                  <button
                    onClick={handleFadeoutComplete}
                    className="w-full px-6 py-3 bg-satsang-saffron text-black font-bold rounded-lg hover:bg-satsang-turmeric transition cursor-pointer"
                  >
                    Done →
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* DESCRIPTION STEP CONTENT */}
          {activeStep === 'description' && (
            <div className="bg-white rounded-lg p-8 border-2 border-satsang-sandalwood mb-8">
              <h2 className="text-2xl font-semibold text-satsang-bark mb-6">Generate Spotify Description</h2>

              {!isProcessing && !isProcessComplete ? (
                <div className="space-y-4">
                  <textarea
                    placeholder="Describe your podcast briefly (what it's about, audience, topics)..."
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    className="w-full px-4 py-2 rounded border border-satsang-sandalwood"
                    rows={4}
                  />
                  <button
                    onClick={handleStartImage}
                    className="w-full px-6 py-3 bg-satsang-saffron text-black font-bold rounded-lg hover:bg-satsang-turmeric transition cursor-pointer"
                  >
                    Optimize Description →
                  </button>
                </div>
              ) : isProcessing && !isProcessComplete ? (
                <div className="space-y-6 text-center">
                  <h2 className="text-2xl font-semibold text-satsang-bark">Optimizing Description...</h2>
                  <div className="flex justify-center">
                    <style>{`
                      @keyframes spin {
                        from {
                          transform: rotate(0deg);
                        }
                        to {
                          transform: rotate(360deg);
                        }
                      }
                      .circular-spinner {
                        width: 50px;
                        height: 50px;
                        border: 4px solid #f0e6d2;
                        border-top-color: #d4a017;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                      }
                    `}</style>
                    <div className="circular-spinner"></div>
                  </div>
                  <p className="text-satsang-ash">Claude is crafting the perfect Spotify description...</p>
                </div>
              ) : isProcessComplete ? (
                <div className="space-y-4 text-center">
                  <h2 className="text-2xl font-semibold text-satsang-bark">✅ Description Ready!</h2>
                  <div className="bg-satsang-parchment p-6 rounded text-left max-w-md mx-auto">
                    <p className="text-satsang-bark text-sm whitespace-pre-wrap">{generatedImages.length > 0 ? generatedImages[generatedImages.length - 1] : 'Description generated'}</p>
                  </div>
                  <button
                    onClick={() => {
                      if (generatedImages.length > 0) {
                        const text = generatedImages[generatedImages.length - 1];
                        navigator.clipboard.writeText(text);
                      }
                    }}
                    className="inline-block px-6 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition"
                  >
                    📋 Copy to Clipboard
                  </button>
                  <button
                    onClick={handleImageComplete}
                    className="w-full px-6 py-3 bg-satsang-saffron text-black font-bold rounded-lg hover:bg-satsang-turmeric transition cursor-pointer"
                  >
                    Done →
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* Project Complete Section */}
          {allComplete && !activeStep && (
            <div className="bg-green-50 rounded-lg p-8 border-2 border-green-500 text-center">
              <h2 className="text-3xl font-semibold text-green-800 mb-4">
                🎉 Project Complete!
              </h2>
              <p className="text-green-700 mb-6">All steps finished. Ready to start a new project?</p>
              <button
                onClick={handleProjectComplete}
                className="w-full px-6 py-3 bg-satsang-saffron text-black font-bold rounded-lg hover:bg-satsang-turmeric transition cursor-pointer"
              >
                Start New Project →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
