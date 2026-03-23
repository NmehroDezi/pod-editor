"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processAudioCleanup = processAudioCleanup;
exports.processAudioMixing = processAudioMixing;
exports.processFadeOut = processFadeOut;
exports.generateThumbnail = generateThumbnail;
exports.processPodcast = processPodcast;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const ffmpeg_1 = require("../lib/ffmpeg");
const store_1 = require("../jobs/store");
const sharp_1 = __importDefault(require("sharp"));
async function generateFallbackThumbnail(outputPath) {
    const bgColor = '#D4A017'; // satsang-gold
    await (0, sharp_1.default)({
        create: {
            width: 3000,
            height: 3000,
            channels: 3,
            background: bgColor,
        },
    })
        .png()
        .toFile(outputPath);
}
async function generateThumbnailWithGemini(prompt, outputPath, apiKey) {
    // Use Gemini API to generate image descriptions, then create visual thumbnail
    console.log(`[Gemini] Generating thumbnail for prompt: "${prompt}"`);
    try {
        // Call Gemini to enhance the prompt
        const enhanceResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                        parts: [{
                                text: `You are a podcast cover art designer. Based on this description, create a visual design specification:\n\n"${prompt}"\n\nRespond with:\n1. Main color (hex code)\n2. Secondary color (hex code)\n3. Text to include\n4. Design elements`
                            }]
                    }]
            })
        });
        if (!enhanceResponse.ok) {
            throw new Error(`Gemini API error: ${enhanceResponse.status}`);
        }
        const enhanceData = (await enhanceResponse.json());
        const designSpec = enhanceData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log(`[Gemini] Design spec generated`);
        // Extract colors from the spec (simplified approach)
        const colorMatch = designSpec.match(/#[0-9A-F]{6}/gi) || [];
        const mainColor = colorMatch[0] || '#D4A017'; // Default to gold
        const secondaryColor = colorMatch[1] || '#8B6914'; // Default to darker gold
        // Create a richer thumbnail with extracted colors
        const svg = `
      <svg width="3000" height="3000" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${mainColor};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${secondaryColor};stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="3000" height="3000" fill="url(#grad1)"/>
        <circle cx="1500" cy="1500" r="1000" fill="${mainColor}" opacity="0.2"/>
        <text x="1500" y="1500" font-size="120" font-family="Arial" fill="white" text-anchor="middle" dominant-baseline="middle" font-weight="bold">PODCAST</text>
      </svg>
    `;
        // Convert SVG to PNG using sharp
        const svgBuffer = Buffer.from(svg);
        await (0, sharp_1.default)(svgBuffer, { density: 100 }).png().toFile(outputPath);
        console.log(`[Gemini] Thumbnail created with design spec colors`);
    }
    catch (err) {
        console.error(`[Gemini] Enhancement failed:`, err);
        throw err;
    }
}
async function addBackgroundMusic(jobId, cleanedAudioPath, outputPath, musicPath) {
    const resolvedMusicPath = musicPath || process.env.BACKGROUND_MUSIC_PATH;
    if (!resolvedMusicPath || !fs_1.default.existsSync(resolvedMusicPath)) {
        // If no music file configured, just copy the cleaned audio as output
        console.log(`[${jobId}] No music file provided, skipping music layer`);
        fs_1.default.copyFileSync(cleanedAudioPath, outputPath);
        return;
    }
    // Mix cleaned audio with background music, then add 3 seconds of silence at the end
    return new Promise((resolve, reject) => {
        const musicFilename = path_1.default.basename(resolvedMusicPath);
        console.log(`[${jobId}] 🎵 Starting music mix:`);
        console.log(`[${jobId}]    Input 1 (cleaned audio): ${path_1.default.basename(cleanedAudioPath)}`);
        console.log(`[${jobId}]    Input 2 (music): ${musicFilename}`);
        console.log(`[${jobId}]    Output: ${path_1.default.basename(outputPath)}`);
        console.log(`[${jobId}]    Filter: Mix audio with music, then add 3s silence at end`);
        (0, ffmpeg_1.ffmpeg)(cleanedAudioPath)
            .input(resolvedMusicPath)
            .complexFilter([
            // Cleaned audio: keep at full volume
            '[0:a]volume=1[speech]',
            // Music: normalize, reduce volume
            '[1:a]loudnorm=I=-20:TP=-1.5:LRA=11,volume=0.4[music]',
            // Mix: use shortest duration (cleaned audio) - output will be exactly as long as cleaned audio
            '[speech][music]amix=inputs=2:duration=shortest[out]'
        ], 'out')
            .audioCodec('libmp3lame')
            .audioBitrate('192k')
            .on('progress', (progress) => {
            const percent = Math.floor(progress.percent || 0);
            if (percent % 10 === 0 && percent > 0) {
                console.log(`[${jobId}] 📊 Music mixing progress: ${percent}%`);
            }
            store_1.jobStore.updateStep(jobId, 'music', { progressPercent: Math.min(percent, 95) });
        })
            .on('end', () => {
            console.log(`[${jobId}] ✅ Music mixing completed successfully`);
            console.log(`[${jobId}]    Output file: ${outputPath}`);
            store_1.jobStore.updateStep(jobId, 'music', { status: 'complete', progressPercent: 100 });
            resolve();
        })
            .on('error', (err) => {
            console.error(`[${jobId}] ❌ Music mixing error:`, err.message);
            // Fallback: if mixing fails, just use the cleaned audio without music
            console.log(`[${jobId}]    Fallback: Using cleaned audio without music`);
            fs_1.default.copyFileSync(cleanedAudioPath, outputPath);
            resolve();
        })
            .save(outputPath);
    });
}
async function addFadeOutEffect(jobId, inputPath, outputPath) {
    // Add 3-second fade out effect to the end of the audio
    return new Promise((resolve, reject) => {
        console.log(`[${jobId}] ✨ Starting fade out effect:`);
        console.log(`[${jobId}]    Input: ${path_1.default.basename(inputPath)}`);
        console.log(`[${jobId}]    Output: ${path_1.default.basename(outputPath)}`);
        console.log(`[${jobId}]    Effect: 3-second fade out at the end`);
        let isResolved = false;
        // First get the duration of the input file
        ffmpeg_1.ffmpeg.ffprobe(inputPath, (err, metadata) => {
            if (err) {
                console.error(`[${jobId}] ❌ Error probing audio file:`, err);
                isResolved = true;
                reject(err);
                return;
            }
            const duration = metadata.format?.duration || 0;
            const fadeStartTime = Math.max(0, duration - 3); // Start fade 3 seconds before end
            console.log(`[${jobId}]    Audio duration: ${duration.toFixed(2)}s, fade starts at: ${fadeStartTime.toFixed(2)}s`);
            (0, ffmpeg_1.ffmpeg)(inputPath)
                .audioFilter(`afade=t=out:st=${fadeStartTime}:d=3`)
                .audioCodec('libmp3lame')
                .audioBitrate('192k')
                .on('progress', (progress) => {
                const percent = Math.floor(progress.percent || 0);
                if (percent % 10 === 0 && percent > 0) {
                    console.log(`[${jobId}] 📊 Fadeout progress: ${percent}%`);
                }
                store_1.jobStore.updateStep(jobId, 'fadeout', { progressPercent: Math.min(percent, 95) });
            })
                .on('end', () => {
                console.log(`[${jobId}] ✅ Fadeout effect completed successfully`);
                console.log(`[${jobId}]    Output file: ${outputPath}`);
                store_1.jobStore.updateStep(jobId, 'fadeout', { status: 'complete', progressPercent: 100 });
                if (!isResolved) {
                    isResolved = true;
                    resolve();
                }
            })
                .on('error', (err) => {
                console.error(`[${jobId}] ❌ Fadeout error:`, err);
                if (!isResolved) {
                    isResolved = true;
                    reject(err);
                }
            })
                .save(outputPath);
        });
    });
}
async function runFFmpegStep(jobId, stepId, input, output, filterComplex) {
    return new Promise((resolve, reject) => {
        let command = (0, ffmpeg_1.ffmpeg)(input);
        if (filterComplex) {
            command = command.audioFilter(filterComplex);
        }
        command
            .on('progress', (progress) => {
            // progress.percent is 0-100, or timemark/frames if input duration unknown
            let percent = 0;
            if (progress.percent) {
                percent = Math.floor(progress.percent);
            }
            // Cap at 95 until it's truly done
            store_1.jobStore.updateStep(jobId, stepId, { progressPercent: Math.min(percent, 95) });
        })
            .on('end', () => {
            store_1.jobStore.updateStep(jobId, stepId, { status: 'complete', progressPercent: 100 });
            resolve();
        })
            .on('error', (err) => {
            console.error(`FFmpeg error in step ${stepId}:`, err);
            reject(err);
        })
            .save(output);
    });
}
// Step 1-3: Stitch -> Denoise -> Silence Compression
async function processAudioCleanup(jobId, jobDir, inputFiles) {
    try {
        console.log(`[${jobId}] Starting audio cleanup with ${inputFiles.length} files`);
        // Step 1: Stitch
        store_1.jobStore.updateStep(jobId, 'stitch', { status: 'active' });
        console.log(`[${jobId}] Step 1: Stitch started`);
        const stitchedPath = path_1.default.join(jobDir, 'stitched.mp3');
        if (inputFiles.length === 1) {
            fs_1.default.copyFileSync(inputFiles[0], stitchedPath);
            store_1.jobStore.updateStep(jobId, 'stitch', { status: 'complete', progressPercent: 100 });
            console.log(`[${jobId}] Step 1 complete (single file copy)`);
        }
        else {
            await new Promise((resolve, reject) => {
                (0, ffmpeg_1.ffmpeg)()
                    .input(`concat:${inputFiles.join('|')}`)
                    .audioCodec('libmp3lame')
                    .audioBitrate('192k')
                    .on('progress', (progress) => {
                    const percent = Math.floor(progress.percent || 0);
                    store_1.jobStore.updateStep(jobId, 'stitch', { progressPercent: Math.min(percent, 95) });
                })
                    .on('end', () => {
                    store_1.jobStore.updateStep(jobId, 'stitch', { status: 'complete', progressPercent: 100 });
                    console.log(`[${jobId}] Step 1 complete (stitched)`);
                    resolve();
                })
                    .on('error', (err) => {
                    console.error(`[${jobId}] Stitch failed:`, err);
                    reject(err);
                })
                    .save(stitchedPath);
            });
        }
        // Step 2: Denoise
        store_1.jobStore.updateStep(jobId, 'noise', { status: 'active' });
        console.log(`[${jobId}] Step 2: Denoise started`);
        const denoisedPath = path_1.default.join(jobDir, 'denoised.mp3');
        await runFFmpegStep(jobId, 'noise', stitchedPath, denoisedPath, 'anlmdn=s=5:p=0.002:r=0.002:m=10');
        console.log(`[${jobId}] Step 2 complete (denoised)`);
        // Step 3: Silence compression - reduce silences longer than 1.5s down to 1s
        store_1.jobStore.updateStep(jobId, 'silence', { status: 'active' });
        console.log(`[${jobId}] Step 3: Silence compression started`);
        const silenceCompressedPath = path_1.default.join(jobDir, 'silence-compressed.mp3');
        await runFFmpegStep(jobId, 'silence', denoisedPath, silenceCompressedPath, 
        // Only compress/trim silences longer than 1.5s, keep at least 1s of silence
        'silenceremove=stop_periods=-1:stop_duration=1.5:stop_threshold=-40dB');
        console.log(`[${jobId}] Step 3 complete (silence compressed)`);
        // Mark all cleanup steps as complete, but don't mark job complete yet
        // (user may still run mixing or thumbnail steps)
        console.log(`[${jobId}] Audio cleanup phase complete!`);
    }
    catch (err) {
        console.error(`[${jobId}] Audio cleanup failed:`, err);
        store_1.jobStore.error(jobId, err.message);
        throw err;
    }
}
// Step 4: Normalize and add music
async function processAudioMixing(jobId, jobDir, musicPath) {
    try {
        console.log(`
[${jobId}] ═══════════════════════════════════════════`);
        console.log(`[${jobId}] Step 4: Audio Mixing (Add Background Music)`);
        console.log(`[${jobId}] ═══════════════════════════════════════════`);
        store_1.jobStore.updateStep(jobId, 'music', { status: 'active' });
        const silenceCompressedPath = path_1.default.join(jobDir, 'silence-compressed.mp3');
        const withMusicPath = path_1.default.join(jobDir, 'with-music.mp3');
        if (!fs_1.default.existsSync(silenceCompressedPath)) {
            throw new Error('silence-compressed.mp3 not found. Run step 1-3 first.');
        }
        console.log(`[${jobId}] ✓ Found cleaned audio: silence-compressed.mp3`);
        console.log(`[${jobId}] Mixing cleaned audio with background music...`);
        console.log(`[${jobId}] (This may take 1-2 minutes for large files)
`);
        // Mix music with the cleaned audio (silence-compressed), cropped to its duration
        await addBackgroundMusic(jobId, silenceCompressedPath, withMusicPath, musicPath);
        console.log(`
[${jobId}] ✅ Background music successfully mixed`);
        console.log(`[${jobId}]    Output duration matches cleaned audio duration`);
        console.log(`[${jobId}] Audio mixing phase complete!
`);
        // Mark music step complete but don't mark job complete yet
        // (user may still run thumbnail generation)
    }
    catch (err) {
        console.error(`
[${jobId}] ❌ Audio mixing failed:`, err);
        store_1.jobStore.error(jobId, err.message);
        throw err;
    }
}
// Step 4.5: Add fade out effect
async function processFadeOut(jobId, jobDir) {
    try {
        console.log(`
[${jobId}] ═══════════════════════════════════════════`);
        console.log(`[${jobId}] Step 4.5: Fade Out Effect`);
        console.log(`[${jobId}] ═══════════════════════════════════════════`);
        store_1.jobStore.updateStep(jobId, 'fadeout', { status: 'active' });
        const withMusicPath = path_1.default.join(jobDir, 'with-music.mp3');
        const withFadeoutPath = path_1.default.join(jobDir, 'with-fadeout.mp3');
        if (!fs_1.default.existsSync(withMusicPath)) {
            throw new Error('with-music.mp3 not found. Run music mixing step first.');
        }
        console.log(`[${jobId}] ✓ Found music audio: with-music.mp3`);
        console.log(`[${jobId}] Adding 3-second fade out effect...`);
        await addFadeOutEffect(jobId, withMusicPath, withFadeoutPath);
        console.log(`
[${jobId}] ✅ Fade out effect successfully applied`);
        console.log(`[${jobId}]    Output file: with-fadeout.mp3`);
        console.log(`[${jobId}] Fade out phase complete!
`);
    }
    catch (err) {
        console.error(`
[${jobId}] ❌ Fade out effect failed:`, err);
        store_1.jobStore.error(jobId, err.message);
        throw err;
    }
}
// Step 5: Generate thumbnail
async function generateThumbnail(jobId, jobDir, thumbnailPrompt) {
    try {
        console.log(`[${jobId}] Starting thumbnail generation`);
        store_1.jobStore.updateStep(jobId, 'thumbnail', { status: 'active' });
        const thumbnailPath = path_1.default.join(jobDir, 'thumbnail.png');
        const geminiApiKey = process.env.GEMINI_API_KEY;
        const prompt = thumbnailPrompt || 'Podcast cover art, professional design';
        if (geminiApiKey) {
            try {
                console.log(`[${jobId}] Using Gemini API for thumbnail`);
                await generateThumbnailWithGemini(prompt, thumbnailPath, geminiApiKey);
                console.log(`[${jobId}] Gemini thumbnail generated successfully`);
            }
            catch (err) {
                console.warn(`[${jobId}] Gemini thumbnail generation failed, using fallback:`, err);
                await generateFallbackThumbnail(thumbnailPath);
                console.log(`[${jobId}] Fallback thumbnail generated`);
            }
        }
        else {
            console.log(`[${jobId}] No GEMINI_API_KEY set, using fallback thumbnail`);
            await generateFallbackThumbnail(thumbnailPath);
        }
        store_1.jobStore.updateStep(jobId, 'thumbnail', { status: 'complete', progressPercent: 100 });
        store_1.jobStore.complete(jobId);
        console.log(`[${jobId}] Thumbnail generation complete!`);
    }
    catch (err) {
        console.error(`[${jobId}] Thumbnail generation failed:`, err);
        store_1.jobStore.error(jobId, err.message);
        throw err;
    }
}
// Legacy: Run all steps at once (for backwards compatibility)
async function processPodcast(jobId, jobDir, inputFiles, thumbnailPrompt) {
    await processAudioCleanup(jobId, jobDir, inputFiles);
    await processAudioMixing(jobId, jobDir);
    await generateThumbnail(jobId, jobDir, thumbnailPrompt);
}
//# sourceMappingURL=pipeline.js.map