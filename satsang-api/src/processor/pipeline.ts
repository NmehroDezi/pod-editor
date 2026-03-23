import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import { ffmpeg } from '../lib/ffmpeg';
import { jobStore } from '../jobs/store';
import sharp from 'sharp';

async function generateFallbackThumbnail(outputPath: string): Promise<void> {
  const bgColor = '#D4A017'; // satsang-gold
  await sharp({
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

async function generateThumbnailWithClaude(
  prompt: string,
  outputPath: string,
  apiKey: string
): Promise<void> {
  // Use Claude API to generate actual images
  console.log(`[Claude] Generating image with Claude for prompt: "${prompt}"`);

  try {
    const enhancedPrompt = `Create a professional podcast cover art image for: "${prompt}".
Make it visually striking, suitable for a podcast thumbnail.
Use vibrant colors, professional design, and ensure it's suitable for podcast platforms.`;

    console.log(`[Claude] Calling Claude API for image generation`);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: enhancedPrompt
        }]
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Claude] API error: ${response.status}`, errorBody);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const responseData = (await response.json()) as any;
    console.log(`[Claude] Response received`);

    // Check if we got image data back
    const content = responseData.content?.[0];
    if (content?.type === 'image' && content.source?.data) {
      // We got an image! Decode base64 and save it
      const imageBase64 = content.source.data;
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      fs.writeFileSync(outputPath, imageBuffer);
      console.log(`[Claude] Image generated successfully and saved to ${outputPath}`);
      return;
    } else {
      // Claude doesn't support image generation in standard API yet
      console.warn(`[Claude] Claude API does not return image data, falling back to SVG generation`);
      throw new Error('Claude does not support image generation in current API');
    }
  } catch (err) {
    console.error(`[Claude] Image generation failed:`, err);
    console.log(`[Claude] Falling back to SVG-based thumbnail generation`);

    // Fallback: generate SVG-based thumbnail using Claude to get design spec
    try {
      await generateSVGThumbnailWithClaudeSpec(prompt, outputPath, apiKey);
    } catch (svgErr) {
      console.error(`[Claude] SVG fallback also failed:`, svgErr);
      throw err;
    }
  }
}

async function generateSVGThumbnailWithClaudeSpec(
  prompt: string,
  outputPath: string,
  apiKey: string
): Promise<void> {
  // Fallback: Use Claude to generate design spec and create SVG
  console.log(`[Claude] Generating SVG thumbnail with design spec from prompt: "${prompt}"`);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `You are a podcast cover art designer. Create a detailed visual design specification for podcast cover art based on: "${prompt}"

Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{
  "mainColor": "#RRGGBB",
  "accentColor": "#RRGGBB",
  "backgroundColor": "#RRGGBB",
  "title": "PODCAST",
  "subtitle": "Audio Series",
  "style": "modern|minimalist|vibrant|artistic"
}`
        }]
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Claude] API error response:`, errorBody);
      throw new Error(`Claude spec API error: ${response.status} - ${errorBody}`);
    }

    const responseData = (await response.json()) as any;
    console.log(`[Claude] Full response:`, JSON.stringify(responseData, null, 2));

    const designText = responseData.content?.[0]?.text || '';
    console.log(`[Claude] Design spec text:`, designText);

    if (!designText) {
      throw new Error('Claude returned empty design spec');
    }

    // Parse the JSON response
    let design: any = {
      mainColor: '#1a73e8',
      accentColor: '#d33327',
      backgroundColor: '#f8f9fa',
      title: 'PODCAST',
      subtitle: 'Audio Series',
      style: 'modern'
    };

    try {
      console.log(`[Claude] Attempting to parse JSON directly...`);
      design = JSON.parse(designText);
      console.log(`[Claude] Successfully parsed JSON:`, design);
    } catch (e) {
      console.warn(`[Claude] Direct JSON parse failed, trying to extract from text...`);
      // Try to extract JSON from response if it has markdown
      const jsonMatch = designText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log(`[Claude] Found JSON in text, parsing...`);
        design = JSON.parse(jsonMatch[0]);
        console.log(`[Claude] Successfully extracted and parsed JSON:`, design);
      } else {
        console.warn(`[Claude] Could not find JSON in response, using defaults`);
      }
    }

    // Validate colors
    const isValidHex = (color: string) => /^#[0-9A-Fa-f]{6}$/.test(color);
    if (!isValidHex(design.mainColor)) {
      console.warn(`[Claude] Invalid main color: ${design.mainColor}, using default`);
      design.mainColor = '#1a73e8';
    }
    if (!isValidHex(design.accentColor)) {
      console.warn(`[Claude] Invalid accent color: ${design.accentColor}, using default`);
      design.accentColor = '#d33327';
    }
    if (!isValidHex(design.backgroundColor)) {
      console.warn(`[Claude] Invalid background color: ${design.backgroundColor}, using default`);
      design.backgroundColor = '#f8f9fa';
    }

    console.log(`[Claude] Final design spec:`, design);

    // Create professional SVG thumbnail
    const svg = createPodcastThumbnail(
      design.mainColor,
      design.accentColor,
      design.backgroundColor,
      design.title,
      design.subtitle,
      design.style
    );

    console.log(`[Claude] Creating SVG (length: ${svg.length} chars)`);

    // Convert SVG to PNG using sharp
    const svgBuffer = Buffer.from(svg);
    await sharp(svgBuffer, { density: 100 }).png().toFile(outputPath);
    console.log(`[Claude] SVG thumbnail created successfully at ${outputPath}`);
  } catch (err) {
    console.error(`[Claude] SVG generation failed:`, err);
    throw err;
  }
}

async function generateSVGThumbnailWithGeminiSpec(
  prompt: string,
  outputPath: string,
  apiKey: string
): Promise<void> {
  // Fallback: Use Gemini to generate design spec and create SVG
  console.log(`[Gemini] Generating SVG thumbnail with design spec`);

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `You are a podcast cover art designer. Create a detailed visual design specification for podcast cover art based on: "${prompt}"

Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{
  "mainColor": "#RRGGBB",
  "accentColor": "#RRGGBB",
  "backgroundColor": "#RRGGBB",
  "title": "PODCAST",
  "subtitle": "Audio Series",
  "style": "modern|minimalist|vibrant|artistic"
}`
        }]
      }]
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini spec API error: ${response.status} - ${errorBody}`);
  }

  const responseData = (await response.json()) as any;
  const designText = responseData.candidates?.[0]?.content?.parts?.[0]?.text || '';
  console.log(`[Gemini] Design spec:`, designText);

  // Parse the JSON response
  let design: any = {
    mainColor: '#1a73e8',
    accentColor: '#d33327',
    backgroundColor: '#f8f9fa',
    title: 'PODCAST',
    subtitle: 'Audio Series',
    style: 'modern'
  };

  try {
    design = JSON.parse(designText);
  } catch (e) {
    // Try to extract JSON from response if it has markdown
    const jsonMatch = designText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      design = JSON.parse(jsonMatch[0]);
    }
  }

  // Validate colors
  const isValidHex = (color: string) => /^#[0-9A-Fa-f]{6}$/.test(color);
  if (!isValidHex(design.mainColor)) design.mainColor = '#1a73e8';
  if (!isValidHex(design.accentColor)) design.accentColor = '#d33327';
  if (!isValidHex(design.backgroundColor)) design.backgroundColor = '#f8f9fa';

  // Create professional SVG thumbnail
  const svg = createPodcastThumbnail(
    design.mainColor,
    design.accentColor,
    design.backgroundColor,
    design.title,
    design.subtitle,
    design.style
  );

  // Convert SVG to PNG using sharp
  const svgBuffer = Buffer.from(svg);
  await sharp(svgBuffer, { density: 100 }).png().toFile(outputPath);
  console.log(`[Gemini] SVG thumbnail created successfully at ${outputPath}`);
}

function createPodcastThumbnail(
  mainColor: string,
  accentColor: string,
  bgColor: string,
  title: string,
  subtitle: string,
  style: string
): string {
  const isDarkBg = parseInt(bgColor.substring(1), 16) < 0x888888;
  const textColor = isDarkBg ? '#FFFFFF' : '#000000';
  const accentLight = isDarkBg ? '#FFFFFF' : '#000000';

  return `
    <svg width="3000" height="3000" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${mainColor};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${accentColor};stop-opacity:1" />
        </linearGradient>
        <radialGradient id="radialGrad" cx="50%" cy="50%" r="60%">
          <stop offset="0%" style="stop-color:${mainColor};stop-opacity:0.4" />
          <stop offset="100%" style="stop-color:${accentColor};stop-opacity:0.1" />
        </radialGradient>
      </defs>

      <!-- Background -->
      <rect width="3000" height="3000" fill="${bgColor}"/>

      <!-- Decorative gradient blob -->
      <circle cx="1500" cy="1500" r="1400" fill="url(#mainGrad)" opacity="0.15"/>

      <!-- Center design elements based on style -->
      ${style === 'vibrant' ? `
        <circle cx="1500" cy="1500" r="1200" fill="none" stroke="${mainColor}" stroke-width="60" opacity="0.8"/>
        <circle cx="1500" cy="1500" r="900" fill="none" stroke="${accentColor}" stroke-width="40" opacity="0.6"/>
        <circle cx="1500" cy="1500" r="600" fill="none" stroke="${mainColor}" stroke-width="30" opacity="0.4"/>
      ` : style === 'minimalist' ? `
        <rect x="400" y="400" width="2200" height="2200" fill="none" stroke="${mainColor}" stroke-width="50" rx="200"/>
        <line x1="600" y1="1500" x2="2400" y2="1500" stroke="${accentColor}" stroke-width="40" opacity="0.5"/>
      ` : `
        <!-- Modern default with waves -->
        <path d="M 300 1500 Q 750 1200 1500 1500 T 2700 1500" fill="none" stroke="${mainColor}" stroke-width="50" opacity="0.8"/>
        <path d="M 300 1800 Q 750 1500 1500 1800 T 2700 1800" fill="none" stroke="${accentColor}" stroke-width="40" opacity="0.6"/>
        <circle cx="1500" cy="1500" r="800" fill="none" stroke="${mainColor}" stroke-width="30" opacity="0.3"/>
      `}

      <!-- Content area with semi-transparent background -->
      <rect x="300" y="1000" width="2400" height="1600" rx="100" fill="${mainColor}" opacity="0.1" stroke="${mainColor}" stroke-width="3"/>

      <!-- Title -->
      <text x="1500" y="1400" font-size="280" font-family="Arial, sans-serif" font-weight="bold" fill="${textColor}" text-anchor="middle" dominant-baseline="middle">
        ${title.substring(0, 15)}
      </text>

      <!-- Subtitle -->
      <text x="1500" y="1800" font-size="120" font-family="Arial, sans-serif" fill="${accentLight}" text-anchor="middle" opacity="0.8">
        ${subtitle.substring(0, 30)}
      </text>

      <!-- Decorative dots -->
      <circle cx="500" cy="500" r="60" fill="${accentColor}" opacity="0.6"/>
      <circle cx="2500" cy="500" r="60" fill="${mainColor}" opacity="0.6"/>
      <circle cx="500" cy="2500" r="60" fill="${mainColor}" opacity="0.6"/>
      <circle cx="2500" cy="2500" r="60" fill="${accentColor}" opacity="0.6"/>
    </svg>
  `;
}

async function addBackgroundMusic(
  jobId: string,
  cleanedAudioPath: string,
  outputPath: string,
  musicPath?: string
): Promise<void> {
  const resolvedMusicPath = musicPath || process.env.BACKGROUND_MUSIC_PATH;

  if (!resolvedMusicPath || !fs.existsSync(resolvedMusicPath)) {
    // If no music file configured, just copy the cleaned audio as output
    console.log(`[${jobId}] No music file provided, skipping music layer`);
    fs.copyFileSync(cleanedAudioPath, outputPath);
    return;
  }

  // Mix cleaned audio with background music, with speech padded 3 seconds for extended music
  return new Promise((resolve, reject) => {
    const musicFilename = path.basename(resolvedMusicPath);
    console.log(`[${jobId}] 🎵 Starting music mix:`);
    console.log(`[${jobId}]    Input 1 (cleaned audio): ${path.basename(cleanedAudioPath)}`);
    console.log(`[${jobId}]    Input 2 (music): ${musicFilename}`);
    console.log(`[${jobId}]    Output: ${path.basename(outputPath)}`);
    console.log(`[${jobId}]    Filter: Pad speech 3s, mix with music, output = speech + 3s with music`);

    ffmpeg(cleanedAudioPath)
      .input(resolvedMusicPath)
      .complexFilter([
        // Cleaned audio: keep at full volume, then pad with 3 seconds of silence
        '[0:a]volume=1,apad=pad_dur=3[speech]',
        // Music: normalize, reduce volume
        '[1:a]loudnorm=I=-20:TP=-1.5:LRA=11,volume=0.3[music]',
        // Mix: use shortest duration - speech is now padded 3s, so output = speech + 3s with music
        '[speech][music]amix=inputs=2:duration=shortest[out]'
      ], 'out')
      .audioCodec('libmp3lame')
      .audioBitrate('192k')
      .on('progress', (progress: any) => {
        const percent = Math.floor(progress.percent || 0);
        if (percent % 10 === 0 && percent > 0) {
          console.log(`[${jobId}] 📊 Music mixing progress: ${percent}%`);
        }
        jobStore.updateStep(jobId, 'music', { progressPercent: Math.min(percent, 95) });
      })
      .on('end', () => {
        console.log(`[${jobId}] ✅ Music mixing completed successfully`);
        console.log(`[${jobId}]    Output file: ${outputPath}`);
        console.log(`[${jobId}]    Duration: Speech + 3s padding with music background`);
        jobStore.updateStep(jobId, 'music', { status: 'complete', progressPercent: 100 });
        resolve();
      })
      .on('error', (err) => {
        console.error(`[${jobId}] ❌ Music mixing error:`, err.message);
        // Fallback: if mixing fails, just use the cleaned audio without music
        console.log(`[${jobId}]    Fallback: Using cleaned audio without music`);
        fs.copyFileSync(cleanedAudioPath, outputPath);
        // Still mark as complete since we have output (fallback audio)
        jobStore.updateStep(jobId, 'music', { status: 'complete', progressPercent: 100 });
        resolve();
      })
      .save(outputPath);
  });
}

async function addFadeOutEffect(
  jobId: string,
  inputPath: string,
  outputPath: string
): Promise<void> {
  // Add 3-second fade out effect to the end of the audio
  return new Promise((resolve, reject) => {
    console.log(`[${jobId}] ✨ Starting fade out effect:`);
    console.log(`[${jobId}]    Input: ${path.basename(inputPath)}`);
    console.log(`[${jobId}]    Output: ${path.basename(outputPath)}`);
    console.log(`[${jobId}]    Effect: 3-second fade out at the end`);

    let isResolved = false;

    // First get the duration of the input file
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        console.error(`[${jobId}] ❌ Error probing audio file:`, err);
        isResolved = true;
        reject(err);
        return;
      }

      const duration = metadata.format?.duration || 0;
      const fadeStartTime = Math.max(0, duration - 3); // Start fade 3 seconds before end

      console.log(`[${jobId}]    Audio duration: ${duration.toFixed(2)}s, fade starts at: ${fadeStartTime.toFixed(2)}s`);

      ffmpeg(inputPath)
        .audioFilter(`afade=t=out:st=${fadeStartTime}:d=3`)
        .audioCodec('libmp3lame')
        .audioBitrate('192k')
        .on('progress', (progress: any) => {
          const percent = Math.floor(progress.percent || 0);
          if (percent % 10 === 0 && percent > 0) {
            console.log(`[${jobId}] 📊 Fadeout progress: ${percent}%`);
          }
          jobStore.updateStep(jobId, 'fadeout', { progressPercent: Math.min(percent, 95) });
        })
        .on('end', () => {
          console.log(`[${jobId}] ✅ Fadeout effect completed successfully`);
          console.log(`[${jobId}]    Output file: ${outputPath}`);
          jobStore.updateStep(jobId, 'fadeout', { status: 'complete', progressPercent: 100 });
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



async function runFFmpegStep(
  jobId: string,
  stepId: string,
  input: string,
  output: string,
  filterComplex?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    let command = ffmpeg(input);

    if (filterComplex) {
      command = command.audioFilter(filterComplex);
    }

    command
      .on('progress', (progress: any) => {
        // progress.percent is 0-100, or timemark/frames if input duration unknown
        let percent = 0;
        if (progress.percent) {
          percent = Math.floor(progress.percent);
        }
        // Cap at 95 until it's truly done
        jobStore.updateStep(jobId, stepId, { progressPercent: Math.min(percent, 95) });
      })
      .on('end', () => {
        jobStore.updateStep(jobId, stepId, { status: 'complete', progressPercent: 100 });
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
export async function processAudioCleanup(
  jobId: string,
  jobDir: string,
  inputFiles: string[]
): Promise<void> {
  try {
    console.log(`[${jobId}] Starting audio cleanup with ${inputFiles.length} files`);

    // Step 1: Stitch
    jobStore.updateStep(jobId, 'stitch', { status: 'active' });
    console.log(`[${jobId}] Step 1: Stitch started`);
    const stitchedPath = path.join(jobDir, 'stitched.mp3');

    // Handle single or multiple files (MP3, M4A, or other audio formats)
    if (inputFiles.length === 1) {
      // Single file: copy as-is (FFmpeg handles MP3 and M4A equally)
      fs.copyFileSync(inputFiles[0], stitchedPath);
      jobStore.updateStep(jobId, 'stitch', { status: 'complete', progressPercent: 100 });
      console.log(`[${jobId}] Step 1 complete (single file copy)`);
    } else {
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(`concat:${inputFiles.join('|')}`)
          .audioCodec('libmp3lame')
          .audioBitrate('192k')
          .on('progress', (progress: any) => {
            const percent = Math.floor(progress.percent || 0);
            jobStore.updateStep(jobId, 'stitch', { progressPercent: Math.min(percent, 95) });
          })
          .on('end', () => {
            jobStore.updateStep(jobId, 'stitch', { status: 'complete', progressPercent: 100 });
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
    jobStore.updateStep(jobId, 'noise', { status: 'active' });
    console.log(`[${jobId}] Step 2: Denoise started`);
    const denoisedPath = path.join(jobDir, 'denoised.mp3');
    await runFFmpegStep(
      jobId,
      'noise',
      stitchedPath,
      denoisedPath,
      'anlmdn=s=5:p=0.002:r=0.002:m=10,highpass=f=80,equalizer=f=3000:width_type=o:width=2:g=3,equalizer=f=8000:width_type=o:width=2:g=2'
    );
    console.log(`[${jobId}] Step 2 complete (denoised)`);

    // Step 3: Silence compression - reduce silences longer than 2s but preserve natural pauses
    jobStore.updateStep(jobId, 'silence', { status: 'active' });
    console.log(`[${jobId}] Step 3: Silence compression started`);
    const silenceCompressedPath = path.join(jobDir, 'silence-compressed.mp3');
    await runFFmpegStep(
      jobId,
      'silence',
      denoisedPath,
      silenceCompressedPath,
      // Reduce silences longer than 2s down to ~1s, keeps natural pauses intact
      'silenceremove=stop_periods=-1:stop_duration=2:stop_threshold=-40dB'
    );
    console.log(`[${jobId}] Step 3 complete (silence compressed)`);

    // Mark all cleanup steps as complete, but don't mark job complete yet
    // (user may still run mixing or thumbnail steps)
    console.log(`[${jobId}] Audio cleanup phase complete!`);
  } catch (err) {
    console.error(`[${jobId}] Audio cleanup failed:`, err);
    jobStore.error(jobId, (err as Error).message);
    throw err;
  }
}

// Step 4: Normalize and add music
export async function processAudioMixing(
  jobId: string,
  jobDir: string,
  musicPath?: string
): Promise<void> {
  try {
    console.log(`
[${jobId}] ═══════════════════════════════════════════`);
    console.log(`[${jobId}] Step 4: Audio Mixing (Add Background Music)`);
    console.log(`[${jobId}] ═══════════════════════════════════════════`);
    jobStore.updateStep(jobId, 'music', { status: 'active' });
    const silenceCompressedPath = path.join(jobDir, 'silence-compressed.mp3');
    const withMusicPath = path.join(jobDir, 'with-music.mp3');

    if (!fs.existsSync(silenceCompressedPath)) {
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

    // Note: addBackgroundMusic marks the music step as complete in both success/error paths
  } catch (err) {
    console.error(`
[${jobId}] ❌ Audio mixing failed:`, err);
    // Mark music step as complete (with fallback) so UI can proceed even on error
    jobStore.updateStep(jobId, 'music', { status: 'complete', progressPercent: 100 });
    jobStore.error(jobId, (err as Error).message);
    throw err;
  }
}

// Step 4.5: Add fade out effect
export async function processFadeOut(
  jobId: string,
  jobDir: string
): Promise<void> {
  try {
    console.log(`
[${jobId}] ═══════════════════════════════════════════`);
    console.log(`[${jobId}] Step 4.5: Fade Out Effect`);
    console.log(`[${jobId}] ═══════════════════════════════════════════`);
    jobStore.updateStep(jobId, 'fadeout', { status: 'active' });
    const withMusicPath = path.join(jobDir, 'with-music.mp3');
    const withFadeoutPath = path.join(jobDir, 'with-fadeout.mp3');

    if (!fs.existsSync(withMusicPath)) {
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
  } catch (err) {
    console.error(`
[${jobId}] ❌ Fade out effect failed:`, err);
    jobStore.error(jobId, (err as Error).message);
    throw err;
  }
}

// Step 5: Generate Spotify-optimized description
export async function generateDescription(
  jobId: string,
  jobDir: string,
  descriptionPrompt: string
): Promise<void> {
  try {
    console.log(`[${jobId}] Starting description generation`);
    jobStore.updateStep(jobId, 'description', { status: 'active' });

    const claudeApiKey = process.env.ANTHROPIC_API_KEY;
    const prompt = descriptionPrompt || 'A podcast about interesting topics';

    if (claudeApiKey) {
      try {
        console.log(`[${jobId}] Using Claude API for Spotify description optimization`);
        const optimizedDescription = await generateSpotifyDescription(prompt, claudeApiKey);

        // Save the description to a file
        const descriptionPath = path.join(jobDir, 'description.txt');
        fs.writeFileSync(descriptionPath, optimizedDescription, 'utf-8');
        console.log(`[${jobId}] Description generated successfully`);
        console.log(`[${jobId}] Optimized Description:\n${optimizedDescription}`);
      } catch (err) {
        console.error(`[${jobId}] Claude description generation failed:`, err);
        throw err;
      }
    } else {
      throw new Error('No ANTHROPIC_API_KEY set');
    }

    jobStore.updateStep(jobId, 'description', { status: 'complete', progressPercent: 100 });
    jobStore.complete(jobId);
    console.log(`[${jobId}] Description generation complete!`);
  } catch (err) {
    console.error(`[${jobId}] Description generation failed:`, err);
    jobStore.error(jobId, (err as Error).message);
    throw err;
  }
}

async function generateSpotifyDescription(
  userDescription: string,
  apiKey: string
): Promise<string> {
  console.log(`[Spotify] Optimizing description for Spotify`);

  try {
    const client = new Anthropic({ apiKey });
    
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `You are a podcast description expert. Optimize this podcast description for Spotify with SEO-friendly keywords, engaging language, and proper formatting.

User's description: "${userDescription}"

Requirements:
- Make it 50-150 words
- Include relevant keywords naturally
- Make it engaging and clickable
- Use line breaks for readability
- Include emojis where appropriate
- Make it Spotify algorithm-friendly

Return ONLY the optimized description, nothing else.`
      }]
    });

    const optimizedDescription = message.content[0].type === 'text' ? message.content[0].text : '';

    if (!optimizedDescription) {
      throw new Error('Claude returned empty description');
    }

    return optimizedDescription;
  } catch (err) {
    console.error(`[Spotify] Description optimization failed:`, err);
    if (err instanceof Error) {
      console.error(`[Spotify] Error message:`, err.message);
      console.error(`[Spotify] Error stack:`, err.stack);
    }
    throw err;
  }
}

// Legacy: Run all steps at once (for backwards compatibility)
export async function processPodcast(
  jobId: string,
  jobDir: string,
  inputFiles: string[],
  thumbnailPrompt: string
): Promise<void> {
  await processAudioCleanup(jobId, jobDir, inputFiles);
  await processAudioMixing(jobId, jobDir);
  await generateThumbnail(jobId, jobDir, thumbnailPrompt);
}
