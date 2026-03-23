import { create } from 'zustand';
import type {
  AudioFile,
  EpisodeMetadata,
  EpisodeOutput,
  ProcessingStep,
  ProcessingStatus,
  StepName,
  MusicTrack,
} from '../types/episode';
import { INITIAL_STEPS } from '../constants/processingSteps';
import { v4 as uuidv4 } from 'uuid';
import { submitJob, runStepCleanup } from '../lib/api';

interface EpisodeStore {
  // Active step for inline display
  activeStep: StepName | null;
  setActiveStep: (step: StepName | null) => void;

  // Project
  projectTitle: string;
  setProjectTitle: (title: string) => void;
  completedSteps: StepName[];
  markStepComplete: (step: StepName) => void;
  uncompleteSteps: (steps: StepName[]) => void;

  // Upload state
  files: AudioFile[];
  addFiles: (newFiles: File[]) => void;
  removeFile: (id: string) => void;
  reorderFiles: (orderedIds: string[]) => void;
  metadata: EpisodeMetadata;
  setMetadata: (partial: Partial<EpisodeMetadata>) => void;

  // Processing state
  processingStatus: ProcessingStatus;
  steps: ProcessingStep[];
  jobId: string | null;
  updateStep: (id: string, update: Partial<ProcessingStep>) => void;
  setJobId: (id: string) => void;
  startProcessing: () => Promise<void>;

  // Output state
  output: EpisodeOutput | null;
  setOutput: (output: EpisodeOutput) => void;

  // Music & Image state
  selectedMusicTrack: MusicTrack | null;
  setSelectedMusicTrack: (track: MusicTrack | null) => void;
  generatedImages: string[];
  addGeneratedImage: (url: string) => void;

  // Reset for new project (keep title, clear progress)
  resetForNewProject: () => void;

  // Complete project and clear session
  completeProject: () => void;
}

const initialMetadata: EpisodeMetadata = {
  title: '',
  description: '',
  thumbnailPrompt: '',
};

export const useEpisodeStore = create<EpisodeStore>((set) => ({
  // Active step
  activeStep: null,
  setActiveStep: (step) => set({ activeStep: step }),

  // Project
  projectTitle: '',
  setProjectTitle: (title) => set({ projectTitle: title }),
  completedSteps: [],
  markStepComplete: (step) =>
    set((state) => {
      const newCompletedSteps = state.completedSteps.includes(step)
        ? state.completedSteps
        : [...state.completedSteps, step];
      return { completedSteps: newCompletedSteps };
    }),

  uncompleteSteps: (steps) =>
    set((state) => ({
      completedSteps: state.completedSteps.filter((s) => !steps.includes(s)),
    })),

  // Upload state
  files: [],
  addFiles: (newFiles) =>
    set((state) => {
      const audioFiles: AudioFile[] = newFiles.map((file) => ({
        id: uuidv4(),
        file,
        name: file.name,
        durationSeconds: null,
        sizeBytes: file.size,
      }));
      return { files: [...state.files, ...audioFiles] };
    }),

  removeFile: (id) =>
    set((state) => ({
      files: state.files.filter((f) => f.id !== id),
    })),

  reorderFiles: (orderedIds) =>
    set((state) => {
      const newFiles = orderedIds
        .map((id) => state.files.find((f) => f.id === id))
        .filter((f) => f !== undefined) as AudioFile[];
      return { files: newFiles };
    }),

  metadata: initialMetadata,
  setMetadata: (partial) =>
    set((state) => ({
      metadata: { ...state.metadata, ...partial },
    })),

  // Processing state
  processingStatus: 'idle',
  steps: INITIAL_STEPS,
  jobId: null,

  updateStep: (id, update) =>
    set((state) => ({
      steps: state.steps.map((step) =>
        step.id === id ? { ...step, ...update } : step
      ),
    })),

  setJobId: (id) => set({ jobId: id }),

  startProcessing: async () => {
    const state = useEpisodeStore.getState();
    set({
      processingStatus: 'processing',
      steps: INITIAL_STEPS.map((step) => ({ ...step })),
    });

    try {
      const jobId = await submitJob(
        state.files.map((f) => f.file),
        state.metadata
      );
      set({ jobId });
      console.log('Job created:', jobId);

      // Start cleanup step processing
      setTimeout(async () => {
        try {
          await runStepCleanup(jobId);
          console.log('Cleanup step started for job:', jobId);
        } catch (error) {
          console.error('Failed to start cleanup step:', error);
        }
      }, 500);
    } catch (error) {
      console.error('Failed to create job:', error);
      set({ processingStatus: 'error' });
    }
  },

  // Output state
  output: null,
  setOutput: (output) => set({ output }),

  // Music & Image state
  selectedMusicTrack: null,
  setSelectedMusicTrack: (track) => set({ selectedMusicTrack: track }),
  generatedImages: [],
  addGeneratedImage: (url) =>
    set((state) => ({
      generatedImages: [...state.generatedImages, url],
    })),

  // Reset for new project (keep title, clear progress)
  resetForNewProject: () =>
    set({
      activeStep: null,
      completedSteps: [],
      files: [],
      metadata: initialMetadata,
      processingStatus: 'idle',
      steps: INITIAL_STEPS.map((step) => ({ ...step })),
      jobId: null,
      output: null,
      selectedMusicTrack: null,
      generatedImages: [],
    }),

  // Complete project and reset session
  completeProject: () =>
    set({
      activeStep: null,
      projectTitle: '',
      completedSteps: [],
      files: [],
      metadata: initialMetadata,
      processingStatus: 'idle',
      steps: INITIAL_STEPS.map((step) => ({ ...step })),
      jobId: null,
      output: null,
      selectedMusicTrack: null,
      generatedImages: [],
    }),
}));
