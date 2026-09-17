# Whisk

Recipe-saving → meal-planning → grocery → cooking. Warm kitchen companion built with Expo.

## Stack

- Expo + React Native + TypeScript (strict)
- Expo Router (five tabs: Home · Recipes · Add · Plan · Shop)
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
```

## Project layout

- `app/(tabs)/` — Home, Recipes, Add, Plan, Shop
- `app/profile.tsx` — Account / settings (modal; not a tab)
- `constants/tokens.ts` — brand and spacing tokens
- `theme/` — light/dark theme + a11y helpers
- `components/ui/` — Button, Text, Screen, SyncStatusBanner, SnackbarShell

## Notes

Local-first foundation: sync-status UI is visible and stubbed for “saved on this device.” Persistence and cloud sync land in later workstreams.
