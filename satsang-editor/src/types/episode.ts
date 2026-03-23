export type AppView = 'dashboard';
export type ProcessingStatus = 'idle' | 'processing' | 'complete' | 'error';
export type StepStatus = 'pending' | 'active' | 'complete' | 'error';
export type StepName = 'audio' | 'music' | 'fadeout' | 'description';

export interface ProcessingStep {
  id: string;
  label: string;
  description: string;
  status: StepStatus;
  progressPercent: number; // 0–100
}

export interface AudioFile {
  id: string; // uuid for stable dnd-kit keys
  file: File; // raw browser File object
  name: string;
  durationSeconds: number | null; // populated after client-side parse
  sizeBytes: number;
}

export interface EpisodeMetadata {
  title: string;
  description: string;
  thumbnailPrompt: string;
}

export interface EpisodeOutput {
  finalAudioUrl: string; // object URL from Blob
  thumbnailUrl: string; // object URL or base64
  thumbnailAltText: string;
}

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  previewUrl?: string;
  downloadUrl?: string;
  filename?: string;
  source: 'pixabay' | 'ccmixter' | 'upload' | 'library';
}
