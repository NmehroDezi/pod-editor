import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import jobsRouter from './routes/jobs';
import { ffmpegAvailable } from './lib/ffmpeg';
import { jobStore } from './jobs/store';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3001;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    ffmpeg: ffmpegAvailable ? '✓ available' : '✗ not found',
  });
});

// Routes
app.use(jobsRouter);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error('Express error:', err);
    res.status(500).json({ error: err.message });
  }
);

// Cleanup old temp files on startup and every 24 hours
function cleanupOldTempFiles() {
  const tmpDir = path.join(__dirname, '../temp-jobs');
  if (!fs.existsSync(tmpDir)) return;

  const now = Date.now();

  fs.readdirSync(tmpDir).forEach((jobId) => {
    const jobPath = path.join(tmpDir, jobId);
    const stats = fs.statSync(jobPath);
    const ageMs = now - stats.ctimeMs;

    if (ageMs > ONE_DAY_MS) {
      try {
        fs.rmSync(jobPath, { recursive: true, force: true });
        console.log(`🗑️  Deleted old temp job: ${jobId}`);
      } catch (err) {
        console.error(`Failed to delete ${jobId}:`, err);
      }
    }
  });

  // Also cleanup old jobs from in-memory store
  jobStore.cleanup(ONE_DAY_MS);
}

app.listen(PORT, () => {
  console.log(`🎙️  Satsang API listening on http://localhost:${PORT}`);
  if (!ffmpegAvailable) {
    console.warn(
      '⚠️  FFmpeg is not available. Audio processing will fail. Install FFmpeg and try again.'
    );
  }

  // Clean up old files on startup
  cleanupOldTempFiles();

  // Run cleanup every 24 hours
  setInterval(cleanupOldTempFiles, ONE_DAY_MS);
});
