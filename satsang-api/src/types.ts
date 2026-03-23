export type StepStatus = 'pending' | 'active' | 'complete' | 'error';
export type JobStatus = 'processing' | 'complete' | 'error';

export interface JobStep {
  id: string;
  status: StepStatus;
  progressPercent: number;
}

export interface Job {
  id: string;
  status: JobStatus;
  dir: string;
  metadata: {
    title: string;
    description: string;
    thumbnailPrompt: string;
  };
  steps: JobStep[];
  createdAt: Date;
  error?: string;
}

export interface JobOutput {
  audioUrl: string;
  thumbnailUrl: string;
}
