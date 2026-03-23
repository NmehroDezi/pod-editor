"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const jobs_1 = __importDefault(require("./routes/jobs"));
const ffmpeg_1 = require("./lib/ffmpeg");
const store_1 = require("./jobs/store");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        ffmpeg: ffmpeg_1.ffmpegAvailable ? '✓ available' : '✗ not found',
    });
});
// Routes
app.use(jobs_1.default);
// 404
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});
// Error handler
app.use((err, req, res, next) => {
    console.error('Express error:', err);
    res.status(500).json({ error: err.message });
});
// Cleanup old temp files on startup and every 24 hours
function cleanupOldTempFiles() {
    const tmpDir = path_1.default.join(__dirname, '../temp-jobs');
    if (!fs_1.default.existsSync(tmpDir))
        return;
    const now = Date.now();
    fs_1.default.readdirSync(tmpDir).forEach((jobId) => {
        const jobPath = path_1.default.join(tmpDir, jobId);
        const stats = fs_1.default.statSync(jobPath);
        const ageMs = now - stats.ctimeMs;
        if (ageMs > ONE_DAY_MS) {
            try {
                fs_1.default.rmSync(jobPath, { recursive: true, force: true });
                console.log(`🗑️  Deleted old temp job: ${jobId}`);
            }
            catch (err) {
                console.error(`Failed to delete ${jobId}:`, err);
            }
        }
    });
    // Also cleanup old jobs from in-memory store
    store_1.jobStore.cleanup(ONE_DAY_MS);
}
app.listen(PORT, () => {
    console.log(`🎙️  Satsang API listening on http://localhost:${PORT}`);
    if (!ffmpeg_1.ffmpegAvailable) {
        console.warn('⚠️  FFmpeg is not available. Audio processing will fail. Install FFmpeg and try again.');
    }
    // Clean up old files on startup
    cleanupOldTempFiles();
    // Run cleanup every 24 hours
    setInterval(cleanupOldTempFiles, ONE_DAY_MS);
});
//# sourceMappingURL=index.js.map