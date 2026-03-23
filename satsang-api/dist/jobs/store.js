"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobStore = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const INITIAL_STEPS = [
    { id: 'stitch', status: 'pending', progressPercent: 0 },
    { id: 'noise', status: 'pending', progressPercent: 0 },
    { id: 'silence', status: 'pending', progressPercent: 0 },
    { id: 'music', status: 'pending', progressPercent: 0 },
    { id: 'fadeout', status: 'pending', progressPercent: 0 },
    { id: 'thumbnail', status: 'pending', progressPercent: 0 },
];
const STORE_FILE = path_1.default.join(__dirname, '../../job-store.json');
class JobStore {
    constructor() {
        this.jobs = new Map();
        this.loadFromDisk();
    }
    loadFromDisk() {
        try {
            if (fs_1.default.existsSync(STORE_FILE)) {
                const data = fs_1.default.readFileSync(STORE_FILE, 'utf-8');
                const jobs = JSON.parse(data);
                jobs.forEach((job) => {
                    this.jobs.set(job.id, job);
                });
                console.log(`📂 Loaded ${jobs.length} jobs from disk`);
            }
        }
        catch (err) {
            console.error('Failed to load job store from disk:', err);
        }
    }
    saveToDisk() {
        try {
            const jobs = Array.from(this.jobs.values());
            fs_1.default.writeFileSync(STORE_FILE, JSON.stringify(jobs, null, 2));
        }
        catch (err) {
            console.error('Failed to save job store to disk:', err);
        }
    }
    create(id, dir, metadata) {
        const job = {
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
    get(id) {
        return this.jobs.get(id);
    }
    updateStep(jobId, stepId, update) {
        const job = this.jobs.get(jobId);
        if (!job)
            return;
        const step = job.steps.find((s) => s.id === stepId);
        if (step) {
            Object.assign(step, update);
            this.saveToDisk();
        }
    }
    complete(jobId) {
        const job = this.jobs.get(jobId);
        if (job) {
            job.status = 'complete';
            this.saveToDisk();
        }
    }
    error(jobId, message) {
        const job = this.jobs.get(jobId);
        if (job) {
            job.status = 'error';
            job.error = message;
            this.saveToDisk();
        }
    }
    cleanup(olderThanMs) {
        const now = Date.now();
        const idsToDelete = [];
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
exports.jobStore = new JobStore();
//# sourceMappingURL=store.js.map