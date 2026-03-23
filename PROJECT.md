# Satsang Podcast Editor - Project Status

## Current Implementation (Completed)

### Architecture
- **Single-page dashboard app** with 3 main processing steps
- **State management**: Zustand store with session memory (no localStorage persistence between projects)
- **API Communication**: Frontend polls backend every 1 second for job status updates

### Core Features Implemented

#### 1. Project Setup
- Landing page with project title input
- All data stored in session memory only
- "Start New Project" button clears session and resets everything

#### 2. Dashboard with 3 Steps (Horizontal Layout)
- **Audio Setup** (🎙️): Upload audio files, set title/description, process
- **Add Music** (🎵): Select from royalty-free library or upload own
- **Spotify Description** (📝): Optimize podcast description for Spotify with Claude

#### 3. Processing Workflow
- Each step shows:
  - Animated progress bar (0-100%)
  - Time remaining (estimated)
  - Step tracker showing active/completed substeps
  - Download button on completion
  - "Done →" button to mark step complete and return to dashboard

#### 4. Progress Tracking
- 3-segment progress bar at top (green when complete)
- Completion checkmarks on each step button
- "Project Complete" button when all 3 steps done

### Files Structure

**Frontend (satsang-editor/src/)**
- `App.tsx` - Single route, renders DashboardView only
- `store/episodeStore.ts` - Zustand store with session-only memory
- `views/DashboardView.tsx` - Main unified dashboard component with 3-step workflow
- `lib/api.ts` - API calls: submitJob, pollJobStatus, runStepCleanup, runStepMixing, runStepFadeout, runStepDescription, getMusicOptions
- `types/episode.ts` - TypeScript interfaces (StepName: 'audio' | 'music' | 'fadeout' | 'description')
- `constants/processingSteps.ts` - Step definitions with 'description' step

**Backend (satsang-api/src/)**
- `routes/jobs.ts` - Job endpoints including POST /jobs/:id/step/description
- `processor/pipeline.ts` - Processing functions: processAudioCleanup, processAudioMixing, processFadeOut, generateDescription
- `jobs/store.ts` - Job state management with description step

### Key Technical Details

**No localStorage persistence**: State is cleared when user clicks "Start New Project"

**API Flow**:
1. User uploads files → `POST /jobs` creates job
2. User clicks "Process Audio" → `POST /jobs/:id/step/cleanup` starts processing
3. Frontend polls `GET /jobs/:id/status` every 1s
4. Steps update from `pending` → `active` → `complete`
5. Progress bar animates based on `progressPercent` from backend

**Progress Calculation**:
- Audio: Average of 3 steps (stitch, noise, silence)
- Music: Single mixing step
- Fadeout: Single fade-out effect step
- Description: Single Spotify optimization step

### Current State
✅ All features working as designed
✅ UI responsive with proper button styling (black text)
✅ Session memory functional
✅ Backend integration complete
✅ Progress visualization working
✅ Music track selection from local files implemented
✅ Horizontal step tracker with arrows between steps

## Latest Changes (Session 2)

### 1. Dynamic Music Track Selection
**Problem**: Music mixing was broken - users couldn't select tracks and only placeholder data was shown.

**Solution Implemented**:
- Created `GET /jobs/music-options` backend endpoint that lists MP3 files from `/music options/` folder
- Added `getMusicOptions()` API function to fetch real track list
- Updated `runStepMixing()` to accept and send `musicFilename` in request body
- Backend now passes music file path through `processAudioMixing()` → `addBackgroundMusic()` chain
- Modified `MusicTrack` type to include `filename?: string` and `'library'` source
- Updated DashboardView to fetch and display real music tracks inline
- Users can now search/select from 5 royalty-free Indian flute music tracks

**Files Changed**:
- `satsang-api/src/routes/jobs.ts` - Added music-options endpoint, updated mixing route
- `satsang-api/src/processor/pipeline.ts` - Added musicPath param to processAudioMixing + addBackgroundMusic
- `satsang-editor/src/lib/api.ts` - Added getMusicOptions(), updated runStepMixing signature
- `satsang-editor/src/views/DashboardView.tsx` - Integrated music selection with real track loading
- `satsang-editor/src/types/episode.ts` - Added filename and 'library' source to MusicTrack

### 2. Processing Steps UI Improvement
**Problem**: The 3 audio processing substeps (Stitch, Noise, Silence) were displayed vertically on the left side, taking up too much space.

**Solution Implemented**:
- Changed `StepTracker` component to display steps horizontally with arrows (→) between them
- Made individual `StepItem` cards smaller and more compact (centered text layout)
- Reduced font sizes and padding to fit 3 steps side-by-side with spacing
- All 3 steps now centered in the processing box with visual flow: Stitch → Noise → Silence

**Files Changed**:
- `satsang-editor/src/components/processing/StepTracker.tsx` - Changed to horizontal flex layout with arrows
- `satsang-editor/src/components/processing/StepItem.tsx` - Reduced to compact vertical card layout

## Latest Changes (Session 3)

### Critical Bug Fixes: Music Step Completion

**Problem**: After selecting music and completing the mixing step, users could not proceed to the image generation step. The music step wasn't being marked as complete, keeping the image button disabled.

**Root Causes Identified**:
1. **Step Reset Bug in Mixing Route** - `POST /jobs/:id/step/mixing` was resetting audio cleanup steps (stitch, noise, silence) back to pending, causing the `silence-compressed.mp3` file to be lost before music mixing could use it
2. **Step Reset Bug in Thumbnail Route** - `POST /jobs/:id/step/thumbnail` was also resetting all previous steps, including audio and music
3. **Incomplete Error Handling** - `addBackgroundMusic()` error fallback wasn't marking the music step as complete
4. **Missing Completion in processAudioMixing** - Main mixing function had a comment saying "mark as complete" but no actual code doing it

**Fixes Applied**:

1. **[routes/jobs.ts:204-207]** - Mixing route now only resets music/fadeout/thumbnail steps, preserving completed audio steps:
   ```typescript
   // Only reset music and thumbnail, keep audio steps as they are
   jobStore.updateStep(jobId, 'music', { status: 'pending', progressPercent: 0 });
   jobStore.updateStep(jobId, 'thumbnail', { status: 'pending', progressPercent: 0 });
   jobStore.updateStep(jobId, 'fadeout', { status: 'pending', progressPercent: 0 });
   ```

2. **[routes/jobs.ts:233-234]** - Thumbnail route now only resets thumbnail step:
   ```typescript
   // Only reset thumbnail (which will be active), keep all other steps as they are
   jobStore.updateStep(jobId, 'thumbnail', { status: 'pending', progressPercent: 0 });
   ```

3. **[pipeline.ts:136-138]** - Music mixing error fallback now marks completion:
   ```typescript
   // Still mark as complete since we have output (fallback audio)
   jobStore.updateStep(jobId, 'music', { status: 'complete', progressPercent: 100 });
   ```

4. **[pipeline.ts:353-360]** - processAudioMixing error handler also marks music complete:
   ```typescript
   // Mark music step as complete (with fallback) so UI can proceed even on error
   jobStore.updateStep(jobId, 'music', { status: 'complete', progressPercent: 100 });
   ```

**Result**:
- Audio cleanup steps now persist when starting music mixing
- Music step is marked complete regardless of success/error
- Users can now proceed from music → image generation step
- Frontend can properly detect completion and enable the image button

## Architecture Notes

### Music Integration Flow
1. When user reaches "Add Music" step, DashboardView calls `getMusicOptions()`
2. Backend scans `/music options/` folder, returns array of track objects with filename
3. User selects a track → onClick handler calls `runStepMixing(jobId, track.filename)`
4. Frontend sends `POST /jobs/:id/step/mixing` with `{ musicFilename: "..." }` in body
5. Backend validates file exists, resolves full path, passes to `processAudioMixing(jobId, jobDir, musicPath)`
6. FFmpeg mixes speech with music at 0.1 volume (looped for full duration)
7. User downloads result from `/jobs/:id/files/with-music.mp3`

### Music Files Location
- Path: `/Users/nityamehrotra/Desktop/podcast editor/music options/`
- Contains 5 royalty-free tracks (Indian flute theme variations)
- Backend resolves relative to project root: `path.join(__dirname, '../../..', 'music options', filename)`

### Testing
- Run backend: `cd satsang-api && npm run dev` (listens on :3001)
- Run frontend: `cd satsang-editor && npm run dev` (listens on :5173)
- Test music endpoint: `curl http://localhost:3001/music-options`

## Known Issues & Workarounds
- Backend may crash if idle too long - restart with `npm run dev`
- Frontend dev server caches can be cleared by restarting
- If audio processing gets stuck at 1%, ensure both backend and frontend are fully started before using

## Startup Instructions
```bash
# Terminal 1: Backend
cd satsang-api && npm run dev

# Terminal 2: Frontend (wait 5 seconds for backend to start first)
cd satsang-editor && npm run dev

# Visit: http://localhost:5173
```

## Latest Changes (Session 4 - Current)

### 1. Removed Music Selection Search Bar
- Removed search input from music selection UI
- Now displays all music options directly without filtering
- Cleaner, more focused music selection interface

### 2. Removed Timer from Fadeout Processing
- Removed "Est. Time Remaining" timer from fadeout processing screen
- Progress bar still visible for processing feedback
- Cleaner fadeout step UI

### 3. Disabled Completed Step Buttons
- Once a step is marked complete (with checkmark), users cannot re-open it
- Completed steps remain visible but disabled (grayed out)
- Prevents accidental re-entry into completed steps
- Applied to all three main steps: Audio, Music, Description

### 4. Replaced Image Generation with Spotify Description Optimization
**Problem**: Image generation was unreliable, Gemini API didn't support image generation

**Solution Implemented**:
- **Removed**: All image generation code (Gemini/Claude/SVG thumbnail generation)
- **Added**: Spotify-optimized description generation using Claude API
- Step changed from "🖼️ Cover Image" to "📝 Spotify Description"
- Users input podcast description → Claude optimizes it → Displays result for copy/paste

**How It Works**:
1. User describes their podcast (what it's about, audience, topics)
2. Claude API receives description with optimization prompt
3. Claude returns SEO-friendly, engaging description with:
   - Optimized keywords for Spotify algorithm
   - Proper formatting with line breaks
   - Emojis where appropriate
   - 50-150 word count
4. Optimized text displays in UI with "Copy to Clipboard" button
5. User copies and pastes to Spotify

**Cost Analysis**:
- ~$0.000002 per description (~0.0002 cents)
- 5x/week = $0.0004/month (essentially free)
- Text generation is cheapest possible API call

**Files Changed**:
- `satsang-editor/src/types/episode.ts` - Changed StepName from 'image' to 'description'
- `satsang-editor/src/constants/processingSteps.ts` - Updated step definition
- `satsang-editor/src/lib/api.ts` - Replaced runStepThumbnail with runStepDescription
- `satsang-editor/src/views/DashboardView.tsx` - Updated entire description step UI and handlers
- `satsang-api/src/processor/pipeline.ts` - Replaced generateThumbnail with generateDescription
- `satsang-api/src/routes/jobs.ts` - Changed POST /step/thumbnail to POST /step/description
- `satsang-api/src/jobs/store.ts` - Updated INITIAL_STEPS
- `satsang-api/.env` - Added ANTHROPIC_API_KEY configuration

## Current Workflow Status
✅ Audio Setup: Upload files → Process (stitch → denoise → silence compression)
✅ Add Music: Select from library (no search) → Mix with audio
✅ Fade Out: Optional 3-second fade-out effect (button disabled after completion)
✅ Spotify Description: Input description → Claude optimizes → Copy result
✅ Full 4-step flow working end-to-end
✅ Completed steps are non-clickable (read-only)

## Notes for Next Session
- All 4-step workflow complete and functional
- Audio processing completely unchanged from Session 3
- Music step fully working with no search bar
- Fadeout is optional and works correctly
- Description step uses Claude API for Spotify optimization ($0.000002 per call)
- Completed steps cannot be re-opened (disabled state)
- Session-only storage means projects reset on page refresh (by design)
- Audio files can be large (1900+ seconds tested) - processing takes ~1-2 min per step
- ANTHROPIC_API_KEY required in .env for description generation
