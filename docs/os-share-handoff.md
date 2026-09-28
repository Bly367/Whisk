# OS Share → Whisk

Native share intent integration for iOS and Android, enabling users to share recipes from Instagram, TikTok, YouTube, and browsers directly into Whisk.

## Overview

This feature allows users to tap "Share" in other apps and have Whisk automatically try caption → linked recipe → audio → remaining links. There is no caption or paste box in the share flow.

## Implementation

### Architecture

1. **expo-share-intent** (v8.0+ for Expo SDK 57) — Native module that receives share intents from iOS and Android
2. **Share intent parser** (`import/shareIntent.ts`) — Parses incoming share data and preserves shared text
3. **Share payload store** (`import/sharePayloadStore.ts`) — Zustand store for passing share data safely between the handoff and importer
4. **Share intent handler** (`import/shareIntentHandler.ts`) — React hook that listens for shares and navigates to import screen
5. **Import/share screen** (`app/import/share.tsx`) — UI that receives shared data from the store and starts the automatic import

### Files Changed

- `app.json` — Added expo-share-intent plugin with iOS/Android configuration
- `package.json` — Added expo-share-intent dependency
- `app/_layout.tsx` — Added share intent handler to root layout
- `app/import/share.tsx` — Updated to consume one payload from the store
- `import/shareIntent.ts` — Share intent parsing logic (preserves newlines in captions)
- `import/shareIntentHandler.ts` — React hook for handling incoming shares (stores payload, navigates without query params)
- `import/sharePayloadStore.ts` — One-shot Zustand store for passing share data without query param truncation
- `import/index.ts` — Exported share intent utilities
- `__tests__/shareIntent.test.ts` — Unit tests for share parsing (multiline caption preservation)

### Configuration

**iOS:** Accepts text and web URLs via share extension

```json
{
  "NSExtensionActivationSupportsText": true,
  "NSExtensionActivationSupportsWebURLWithMaxCount": 1,
  "NSExtensionActivationSupportsWebPageWithMaxCount": 1
}
```

**Android:** Accepts text MIME types via intent filter

```json
{
  "androidIntentFilters": ["text/*"]
}
```

### How It Works

1. User taps "Share" in Instagram/TikTok/YouTube/browser
2. User selects "Whisk" from share sheet
3. `expo-share-intent` receives the share data (URL, text)
4. `useShareIntentHandler` hook parses the data and extracts URL + caption (preserving newlines)
5. Parsed payload is stored in the one-shot share payload store
6. App navigates to `/import/share`
7. The import screen consumes the payload and starts automatically
8. Automatic import tries caption, linked recipes, audio, and remaining links, then marks saved recipes for review with undo

## Testing

### Unit Tests

Run tests with:

```bash
npm test -- shareIntent.test.ts
```

Tests cover:

- URL-only shares (webUrl field)
- URL + caption shares
- Text-only shares (no URL)
- Instagram, TikTok, YouTube URL patterns
- Browser shares
- Multi-line captions
- Whitespace trimming
- Caption extraction

### Manual Testing on Device

**Prerequisites:**

- Dev client build (Expo Go does not support share extensions)
- Physical iOS device or Android device/emulator

**Building dev client:**

```bash
# Clean prebuild
npx expo prebuild --clean

# iOS (requires Mac)
npx expo run:ios --device

# Android
npx expo run:android --device
```

**Test scenarios:**

1. **Instagram post URL:**
   - Open Instagram app
   - Tap Share on a recipe post
   - Select "Whisk"
   - Verify URL and caption pre-filled

2. **TikTok video URL:**
   - Open TikTok app
   - Tap Share on a recipe video
   - Select "Whisk"
   - Verify URL pre-filled (caption if provided)

3. **YouTube video URL:**
   - Open YouTube app
   - Tap Share on a recipe video
   - Select "Whisk"
   - Verify the recipe is imported automatically

4. **Safari/Chrome URL:**
   - Open recipe website in browser
   - Tap Share button
   - Select "Whisk"
   - Verify URL pre-filled


## Rebuild Requirements

**When changes require rebuild:**

- Changes to `app.json` plugins
- Changes to iOS activation rules
- Changes to Android intent filters
- First-time setup of share extension

**After rebuild:**

- Uninstall old app from device
- Install new dev client build
- Test share functionality

**EAS Build:** When building production/preview builds via EAS, the share extension is automatically configured. No extra steps required.

## Limitations

- **No video bytes:** Share intents receive URLs and text only, not video file data. This is by design — URLs + captions are sufficient for import.
- **Expo Go unsupported:** Share extensions require native code. Use dev client builds.
- **Social URL-only shares:** Instagram/TikTok often only provide URLs without captions (OS limitation). Whisk tries public metadata and audio when available, then offers a clear retry/manual fallback.
- **Caption preservation:** When text IS present, multiline captions (with ingredients/steps on separate lines) are fully preserved via in-memory store, not truncated by query param limits.

## Library Selection

**Why expo-share-intent:**

- Actively maintained with Expo SDK 57 support (v8.0+)
- 100k+ weekly downloads, proven reliability
- Identical behavior on iOS and Android
- Supports URL and text sharing (our exact use case)
- Better than experimental expo-sharing (which may break in future iOS releases)

## Future Enhancements

Not in scope for this PR:

- Image/video file sharing (currently URL + text only)
- Custom iOS share extension UI (uses main app view)
- Share history / recent shares
- Share from Whisk to other apps (outgoing shares)

## References

- [expo-share-intent GitHub](https://github.com/achorein/expo-share-intent)
- [expo-share-intent npm](https://www.npmjs.com/package/expo-share-intent)
- [Expo Linking docs](https://docs.expo.dev/guides/linking/)
