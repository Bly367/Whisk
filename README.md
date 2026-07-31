# Whisk

A recipe import and organization app — Inspo-inspired, with a darker editorial UI.

## Run

```bash
npm start
```

Scan the QR code with Expo Go on your phone, or press `w` for web.

## What's built

- **Library** — browse, search, folder filters, and folder management
- **Import** — website JSON-LD, authenticated social/AI fallback, photo OCR, review screen
- **Meal Plan** — dated weeks with breakfast/lunch/dinner and servings
- **Grocery Lists** — merged quantities from the plan plus manual items
- **Accounts** — email auth, sync, export, password reset, and account deletion
- **Cook Mode** — full-screen step-by-step cooking flow

## Stack

- Expo 57 + React Native
- Expo Router (file-based navigation)
- Zustand + AsyncStorage (local persistence)
- Supabase Auth, Database, Storage, and Edge Functions

## Setup

1. Copy `.env.example` to `.env.local` and fill in Supabase values.
2. Apply migrations: `npx supabase db push`
3. Deploy functions:

```bash
npx supabase functions deploy import-recipe --use-api
npx supabase functions deploy import-recipe-image --use-api
npx supabase functions deploy store-recipe-image --use-api
```

4. Set Edge Function secrets for OpenAI and publishable keys as needed.

See [privacy policy](docs/PRIVACY.md) and the [release QA checklist](docs/RELEASE_QA.md).

## Verification

```bash
npm run typecheck
npm test
```

## Native Share Sheet

Incoming sharing changes native configuration, so use an Expo development/preview build rather than Expo Go:

```bash
npx expo prebuild
eas build --profile preview --platform all
```
