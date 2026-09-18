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

Sync-status UI reflects **local** persistence (`Saved on this device` / needs attention) — it does not claim cloud sync success until a remote push is accepted.

Optional sign-in + shared sync backend: see [`docs/p2-w1-real-sync.md`](./docs/p2-w1-real-sync.md). For two physical devices, run `npm run sync-server` and set `EXPO_PUBLIC_WHISK_SYNC_URL`.

## Standards

- Security: [`SECURITY.md`](./SECURITY.md)
- Contributing / test-first: [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- Phase 2 plan: [`docs/phase-2-roadmap.md`](./docs/phase-2-roadmap.md)
