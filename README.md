# Whisk

A recipe import and organization app — Inspo-inspired, with a darker editorial UI.

## Run

```bash
npm start
```

Scan the QR code with Expo Go on your phone, or press `w` for web.

## What's built

- **Library** — browse recipes in a grid with folder filters and search
- **Import** — local schema.org recipe extraction, editable review, and manual entry
- **Mobile sharing** — incoming iOS/Android text and URL shares via Expo Sharing
- **Recipe detail** — ingredients, steps, macro breakdown, serving scaler
- **Cook Mode** — full-screen step-by-step cooking flow
- **Meal Plan & Grocery Lists** — UI placeholders for v2

## Stack

- Expo 57 + React Native
- Expo Router (file-based navigation)
- Zustand + AsyncStorage (local persistence)

## Social import backend

Ordinary recipe sites are parsed locally first. Social links and unstructured pages use the
Supabase Edge Function in `supabase/functions/import-recipe`.

1. Create a Supabase project and install the Supabase CLI.
2. Set function secrets:

```bash
supabase secrets set OPENAI_API_KEY=... OPENAI_MODEL=gpt-5-mini ALLOWED_ORIGIN=*
```

3. Deploy and copy `.env.example` to `.env`, then fill in the function URL and anon key.

```bash
supabase functions deploy import-recipe
```

The social fallback intentionally does not scrape or download protected media. If a public
post does not expose enough permitted recipe information, Whisk asks the user for its caption,
screenshots, or a media file they own.

## Native Share Sheet

Incoming sharing changes native configuration, so use an Expo development build rather than
Expo Go:

```bash
npx expo prebuild
npx expo run:android
```

Use an EAS iOS development build to validate the share extension on a physical iPhone.

## Verification

```bash
npm run typecheck
npm test
```

## Next steps

1. Photo and cookbook OCR import
2. User-supplied video transcription and on-screen text extraction
3. Meal planning + smart grocery lists
4. Premium subscription (RevenueCat)
