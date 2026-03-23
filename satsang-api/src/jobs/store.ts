import { Job, JobStep } from '../types';
import path from 'path';
import fs from 'fs';

const INITIAL_STEPS: JobStep[] = [
  { id: 'stitch', status: 'pending', progressPercent: 0 },
  { id: 'noise', status: 'pending', progressPercent: 0 },
  { id: 'silence', status: 'pending', progressPercent: 0 },
  { id: 'music', status: 'pending', progressPercent: 0 },
  { id: 'fadeout', status: 'pending', progressPercent: 0 },
  { id: 'description', status: 'pending', progressPercent: 0 },
];

const STORE_FILE = path.join(__dirname, '../../job-store.json');

class JobStore {
  private jobs = new Map<string, Job>();

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const data = fs.readFileSync(STORE_FILE, 'utf-8');
        const jobs = JSON.parse(data) as Job[];
        jobs.forEach((job) => {
          this.jobs.set(job.id, job);
        });
        console.log(`📂 Loaded ${jobs.length} jobs from disk`);
      }
    } catch (err) {
      console.error('Failed to load job store from disk:', err);
    }
  }

  private saveToDisk(): void {
    try {
      const jobs = Array.from(this.jobs.values());
      fs.writeFileSync(STORE_FILE, JSON.stringify(jobs, null, 2));
    } catch (err) {
      console.error('Failed to save job store to disk:', err);
    }
  }

  create(id: string, dir: string, metadata: Job['metadata']): Job {
    const job: Job = {
      id,
      status: 'processing',
      dir,
      metadata,
      steps: JSON.parse(JSON.stringify(INITIAL_STEPS)), // deep clone
      createdAt: new Date(),
    };
    this.jobs.set(id, job);
    this.saveToDisk();
    return job;
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  updateStep(jobId: string, stepId: string, update: Partial<JobStep>): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    const step = job.steps.find((s) => s.id === stepId);
    if (step) {
      Object.assign(step, update);
      this.saveToDisk();
    }
  }

  complete(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'complete';
      this.saveToDisk();
    }
  }

  error(jobId: string, message: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'error';
      job.error = message;
      this.saveToDisk();
    }
  }

  cleanup(olderThanMs: number): void {
    const now = Date.now();
    const idsToDelete: string[] = [];

    this.jobs.forEach((job, id) => {
      const ageMs = now - new Date(job.createdAt).getTime();
      if (ageMs > olderThanMs) {
        idsToDelete.push(id);
      }
    });

    idsToDelete.forEach((id) => {
      this.jobs.delete(id);
    });

    if (idsToDelete.length > 0) {
      this.saveToDisk();
      console.log(`🗑️  Cleaned up ${idsToDelete.length} old jobs from store`);
    }
  }
}

export const jobStore = new JobStore();
