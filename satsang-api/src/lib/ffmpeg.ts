import FfmpegLib from 'fluent-ffmpeg';
import fs from 'fs';

// Get FFmpeg binary path - try static first, then system paths
function getFfmpegPath(): string | undefined {
  // First try ffmpeg-static
  try {
    // @ts-ignore
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
      return ffmpegStatic;
    }
  } catch {
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
    if (p && fs.existsSync(p)) {
      return p;
    }
  }

  // If nothing found, try 'which ffmpeg'
  try {
    const { execSync } = require('child_process');
    const result = execSync('which ffmpeg', { encoding: 'utf-8' })
      .toString()
      .trim();
    if (result) return result;
  } catch {
    // continue
  }

  return undefined;
}

const ffmpegPath = getFfmpegPath();

if (!ffmpegPath) {
  console.error(
    '⚠️  FFmpeg not found! This package includes ffmpeg-static as a fallback.'
  );
  console.error(
    'If it still fails, install FFmpeg: brew install ffmpeg (macOS with Homebrew)'
  );
}

// Get FFprobe binary path
function getFfprobePath(): string | undefined {
  // First try ffprobe-static package
  try {
    // @ts-ignore
    const ffprobeStatic = require('ffprobe-static');
    if (ffprobeStatic && ffprobeStatic.path && fs.existsSync(ffprobeStatic.path)) {
      return ffprobeStatic.path;
    }
  } catch {
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
    if (p && fs.existsSync(p)) {
      return p;
    }
  }

  // If nothing found, try 'which ffprobe'
  try {
    const { execSync } = require('child_process');
    const result = execSync('which ffprobe', { encoding: 'utf-8' })
      .toString()
      .trim();
    if (result) return result;
  } catch {
    // continue
  }

  return undefined;
}

const ffprobePath = getFfprobePath();

// Configure fluent-ffmpeg
if (ffmpegPath) {
  FfmpegLib.setFfmpegPath(ffmpegPath);
  console.log(`✓ FFmpeg found at: ${ffmpegPath}`);
}

if (ffprobePath) {
  FfmpegLib.setFfprobePath(ffprobePath);
  console.log(`✓ FFprobe found at: ${ffprobePath}`);
} else {
  console.warn(`⚠️  FFprobe not found - audio probing will fail`);
}

export const ffmpeg = FfmpegLib;
export const ffmpegAvailable = !!ffmpegPath && !!ffprobePath;
