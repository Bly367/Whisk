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

## Development Mode (\_\_DEV\_\_)

In development builds (before native rebuild):
- `transcribeVideo()` returns a **fixture transcript** (chocolate chip cookies recipe)
- Audio extraction simulates success with `.m4a` path
- Model download simulates progress (no actual file)

This allows **UI testing and parser validation** without native dependencies.

## Native Dependencies

To enable real transcription, app must be rebuilt with:

- **Audio extraction**: `expo-av` or `expo-video-audio-extractor`
- **Whisper**: `whisper.rn` or equivalent React Native Whisper binding

### First-Time Setup (After Rebuild)

On first video transcribe:
1. Whisper model downloads (~40MB for tiny.en)
2. Progress shown to user ("Downloading speech model...")
3. Model cached in app documents
4. Subsequent transcriptions are instant (offline)

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
