# W7 — Cook + trust

Feature module for cook mode, guest/local clarity, export, and free-tier limit UX.

## Entry points

| Path                      | Role                                                         |
| ------------------------- | ------------------------------------------------------------ |
| `app/cook/[recipeId].tsx` | Cook mode (steps, multi-timers, hands-free nav, keep-awake)  |
| `features/cook/cookTimers.ts` / `cookStepNavigation.ts` | P2-W8 timer + step boundary helpers |
| `app/recipe/[id].tsx`     | Minimal detail + **Start cooking**                           |
| `app/profile.tsx`         | Guest banner, export, one-time unlock + codes, trash restore |
| `app/(tabs)/add.tsx`      | Limit notice **before** import; manual create unlimited      |
| `app/(tabs)/index.tsx`    | Guest banner, resume cook / sample recipe                    |

## Contracts used (from `@/data`)

- `createOfflineReader` — load recipes offline for cook + export
- `getRepositories().recipes.restore` — trash recovery on Account
- `getRepositories().recipes.update` — mark `cookedAt` on finish

## Trust rules

- Free import limits shown before the action starts (`gateImportAction`).
- `mayShowUpgradePrompt('cook_mode')` / `'unfinished_import'` is always false.
- Export JSON (`whisk-export` v1) available anytime, including after simulated downgrade.

## Monetization

- Unlock is a **one-time** purchase at **$6.99** (not a subscription).
- Influencer **discount codes** (registry in `features/trust/influencerCodes.ts`) can lower the price to **$4.99**.
- Influencer **admin codes** grant unlimited features free on-device.
- Add future influencers by appending to `INFLUENCER_CODE_REGISTRY`.
