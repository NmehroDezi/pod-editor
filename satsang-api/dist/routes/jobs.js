"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const uuid_1 = require("uuid");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const store_1 = require("../jobs/store");
const pipeline_1 = require("../processor/pipeline");
const router = (0, express_1.Router)();
// Store all job files in the project folder (not /tmp)
// Path: ./satsang-api/temp-jobs/
const tmpDir = path_1.default.join(__dirname, '../../temp-jobs');
// Ensure tmp directory exists
if (!fs_1.default.existsSync(tmpDir)) {
    fs_1.default.mkdirSync(tmpDir, { recursive: true });
    console.log(`📁 Created job storage directory: ${tmpDir}`);
}
// Multer for file uploads
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'audio/mpeg' || file.originalname.endsWith('.mp3')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only MP3 files allowed'));
        }
    },
});
// POST /jobs - Create a new processing job
router.post('/jobs', upload.array('files'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        const jobId = (0, uuid_1.v4)();
        const jobDir = path_1.default.join(tmpDir, jobId);
        fs_1.default.mkdirSync(jobDir, { recursive: true });
        // Save uploaded files to disk
        const inputFiles = [];
        const files = req.files;
        for (let i = 0; i < files.length; i++) {
            const filePath = path_1.default.join(jobDir, `input-${i}.mp3`);
            fs_1.default.writeFileSync(filePath, files[i].buffer);
            inputFiles.push(filePath);
        }
        // Create job in store (but DON'T start processing - let user choose step)
        const metadata = {
            title: req.body.title || 'Untitled Episode',
            description: req.body.description || '',
            thumbnailPrompt: req.body.thumbnailPrompt || '',
        };
        store_1.jobStore.create(jobId, jobDir, metadata);
        res.json({ jobId });
    }
    catch (err) {
        console.error('POST /jobs error:', err);
        res.status(500).json({ error: err.message });
    }
});
// GET /jobs/:id/status - Get job status
router.get('/jobs/:id/status', (req, res) => {
    try {
        const job = store_1.jobStore.get(String(req.params.id));
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        res.json({
            jobId: job.id,
            status: job.status,
            steps: job.steps,
        });
    }
    catch (err) {
        console.error('GET /jobs/:id/status error:', err);
        res.status(500).json({ error: err.message });
    }
});
// GET /jobs/:id/audio - Stream final audio
router.get('/jobs/:id/audio', (req, res) => {
    try {
        const job = store_1.jobStore.get(String(req.params.id));
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        if (job.status !== 'complete') {
            return res.status(400).json({ error: 'Job not completed' });
        }
        const audioPath = path_1.default.join(job.dir, 'with-music.mp3');
        if (!fs_1.default.existsSync(audioPath)) {
            return res.status(404).json({ error: 'Audio file not found' });
        }
        res.type('audio/mpeg');
        res.header('Content-Disposition', `inline; filename="${String(job.metadata.title)}.mp3"`);
        res.sendFile(audioPath);
    }
    catch (err) {
        console.error('GET /jobs/:id/audio error:', err);
        res.status(500).json({ error: err.message });
    }
});
// GET /jobs/:id/thumbnail - Stream thumbnail image
router.get('/jobs/:id/thumbnail', (req, res) => {
    try {
        const job = store_1.jobStore.get(String(req.params.id));
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        if (job.status !== 'complete') {
            return res.status(400).json({ error: 'Job not completed' });
        }
        const thumbPath = path_1.default.join(job.dir, 'thumbnail.png');
        if (!fs_1.default.existsSync(thumbPath)) {
            return res.status(404).json({ error: 'Thumbnail not found' });
        }
        res.type('image/png');
        res.header('Content-Disposition', `inline; filename="${String(job.metadata.title)}-thumb.png"`);
        res.sendFile(thumbPath);
    }
    catch (err) {
        console.error('GET /jobs/:id/thumbnail error:', err);
        res.status(500).json({ error: err.message });
    }
});
// POST /jobs/:id/step/cleanup - Run steps 1-3 (Stitch, Denoise, Silence)
router.post('/jobs/:id/step/cleanup', async (req, res) => {
    try {
        const jobId = String(req.params.id);
        const job = store_1.jobStore.get(jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        // Re-initialize all steps for cleanup phase
        store_1.jobStore.updateStep(jobId, 'stitch', { status: 'pending', progressPercent: 0 });
        store_1.jobStore.updateStep(jobId, 'noise', { status: 'pending', progressPercent: 0 });
        store_1.jobStore.updateStep(jobId, 'silence', { status: 'pending', progressPercent: 0 });
        // Keep other steps pending (not active)
        store_1.jobStore.updateStep(jobId, 'music', { status: 'pending', progressPercent: 0 });
        store_1.jobStore.updateStep(jobId, 'thumbnail', { status: 'pending', progressPercent: 0 });
        const inputFiles = fs_1.default
            .readdirSync(job.dir)
            .filter((f) => f.match(/^input-\d+\.mp3$/))
            .sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)[0]);
            const numB = parseInt(b.match(/\d+/)[0]);
            return numA - numB;
        })
            .map((f) => path_1.default.join(job.dir, f));
        if (inputFiles.length === 0) {
            return res.status(400).json({ error: 'No input files found in job directory' });
        }
        // Start processing asynchronously (don't re-reset status)
        console.log(`Starting cleanup for job ${jobId} with ${inputFiles.length} files`);
        (0, pipeline_1.processAudioCleanup)(jobId, job.dir, inputFiles).catch((err) => {
            console.error(`Step cleanup for job ${jobId} failed:`, err);
            store_1.jobStore.error(jobId, err.message);
        });
        res.json({ jobId, step: 'cleanup' });
    }
    catch (err) {
        console.error('POST /jobs/:id/step/cleanup error:', err);
        res.status(500).json({ error: err.message });
    }
});
// POST /jobs/:id/step/mixing - Run step 4 (Normalize + Music)
router.post('/jobs/:id/step/mixing', async (req, res) => {
    try {
        const jobId = String(req.params.id);
        const job = store_1.jobStore.get(jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        // Get music filename from request body
        const musicFilename = req.body?.musicFilename;
        let musicPath;
        if (musicFilename) {
            // Look in the "new music" folder
            musicPath = path_1.default.join(__dirname, '../../..', 'new music', musicFilename);
            // Verify the file exists
            if (!fs_1.default.existsSync(musicPath)) {
                return res.status(400).json({ error: `Music file not found: ${musicFilename}` });
            }
        }
        // Reset all steps except music (which will be active)
        store_1.jobStore.updateStep(jobId, 'stitch', { status: 'pending', progressPercent: 0 });
        store_1.jobStore.updateStep(jobId, 'noise', { status: 'pending', progressPercent: 0 });
        store_1.jobStore.updateStep(jobId, 'silence', { status: 'pending', progressPercent: 0 });
        store_1.jobStore.updateStep(jobId, 'music', { status: 'pending', progressPercent: 0 });
        store_1.jobStore.updateStep(jobId, 'thumbnail', { status: 'pending', progressPercent: 0 });
        console.log(`Starting mixing step for job ${jobId}${musicPath ? ` with music: ${musicFilename}` : ''}`);
        (0, pipeline_1.processAudioMixing)(jobId, job.dir, musicPath).catch((err) => {
            console.error(`Step mixing for job ${jobId} failed:`, err);
            store_1.jobStore.error(jobId, err.message);
        });
        res.json({ jobId, step: 'mixing' });
    }
    catch (err) {
        console.error('POST /jobs/:id/step/mixing error:', err);
        res.status(500).json({ error: err.message });
    }
});
// POST /jobs/:id/step/thumbnail - Run step 5 (Generate Thumbnail)
router.post('/jobs/:id/step/thumbnail', async (req, res) => {
    try {
        const jobId = String(req.params.id);
        const job = store_1.jobStore.get(jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        const thumbnailPrompt = req.body.thumbnailPrompt || job.metadata.thumbnailPrompt || '';
        // Reset all steps except thumbnail (which will be active)
        store_1.jobStore.updateStep(jobId, 'stitch', { status: 'pending', progressPercent: 0 });
        store_1.jobStore.updateStep(jobId, 'noise', { status: 'pending', progressPercent: 0 });
        store_1.jobStore.updateStep(jobId, 'silence', { status: 'pending', progressPercent: 0 });
        store_1.jobStore.updateStep(jobId, 'music', { status: 'pending', progressPercent: 0 });
        store_1.jobStore.updateStep(jobId, 'thumbnail', { status: 'pending', progressPercent: 0 });
        console.log(`Starting thumbnail generation for job ${jobId} with prompt: "${thumbnailPrompt}"`);
        (0, pipeline_1.generateThumbnail)(jobId, job.dir, thumbnailPrompt).catch((err) => {
            console.error(`Step thumbnail for job ${jobId} failed:`, err);
            store_1.jobStore.error(jobId, err.message);
        });
        res.json({ jobId, step: 'thumbnail' });
    }
    catch (err) {
        console.error('POST /jobs/:id/step/thumbnail error:', err);
        res.status(500).json({ error: err.message });
    }
});
// GET /jobs/:id/files - List all available files in job directory
router.get('/jobs/:id/files', (req, res) => {
    try {
        const jobId = String(req.params.id);
        const job = store_1.jobStore.get(jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        const files = fs_1.default.readdirSync(job.dir).map((f) => {
            const filePath = path_1.default.join(job.dir, f);
            const stats = fs_1.default.statSync(filePath);
            return {
                name: f,
                size: stats.size,
                type: f.endsWith('.mp3') ? 'audio' : f.endsWith('.png') ? 'image' : 'other',
            };
        });
        res.json({ jobId, files });
    }
    catch (err) {
        console.error('GET /jobs/:id/files error:', err);
        res.status(500).json({ error: err.message });
    }
});
// GET /jobs/:id/files/:filename - Download a specific file from job
router.get('/jobs/:id/files/:filename', (req, res) => {
    try {
        const jobId = String(req.params.id);
        const filename = String(req.params.filename);
        const job = store_1.jobStore.get(jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        // Security: prevent directory traversal
        if (filename.includes('..') || filename.includes('/')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }
        const filePath = path_1.default.join(job.dir, filename);
        if (!fs_1.default.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        // Determine content type
        let contentType = 'application/octet-stream';
        if (filename.endsWith('.mp3')) {
            contentType = 'audio/mpeg';
        }
        else if (filename.endsWith('.png')) {
            contentType = 'image/png';
        }
        res.type(contentType);
        res.header('Content-Disposition', `inline; filename="${filename}"`);
        res.sendFile(filePath);
    }
    catch (err) {
        console.error('GET /jobs/:id/files/:filename error:', err);
        res.status(500).json({ error: err.message });
    }
});
// POST /jobs/:id/step/fadeout - Run step 4.5 (Add Fade Out Effect)
router.post('/jobs/:id/step/fadeout', async (req, res) => {
    try {
        const jobId = String(req.params.id);
        const job = store_1.jobStore.get(jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        // Only reset fadeout (keep other steps as-is)
        store_1.jobStore.updateStep(jobId, 'fadeout', { status: 'pending', progressPercent: 0 });
        console.log(`Starting fadeout effect for job ${jobId}`);
        (0, pipeline_1.processFadeOut)(jobId, job.dir).catch((err) => {
            console.error(`Step fadeout for job ${jobId} failed:`, err);
            store_1.jobStore.error(jobId, err.message);
        });
        res.json({ jobId, step: 'fadeout' });
    }
    catch (err) {
        console.error('POST /jobs/:id/step/fadeout error:', err);
        res.status(500).json({ error: err.message });
    }
});
// GET /music-options - List available background music tracks
router.get('/music-options', (req, res) => {
    try {
        const newMusicDir = path_1.default.join(__dirname, '../../..', 'new music');
        // Use new music folder
        let files = [];
        if (fs_1.default.existsSync(newMusicDir)) {
            files = fs_1.default.readdirSync(newMusicDir).filter((f) => f.endsWith('.mp3'));
        }
        const tracks = files.map((filename, i) => ({
            id: String(i),
            filename,
            title: filename
                .replace(/[-_]/g, ' ')
                .replace(/\.mp3$/i, '')
                .replace(/\w/g, (c) => c.toUpperCase()),
            artist: 'Royalty Free',
            source: 'library',
        }));
        res.json(tracks);
    }
    catch (err) {
        console.error('GET /music-options error:', err);
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=jobs.js.map