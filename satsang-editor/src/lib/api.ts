import type { ProcessingStep, MusicTrack } from '../types/episode';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export interface JobStatus {
  jobId: string;
  status: 'processing' | 'complete' | 'error';
  steps: ProcessingStep[];
}

export async function submitJob(
  files: File[],
  metadata: {
    title: string;
    description: string;
    thumbnailPrompt: string;
  }
): Promise<string> {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append('files', file);
  });
  formData.append('title', metadata.title);
  formData.append('description', metadata.description);
  formData.append('thumbnailPrompt', metadata.thumbnailPrompt);

  const response = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to submit job: ${response.statusText}`);
  }

  const data = await response.json();
  return data.jobId;
}

export async function pollJobStatus(jobId: string): Promise<JobStatus> {
  const response = await fetch(`${API_BASE}/jobs/${jobId}/status`);

  if (!response.ok) {
    throw new Error(`Failed to get job status: ${response.statusText}`);
  }

  return response.json();
}

export async function runStepCleanup(jobId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/jobs/${jobId}/step/cleanup`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Failed to start cleanup step: ${response.statusText}`);
  }
}

export async function getMusicOptions(): Promise<MusicTrack[]> {
  const response = await fetch(`${API_BASE}/music-options`);

  if (!response.ok) {
    throw new Error(`Failed to fetch music options: ${response.statusText}`);
  }

  return response.json();
}

export async function runStepMixing(jobId: string, musicFilename?: string): Promise<void> {
  const response = await fetch(`${API_BASE}/jobs/${jobId}/step/mixing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ musicFilename }),
  });

  if (!response.ok) {
    throw new Error(`Failed to start mixing step: ${response.statusText}`);
  }
}

export async function runStepFadeout(jobId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/jobs/${jobId}/step/fadeout`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Failed to start fadeout step: ${response.statusText}`);
  }
}

export async function runStepDescription(jobId: string, descriptionPrompt: string): Promise<void> {
  const response = await fetch(`${API_BASE}/jobs/${jobId}/step/description`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ descriptionPrompt }),
  });

  if (!response.ok) {
    throw new Error(`Failed to start description step: ${response.statusText}`);
  }
}

export function getAudioUrl(jobId: string): string {
  return `${API_BASE}/jobs/${jobId}/audio`;
}

export function getDescriptionUrl(jobId: string): string {
  return `${API_BASE}/jobs/${jobId}/files/description.txt`;
}

export interface JobFile {
  name: string;
  size: number;
  type: 'audio' | 'image' | 'other';
}

export async function getJobFiles(jobId: string): Promise<JobFile[]> {
  const response = await fetch(`${API_BASE}/jobs/${jobId}/files`);

  if (!response.ok) {
    throw new Error(`Failed to get job files: ${response.statusText}`);
  }

  const data = await response.json();
  return data.files;
}
