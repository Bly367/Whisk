# W7 — Cook + trust

Feature module for cook mode, guest/local clarity, export, and free-tier limit UX.

## Entry points

| Path                      | Role                                                           |
| ------------------------- | -------------------------------------------------------------- |
| `app/cook/[recipeId].tsx` | Cook mode (steps, keep-awake, persisted progress)              |
| `app/recipe/[id].tsx`     | Minimal detail + **Start cooking**                             |
| `app/profile.tsx`         | Guest banner, export, trial copy, deletion stub, trash restore |
| `app/(tabs)/add.tsx`      | Limit notice **before** import; manual create unlimited        |
| `app/(tabs)/index.tsx`    | Guest banner, resume cook / sample recipe                      |

## Contracts used (from `@/data`)

- `createOfflineReader` — load recipes offline for cook + export
- `getRepositories().recipes.restore` — trash recovery on Account
- `getRepositories().recipes.update` — mark `cookedAt` on finish

## Trust rules

- Free import limits shown before the action starts (`gateImportAction`).
- `mayShowUpgradePrompt('cook_mode')` / `'unfinished_import'` is always false.
- Export JSON (`whisk-export` v1) available anytime, including after simulated downgrade.
