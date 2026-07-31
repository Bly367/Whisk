# Release setup and physical-device QA

## One-time EAS setup

1. [x] Run `npm ci`, sign in with EAS CLI, and run `eas init` to link the app. Project: `@bly367/whisk` (`91ce0701-d346-4cbd-a029-c4da1786b1df`).
2. [x] Configure `EXPO_PUBLIC_*` secrets in EAS `development`, `preview`, and `production` environments (Supabase URL/key, import APIs, password-reset deep link).
3. [x] Android signing: EAS generated a cloud-managed keystore for internal/preview builds.
4. [ ] iOS signing: run interactively once (Apple Developer account required for ad-hoc/internal distribution + share extension profile):
   ```powershell
   npx eas-cli@latest build -p ios -e preview
   ```
5. [x] Android preview build started for physical-device QA:
   https://expo.dev/accounts/bly367/projects/whisk/builds/86c1663e-346f-4b68-a1fb-3ecf5bcefb37
6. [ ] Production store builds after QA passes:
   ```powershell
   npx eas-cli@latest build -p all -e production
   ```

The `development` profile is an internal physical-device build and explicitly enables demo recipes. Local development only enables them when both Expo development mode and `EXPO_PUBLIC_ENABLE_DEMO_DATA=true` are present. Preview and production explicitly disable demo recipes.

## Physical-device QA

Install the preview build on a current Android device (and iOS after the interactive credential setup). Check each item on-device:

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

### Agent coverage note

Automated release setup (EAS link, env vars, Android credentials, Android preview build kickoff, encryption/version config) can be done without a handset. Camera, share sheet, VoiceOver/TalkBack, and true multi-device sync still require installing the preview build on your phone/tablet.
