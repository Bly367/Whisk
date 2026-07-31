# Release setup and physical-device QA

## One-time EAS setup

1. Run `npm ci`, sign in with EAS CLI, and run `eas init` to link the app to the correct Expo account. This adds the account-specific EAS project ID; no account ID is committed yet.
2. Configure `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the EAS `development`, `preview`, and `production` environments. Values embedded with `EXPO_PUBLIC_` are readable in the app and must not be privileged service-role credentials.
3. Let EAS manage Android and iOS signing credentials, or have the release owner provide the existing store credentials when prompted.
4. Build internal device artifacts with `eas build --platform all --profile preview`. Build store artifacts with `eas build --platform all --profile production`.

The `development` profile is an internal physical-device build and explicitly enables demo recipes. Local development only enables them when both Expo development mode and `EXPO_PUBLIC_ENABLE_DEMO_DATA=true` are present. Preview and production explicitly disable demo recipes.

The project does not currently depend on `expo-dev-client`. If that dependency is added later, set `developmentClient: true` on the development profile to turn it into a development-client build.

## Physical-device QA

Run this checklist on a current iPhone and Android device using a preview build:

- [ ] **Clean install:** App opens to an empty recipe library with starter folders and no demo recipes.
- [ ] **Share sheet:** With Whisk closed and open, share a recipe URL and plain text from Safari/Chrome and another app. Confirm Whisk appears as a target, opens the import flow, and preserves the shared content.
- [ ] **Camera:** Start a photo import, grant camera permission, capture a page, and reach review. Deny permission once and confirm the app recovers without crashing.
- [ ] **Gallery:** Select a screenshot and a cookbook photo, confirm each reaches review, then cancel the picker and confirm no import is created.
- [ ] **Deep links:** Open `whisk://` and `whisk://import/url` from the platform link-testing tool. Confirm the app launches and routes correctly from both terminated and background states.
- [ ] **Authentication:** Create an account, sign out, sign back in, reset password, export library, delete account, test invalid credentials, and relaunch to verify session restoration.
- [ ] **Sync:** Import a unique recipe, sync it, sign in on a second device, and confirm recipes, folders, meal plan, and grocery checks arrive. Confirm a new/empty account never receives demo recipes. Background the app offline, make a change, reconnect, and confirm pending sync recovers.
- [ ] **Images:** Confirm imported and edited images display after reinstall/second device via private storage paths.
- [ ] **Imports:** Exercise a schema.org recipe URL, manual entry, shared URL/text, photo import, and social fallback. Confirm duplicate canonical URLs are not saved twice and failed imports show a recoverable error.
- [ ] **Accessibility:** VoiceOver/TalkBack can navigate tabs, recipe cards, account actions, grocery checkboxes, and meal plan slots.
- [ ] **Release smoke test:** Relaunch offline, background/foreground the app, verify persisted data, then reconnect and sync without data loss or duplicate records.

Record the OS versions, build URLs/IDs, account used, and any failures in the release ticket.
