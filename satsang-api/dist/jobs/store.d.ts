import { Job, JobStep } from '../types';
declare class JobStore {
    private jobs;
    constructor();
    private loadFromDisk;
    private saveToDisk;
    create(id: string, dir: string, metadata: Job['metadata']): Job;
    get(id: string): Job | undefined;
    updateStep(jobId: string, stepId: string, update: Partial<JobStep>): void;
    complete(jobId: string): void;
    error(jobId: string, message: string): void;
    cleanup(olderThanMs: number): void;
}
export declare const jobStore: JobStore;
export {};
//# sourceMappingURL=store.d.ts.map