# Whisk

Recipe-saving → meal-planning → grocery → cooking. Warm kitchen companion built with Expo.

## Stack

- Expo + React Native + TypeScript (strict)
- Expo Router (five tabs: Home · Recipes · Add · Plan · Shop)
- **expo-sqlite** + typed repositories (local-first source of truth)
- Zustand for UI/session only (sync banner) — not recipe storage
- Yolk & Chick design tokens

## Run

```bash
npm install
npx expo start
```

Then open in Expo Go, an iOS/Android simulator, or press `w` for web.

**Note:** OCR requires a **development build** (not Expo Go). To use OCR:

```bash
# iOS (requires iOS 16+)
npx expo run:ios

# Android (requires API 21+)
npx expo run:android
```

OCR works on iOS Simulator using Apple Vision as a fallback. On physical devices, it uses Google ML Kit for better accuracy.

Other scripts:

```bash
npm run ios
npm run android
npm run web
npm run typecheck
npm test
```

## Project layout

- `app/(tabs)/` — Home, Recipes, Add, Plan, Shop
- `app/profile.tsx` — Account / settings (modal; not a tab)
- `data/` — SQLite schema, repositories, autosave, offline reads, sync-status store
- `docs/data-layer.md` — contracts for feature modules
- `docs/phase-2-roadmap.md` — Phase 2 multi-agent build plan (P2-W1…P2-W8)
- `SECURITY.md` — security standards (blocking)
- `AGENTS.md` / `CONTRIBUTING.md` — agent workflow + **test-first** policy
- `constants/tokens.ts` — brand and spacing tokens
- `theme/` — light/dark theme + a11y helpers
- `components/ui/` — Button, Text, Screen, SyncStatusBanner, SnackbarShell

## Data layer (W2)

SQLite is the source of truth for recipes, meal plans, grocery lists, and trash/recovery.
Feature workstreams import shared types and repositories from `@/data` (see `docs/data-layer.md`).

Sync-status UI reflects **local** persistence (`Saved on this device` / needs attention) — it does not claim cloud sync success.

## OCR / Photo import

Whisk supports recipe OCR via `expo-mlkit-ocr` (on-device, local-first):

- **iOS:** Requires iOS 16+. Uses Apple Vision on Simulator, Google ML Kit on device.
- **Android:** Requires API 21+. Uses Google ML Kit (requires Google Play services).
- **Development build required:** OCR needs native modules; it won't work in Expo Go.

### Testing OCR

**Unit tests** run against a mock and don't require a device:

```bash
npm test -- __tests__/import.test.ts
```

**Manual testing** (device/simulator):

1. Build a development client: `npx expo run:ios` or `npx expo run:android`
2. Navigate to **Add → Scan recipe**
3. Take a photo or select an image with visible recipe text
4. Review the extracted draft in the preview screen
5. Edit as needed and save

**Simulator notes:** iOS Simulator supports OCR via Apple Vision. Android emulator needs Google Play services.

## Standards

- Security: [`SECURITY.md`](./SECURITY.md)
- Contributing / test-first: [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- Phase 2 plan: [`docs/phase-2-roadmap.md`](./docs/phase-2-roadmap.md)
