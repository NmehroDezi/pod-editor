"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ffmpegAvailable = exports.ffmpeg = void 0;
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const fs_1 = __importDefault(require("fs"));
// Get FFmpeg binary path - try static first, then system paths
function getFfmpegPath() {
    // First try ffmpeg-static
    try {
        // @ts-ignore
        const ffmpegStatic = require('ffmpeg-static');
        if (ffmpegStatic && fs_1.default.existsSync(ffmpegStatic)) {
            return ffmpegStatic;
        }
    }
    catch {
        // continue
    }
    // Then try common system paths
    const possiblePaths = [
        '/usr/local/bin/ffmpeg',
        '/usr/bin/ffmpeg',
        '/opt/homebrew/bin/ffmpeg', // M1/M2 Macs
        process.env.FFMPEG_BIN,
    ].filter(Boolean);
    for (const p of possiblePaths) {
        if (p && fs_1.default.existsSync(p)) {
            return p;
        }
    }
    // If nothing found, try 'which ffmpeg'
    try {
        const { execSync } = require('child_process');
        const result = execSync('which ffmpeg', { encoding: 'utf-8' })
            .toString()
            .trim();
        if (result)
            return result;
    }
    catch {
        // continue
    }
    return undefined;
}
const ffmpegPath = getFfmpegPath();
if (!ffmpegPath) {
    console.error('⚠️  FFmpeg not found! This package includes ffmpeg-static as a fallback.');
    console.error('If it still fails, install FFmpeg: brew install ffmpeg (macOS with Homebrew)');
}
// Get FFprobe binary path
function getFfprobePath() {
    // First try ffprobe-static package
    try {
        // @ts-ignore
        const ffprobeStatic = require('ffprobe-static');
        if (ffprobeStatic && ffprobeStatic.path && fs_1.default.existsSync(ffprobeStatic.path)) {
            return ffprobeStatic.path;
        }
    }
    catch {
        // continue
    }
    // Then try common system paths
    const possiblePaths = [
        '/usr/local/bin/ffprobe',
        '/usr/bin/ffprobe',
        '/opt/homebrew/bin/ffprobe', // M1/M2 Macs
        process.env.FFPROBE_BIN,
    ].filter(Boolean);
    for (const p of possiblePaths) {
        if (p && fs_1.default.existsSync(p)) {
            return p;
        }
    }
    // If nothing found, try 'which ffprobe'
    try {
        const { execSync } = require('child_process');
        const result = execSync('which ffprobe', { encoding: 'utf-8' })
            .toString()
            .trim();
        if (result)
            return result;
    }
    catch {
        // continue
    }
    return undefined;
}
const ffprobePath = getFfprobePath();
// Configure fluent-ffmpeg
if (ffmpegPath) {
    fluent_ffmpeg_1.default.setFfmpegPath(ffmpegPath);
    console.log(`✓ FFmpeg found at: ${ffmpegPath}`);
}
if (ffprobePath) {
    fluent_ffmpeg_1.default.setFfprobePath(ffprobePath);
    console.log(`✓ FFprobe found at: ${ffprobePath}`);
}
else {
    console.warn(`⚠️  FFprobe not found - audio probing will fail`);
}
exports.ffmpeg = fluent_ffmpeg_1.default;
exports.ffmpegAvailable = !!ffmpegPath && !!ffprobePath;
//# sourceMappingURL=ffmpeg.js.map