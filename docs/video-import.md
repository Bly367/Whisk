# Video Import — Social Recipe Transcription

**Ship date:** Phase 2, Week 5 (thin vertical slice)  
**Owner:** Whisk team  
**Status:** ✅ Implemented

## Overview

Whisk accepts **shared video files** from Instagram Reels, TikTok, YouTube Shorts, and other social media, transcribes the audio **on-device** using Whisper, and feeds the transcript into the existing caption→recipe parser.

This solves the iOS friction where copying captions from Instagram/TikTok is difficult or impossible in-app.

## Key Design Decisions

### What We Do NOT Do

- **❌ Do not download videos from URLs** — IG/TikTok in-app Share usually sends URL only. Downloading from CDN URLs violates ToS, is fragile (auth tokens, rate limits), and is not local-first.
- **❌ Do not use cloud transcription APIs** — Privacy, cost, and offline-first principles require on-device processing.

### What We DO

1. **Accept shared video files** — User saves Reel/video to Photos, then shares the video file to Whisk.
2. **Extract audio on-device** — Using Expo/React Native audio utilities (no GPL ffmpeg).
3. **Transcribe on-device with Whisper** — Using `whisper.rn` with tiny.en or base.en model (~40MB, downloaded once, cached in app documents).
4. **Parse transcript as caption** — Feed transcript into existing `draftFromPastedText` parser (same path as manual caption paste).

## User Flow

### Happy Path: Save → Share → Transcribe → Import

1. User sees an Instagram Reel or TikTok recipe video.
2. User taps **Save** (Instagram: "Save to Collection" or Photos; TikTok: "Save Video").
3. From Photos app (or Files), user taps **Share** → **Whisk**.
4. Whisk receives the video file, shows "Video ready — transcribe to recipe".
5. User taps **Transcribe Video** button.
6. Whisk:
   - Extracts audio from video (16kHz mono WAV/M4A)
   - Transcribes audio with Whisper (offline, on-device)
   - Fills the caption field with transcript
7. User reviews/edits transcript, taps **Continue**.
8. Recipe parses and goes to preview screen as usual.

### Fallback: URL-Only Share (No Video File)

When user shares from inside Instagram/TikTok app (not from Photos):
- IG/TikTok sends **URL only** (no video file).
- Whisk shows: _"This [social source] link needs the post caption to create a recipe. Paste the full caption text below, or save the Reel to Photos and share the video file for automatic transcription."_

This is **UX honesty** — we tell users why we need the caption or video file.

## Technical Architecture

### Share Intent Plugin Config

**`app.json`** — Updated `expo-share-intent` plugin:

```json
{
  "iosActivationRules": {
    "NSExtensionActivationSupportsText": true,
    "NSExtensionActivationSupportsWebURLWithMaxCount": 1,
    "NSExtensionActivationSupportsWebPageWithMaxCount": 1,
    "NSExtensionActivationSupportsMovieWithMaxCount": 1,
    "NSExtensionActivationSupportsImageWithMaxCount": 1
  },
  "androidIntentFilters": [
    "text/*",
    "video/*",
    "image/*"
  ]
}
```

### Share Intent Parsing

**`import/shareIntent.ts`** — Extended `ParsedShareIntent` type:

```typescript
export type ParsedShareIntent = {
  url?: string;
  text?: string;
  caption?: string;
  videoPath?: string;   // Local file path to video
  imagePath?: string;   // Local file path to image (OCR path)
  mimeType?: string;    // MIME type of file
};
```

### Pending Share Payload

**`import/pendingSharePayload.ts`** — Ephemeral storage for video/image paths (too large for URL params):

```typescript
export type SharePayload = {
  url?: string;
  caption?: string;
  videoPath?: string;
  imagePath?: string;
  mimeType?: string;
};
```

### Transcription Pipeline

**`import/transcribe/index.ts`** — Main interface:

```typescript
export async function transcribeVideo(
  videoPath: string,
  options?: {
    language?: 'en' | 'auto';
    modelSize?: 'tiny' | 'base';
    onProgress?: (stage: 'extracting' | 'transcribing', progress: number) => void;
  },
): Promise<
  { ok: true; transcript: string; metadata: WhisperTranscriptResult } 
  | { ok: false; error: TranscribeVideoError }
>;
```

**Pipeline steps:**

1. **Audio extraction** (`import/transcribe/audioExtract.ts`):
   - Extracts audio track from video as 16kHz mono WAV/M4A
   - Uses Expo AV or `expo-video-audio-extractor` (no GPL dependencies)
   - Returns audio file path + duration

2. **Whisper transcription** (`import/transcribe/whisper.ts`):
   - Transcribes audio with `whisper.rn` native module
   - Model: `tiny.en` (default, ~40MB) or `base.en` (~140MB)
   - Downloads model on first use (lazy init with progress callback)
   - Model cached in app documents (persistent, offline-ready)
   - Returns transcript text + segments + language + duration

3. **Cleanup**:
   - Deletes extracted audio file after transcription

### Share Screen UI

**`app/import/share.tsx`** — Updated UI states:

- **No video**: Show normal URL + caption fields
- **Video ready**: Show "Video ready to transcribe" hero, hide caption field until transcribed
- **Transcribing**: Show progress bar (extracting 0-30%, transcribing 30-100%)
- **Transcribed**: Fill caption field with transcript, allow review/edit before import

## Native Dependencies & Installation

### Required Packages

Real transcription requires these native modules:

1. **`whisper.rn`** — On-device Whisper inference (version 0.7.4+)
2. **`expo-video-audio-extractor`** — Audio extraction from video (version 0.1.0+)
3. **`expo-file-system`** — File management (included in Expo SDK)
4. **`buffer`** — Node.js Buffer polyfill for Metro bundling (required by `safe-buffer` dependency)

### Installation Steps

These dependencies are already installed in `package.json`. To enable them in your development build:

```bash
# 1. Dependencies are already in package.json, just install
npm install

# 2. For iOS: Install CocoaPods dependencies
cd ios && npx pod-install && cd ..

# 3. Build development client with EAS (REQUIRED)
# Choose the platform you want to build for:

# iOS development build (requires Apple Developer account)
npm run eas:dev:ios:device

# OR Android development build
npm run eas:dev:android

# 4. Install the development build on your device when ready
# Follow the QR code or download link from EAS Build
```

**Important:** These native modules **do NOT work in Expo Go**. You must use a development build or production build.

**Metro Bundling:** The `whisper.rn` package depends on `safe-buffer`, which requires the Node.js `buffer` polyfill for Metro to resolve properly. The app includes a global `Buffer` polyfill in `app/_layout.tsx` to ensure Metro can bundle the app for device/dev-client builds.

### EAS Build Profiles

The app already has EAS build profiles configured in `eas.json`. The relevant profile for development builds is:

- **`development-device`** (iOS) — Builds a development client for physical devices
- **`development`** (Android) — Builds a development client for Android devices

### First-Time Setup (After Rebuild)

On first video transcribe:
1. Whisper model downloads (~40MB for `ggml-tiny.en.bin`, ~140MB for `ggml-base.en.bin`)
2. Progress shown to user ("Downloading speech model...")
3. Model cached in app documents directory (`FileSystem.documentDirectory`)
4. Subsequent transcriptions are instant (offline, no re-download)

### Model Files

Models are downloaded from HuggingFace on first use:
- **tiny.en** (default): `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin`
- **base.en**: `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin`

The app defaults to `tiny.en` for faster transcription and smaller download size.

## Privacy & Security

- **All processing on-device** — No audio/video uploaded to cloud
- **Transcript never leaves device** unless user explicitly saves recipe to cloud sync (separate feature)
- **Model download** is one-time, from official Whisper model CDN
- **Hostile file paths rejected** — `file://`, `javascript:`, etc. filtered in `parseShareIntent`

## Performance

- **Model size**: tiny.en ~40MB, base.en ~140MB (one-time download)
- **Transcription speed**: ~5-10x realtime on modern devices (45s video → 5-10s transcription)
- **Audio extraction**: <2s for typical video
- **Total time**: 5-15s for 30-60s video

## Testing

### Unit Tests

**`__tests__/shareIntent.test.ts`**:
- ✅ Parse video file share with URL
- ✅ Parse video file share without URL
- ✅ Parse image file share
- ✅ Prioritize first video when multiple files
- ✅ Ignore non-video/image files

**`__tests__/transcribe.test.ts`**:
- ✅ Transcribe video and return text
- ✅ Report progress during transcription
- ✅ Parse recipe from video transcript fixture
- ✅ Handle transcript with social media fluff

### Manual Testing (After Native Rebuild)

1. Save an Instagram Reel with recipe to Photos
2. From Photos, share video to Whisk
3. Verify "Video ready to transcribe" UI
4. Tap "Transcribe Video"
5. Verify progress bar updates
6. Verify transcript fills caption field
7. Verify transcript is editable
8. Import and verify recipe quality

## Known Limitations & Future Work

### Current Limitations

- **English only** — tiny.en and base.en models are English-only. Non-English videos will produce gibberish.
- **Audio quality dependent** — Background music, heavy accents, or poor audio quality may reduce accuracy.
- **Social fluff** — Transcripts include "Hey everyone!", "Don't forget to like and subscribe!", etc. Parser is robust to this but not perfect.
- **No speaker diarization** — Multi-speaker videos (e.g., cooking shows with hosts + guests) are transcribed as one stream.

### Phase 3+ Enhancements (Out of Scope)

- **Multi-language support** — Use multilingual Whisper models or language detection
- **Transcript editing UI** — Rich text editor with timestamps for precise corrections
- **Video thumbnail preview** — Show video thumbnail in share screen
- **Background transcription** — Transcribe in background, notify when ready
- **Batch transcription** — Accept multiple videos, queue transcriptions
- **OCR + Whisper fusion** — For videos with on-screen text (e.g., ingredient overlays), combine OCR and audio transcription

## Out of Scope (Intentionally)

- **URL → Video download** — Violates ToS, fragile, not local-first
- **Cloud transcription APIs** — Privacy, cost, offline-first violation
- **Video editing / trimming** — Not a video editor; use Photos app
- **Live transcription** — Record video in-app with live transcription (separate feature)

## References

- **Product decision**: Brian, 2026-09-21 (see PR description)
- **Whisper.rn**: https://github.com/mybigday/whisper.rn (or equivalent React Native Whisper binding)
- **expo-share-intent**: https://github.com/achorein/expo-share-intent
- **Phase 2 roadmap**: `docs/phase-2-roadmap.md` (P2-W5)
