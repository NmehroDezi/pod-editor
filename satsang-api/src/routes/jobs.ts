import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { jobStore } from '../jobs/store';
import { processPodcast, processAudioCleanup, processAudioMixing, processFadeOut, generateDescription } from '../processor/pipeline';

const router = Router();
// Store all job files in the project folder (not /tmp)
// Path: ./satsang-api/temp-jobs/
const tmpDir = path.join(__dirname, '../../temp-jobs');

// Ensure tmp directory exists
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
  console.log(`📁 Created job storage directory: ${tmpDir}`);
}

// Multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const isMp3 = file.mimetype === 'audio/mpeg' || file.originalname.endsWith('.mp3');
    const isM4a = file.mimetype === 'audio/mp4' || file.originalname.endsWith('.m4a');
    
    if (isMp3 || isM4a) {
      cb(null, true);
    } else {
      cb(new Error('Only MP3 and M4A files allowed'));
    }
  },
});

// POST /jobs - Create a new processing job
router.post('/jobs', upload.array('files') as any, async (req: Request, res: Response) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const jobId = uuidv4();
    const jobDir = path.join(tmpDir, jobId);
    fs.mkdirSync(jobDir, { recursive: true });

    // Save uploaded files to disk
    const inputFiles: string[] = [];
    const files = req.files as Express.Multer.File[];
    for (let i = 0; i < files.length; i++) {
      const filePath = path.join(jobDir, `input-${i}.mp3`);
      fs.writeFileSync(filePath, files[i].buffer);
      inputFiles.push(filePath);
    }

    // Create job in store (but DON'T start processing - let user choose step)
    const metadata = {
      title: req.body.title || 'Untitled Episode',
      description: req.body.description || '',
      thumbnailPrompt: req.body.thumbnailPrompt || '',
    };
    jobStore.create(jobId, jobDir, metadata);

    res.json({ jobId });
  } catch (err) {
    console.error('POST /jobs error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /jobs/:id/status - Get job status
router.get('/jobs/:id/status', (req: Request, res: Response) => {
  try {
    const job = jobStore.get(String(req.params.id));
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      jobId: job.id,
      status: job.status,
      steps: job.steps,
    });
  } catch (err) {
    console.error('GET /jobs/:id/status error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /jobs/:id/audio - Stream final audio
router.get('/jobs/:id/audio', (req: Request, res: Response) => {
  try {
    const job = jobStore.get(String(req.params.id));
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'complete') {
      return res.status(400).json({ error: 'Job not completed' });
    }

    const audioPath = path.join(job.dir, 'with-music.mp3');
    if (!fs.existsSync(audioPath)) {
      return res.status(404).json({ error: 'Audio file not found' });
    }

    res.type('audio/mpeg');
    res.header('Content-Disposition', `inline; filename="${String(job.metadata.title)}.mp3"`);
    res.sendFile(audioPath);
  } catch (err) {
    console.error('GET /jobs/:id/audio error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /jobs/:id/thumbnail - Stream thumbnail image
router.get('/jobs/:id/thumbnail', (req: Request, res: Response) => {
  try {
    const job = jobStore.get(String(req.params.id));
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'complete') {
      return res.status(400).json({ error: 'Job not completed' });
    }

    const thumbPath = path.join(job.dir, 'thumbnail.png');
    if (!fs.existsSync(thumbPath)) {
      return res.status(404).json({ error: 'Thumbnail not found' });
    }

    res.type('image/png');
    res.header('Content-Disposition', `inline; filename="${String(job.metadata.title)}-thumb.png"`);
    res.sendFile(thumbPath);
  } catch (err) {
    console.error('GET /jobs/:id/thumbnail error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /jobs/:id/step/cleanup - Run steps 1-3 (Stitch, Denoise, Silence)
router.post('/jobs/:id/step/cleanup', async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.id);
    const job = jobStore.get(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Re-initialize all steps for cleanup phase
    jobStore.updateStep(jobId, 'stitch', { status: 'pending', progressPercent: 0 });
    jobStore.updateStep(jobId, 'noise', { status: 'pending', progressPercent: 0 });
    jobStore.updateStep(jobId, 'silence', { status: 'pending', progressPercent: 0 });
    // Keep other steps pending (not active)
    jobStore.updateStep(jobId, 'music', { status: 'pending', progressPercent: 0 });
    jobStore.updateStep(jobId, 'thumbnail', { status: 'pending', progressPercent: 0 });

    const inputFiles = fs
      .readdirSync(job.dir)
      .filter((f) => f.match(/^input-\d+\.mp3$/))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)![0]);
        const numB = parseInt(b.match(/\d+/)![0]);
        return numA - numB;
      })
      .map((f) => path.join(job.dir, f));

    if (inputFiles.length === 0) {
      return res.status(400).json({ error: 'No input files found in job directory' });
    }

    // Start processing asynchronously (don't re-reset status)
    console.log(`Starting cleanup for job ${jobId} with ${inputFiles.length} files`);
    processAudioCleanup(jobId, job.dir, inputFiles).catch((err) => {
      console.error(`Step cleanup for job ${jobId} failed:`, err);
      jobStore.error(jobId, err.message);
    });

    res.json({ jobId, step: 'cleanup' });
  } catch (err) {
    console.error('POST /jobs/:id/step/cleanup error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /jobs/:id/step/mixing - Run step 4 (Normalize + Music)
router.post('/jobs/:id/step/mixing', async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.id);
    const job = jobStore.get(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Get music filename from request body
    const musicFilename = req.body?.musicFilename;
    let musicPath: string | undefined;
    if (musicFilename) {
      // Look in the "new music" folder
      musicPath = path.join(__dirname, '../../..', 'new music', musicFilename);
      // Verify the file exists
      if (!fs.existsSync(musicPath)) {
        return res.status(400).json({ error: `Music file not found: ${musicFilename}` });
      }
    }

    // Only reset music and thumbnail, keep audio steps as they are (they should already be complete)
    jobStore.updateStep(jobId, 'music', { status: 'pending', progressPercent: 0 });
    jobStore.updateStep(jobId, 'thumbnail', { status: 'pending', progressPercent: 0 });
    jobStore.updateStep(jobId, 'fadeout', { status: 'pending', progressPercent: 0 });
    console.log(`Starting mixing step for job ${jobId}${musicPath ? ` with music: ${musicFilename}` : ''}`);

    processAudioMixing(jobId, job.dir, musicPath).catch((err) => {
      console.error(`Step mixing for job ${jobId} failed:`, err);
      jobStore.error(jobId, err.message);
    });

    res.json({ jobId, step: 'mixing' });
  } catch (err) {
    console.error('POST /jobs/:id/step/mixing error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /jobs/:id/step/description - Run step 5 (Generate Spotify-optimized Description)
router.post('/jobs/:id/step/description', async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.id);
    const job = jobStore.get(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const descriptionPrompt = req.body.descriptionPrompt || job.metadata.description || '';

    // Only reset description (which will be active), keep all other steps as they are
    jobStore.updateStep(jobId, 'description', { status: 'pending', progressPercent: 0 });
    console.log(`Starting description generation for job ${jobId} with prompt: "${descriptionPrompt}"`);

    generateDescription(jobId, job.dir, descriptionPrompt).catch((err: Error) => {
      console.error(`Step description for job ${jobId} failed:`, err);
      jobStore.error(jobId, err.message);
    });

    res.json({ jobId, step: 'description' });
  } catch (err) {
    console.error('POST /jobs/:id/step/description error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /jobs/:id/files - List all available files in job directory
router.get('/jobs/:id/files', (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.id);
    const job = jobStore.get(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const files = fs.readdirSync(job.dir).map((f) => {
      const filePath = path.join(job.dir, f);
      const stats = fs.statSync(filePath);
      return {
        name: f,
        size: stats.size,
        type: f.endsWith('.mp3') ? 'audio' : f.endsWith('.png') ? 'image' : 'other',
      };
    });

    res.json({ jobId, files });
  } catch (err) {
    console.error('GET /jobs/:id/files error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /jobs/:id/files/:filename - Download a specific file from job
router.get('/jobs/:id/files/:filename', (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.id);
    const filename = String(req.params.filename);
    const job = jobStore.get(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Security: prevent directory traversal
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const filePath = path.join(job.dir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Determine content type
    let contentType = 'application/octet-stream';
    if (filename.endsWith('.mp3')) {
      contentType = 'audio/mpeg';
    } else if (filename.endsWith('.png')) {
      contentType = 'image/png';
    }

    res.type(contentType);
    res.header('Content-Disposition', `inline; filename="${filename}"`);
    res.sendFile(filePath);
  } catch (err) {
    console.error('GET /jobs/:id/files/:filename error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /jobs/:id/step/fadeout - Run step 4.5 (Add Fade Out Effect)
router.post('/jobs/:id/step/fadeout', async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.id);
    const job = jobStore.get(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Only reset fadeout (keep other steps as-is)
    jobStore.updateStep(jobId, 'fadeout', { status: 'pending', progressPercent: 0 });
    console.log(`Starting fadeout effect for job ${jobId}`);

    processFadeOut(jobId, job.dir).catch((err) => {
      console.error(`Step fadeout for job ${jobId} failed:`, err);
      jobStore.error(jobId, err.message);
    });

    res.json({ jobId, step: 'fadeout' });
  } catch (err) {
    console.error('POST /jobs/:id/step/fadeout error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /music-options - List available background music tracks
router.get('/music-options', (req: Request, res: Response) => {
  try {
    const newMusicDir = path.join(__dirname, '../../..', 'new music');
    
    // Use new music folder
    let files: string[] = [];
    if (fs.existsSync(newMusicDir)) {
      files = fs.readdirSync(newMusicDir).filter((f) => f.endsWith('.mp3'));
    }
    
    const tracks = files.map((filename, i) => ({
      id: String(i),
      filename,
      title: filename
        .replace(/[-_]/g, ' ')
        .replace(/\.mp3$/i, '')
        .replace(/\w/g, (c) => c.toUpperCase()),
      artist: 'Royalty Free',
      source: 'library' as const,
    }));

    res.json(tracks);
  } catch (err) {
    console.error('GET /music-options error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /music-preview/:filename - Stream a music file for preview
router.get('/music-preview/:filename', (req: Request, res: Response) => {
  try {
    const filename = path.basename(req.params.filename); // Sanitize to prevent directory traversal
    const musicPath = path.join(__dirname, '../../..', 'new music', filename);

    if (!fs.existsSync(musicPath)) {
      return res.status(404).json({ error: 'Music file not found' });
    }

    res.type('audio/mpeg');
    res.sendFile(musicPath);
  } catch (err) {
    console.error('GET /music-preview error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
