# Whisk architecture

Short engineering map for agents and contributors. Matches the locked stack in the MVP roadmap.

## Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| App | Expo + React Native + TypeScript (strict) | One codebase for iOS/Android |
| Navigation | Expo Router | Five tabs: Home · Recipes · Add · Plan · Shop |
| Persistence | expo-sqlite + typed repositories | Local-first; offline by default |
| UI / session | Zustand | Ephemeral UI only—not domain storage |
| Quality | ESLint + Prettier; Jest + React Native Testing Library | GitHub Actions on every PR |

## Source of truth

```text
UI / session (Zustand) ──► repositories ──► SQLite (domain SOT)
                              ▲
                     import adapters (replaceable)
```

- **SQLite** holds recipes, ingredients, tags/collections, meal plans, grocery lists/items, and trash/recovery.
- **Zustand** holds UI and session concerns: tab chrome, ephemeral sheets, sync-banner presentation, guest session flags. It must not become a second recipe database.
- **Repositories** are the only write path for domain data. Feature UI must not open ad-hoc SQLite connections.
- **Never celebrate success before local persistence succeeds.** Visible sync status may show `Saved locally` / `Syncing` / `Synced` / `Needs attention` even before cloud sync ships.

## Import adapter pattern

Importers are **replaceable adapters** behind a shared interface (website, social/share sheet, OCR/photo). Contracts:

1. Produce an editable **preview** before commit; flag low-confidence fields.
2. On failure, never insert a blank or silently wrong recipe—offer paste / scan / manual fallbacks.
3. Retain source URL/image for comparison when available.
4. Re-import must not overwrite user edits without explicit choice.

Adapters live behind a stable import API so social parsers can be swapped when upstream APIs change.

## Workstream boundaries

| ID | Owns | Avoid |
| --- | --- | --- |
| W1 | Expo scaffold, tokens, five-tab shell, a11y primitives | Domain schema, feature CRUD |
| W2 | SQLite schema, repositories, autosave, offline read, sync-status model | Feature screens beyond stubs |
| W3 | Manual recipe CRUD, library, tags, search, serving scale | Import parsers, grocery merge |
| W4 | Import adapters, preview/confidence, share sheet + OCR | Meal plan / shop logic |
| W5 | Weekly meal planner | Grocery merge implementation |
| W6 | Grocery generate/merge/aisle/provenance/undo | Cook mode / export |
| W7 | Cook mode, guest mode, export, free-tier limits UX | Competing nav shells |
| W8 | CI, ESLint/Prettier/Jest configs, CONTRIBUTING, PR template, this doc | App entrypoints owned by W1 |

Feature modules (W3–W7) depend on **published W2 repository contracts**, not each other's internals.

## Tooling enablement (W1 merge)

W8 ships:

- `.eslintrc.cjs` + `.prettierrc.json` (Expo RN + TypeScript)
- `jest.config.js` + `__tests__/standards.smoke.test.ts`
- `.github/workflows/ci.yml` (detects `package.json`; no-ops Node jobs until the app lands)
- `.github/PULL_REQUEST_TEMPLATE.md` + `CONTRIBUTING.md`

**When W1 merges `package.json`**, add (or confirm) these scripts and install matching deps so CI becomes a hard gate:

```json
{
  "scripts": {
    "lint": "eslint .",
    "format": "prettier --check .",
    "typecheck": "tsc --noEmit",
    "test": "jest"
  },
  "devDependencies": {
    "eslint": "^9",
    "eslint-config-expo": "latest",
    "eslint-config-prettier": "latest",
    "prettier": "latest",
    "jest": "latest",
    "jest-expo": "latest",
    "@testing-library/react-native": "latest"
  }
}
```

If a foundation branch already used Vitest, prefer switching `npm test` to Jest + RNTL to match the roadmap, or document a temporary dual-runner in the merge PR—do not leave CI without a test script.

## Conflict guidance with W1

- Do **not** overwrite Expo app entrypoints (`App.tsx`, `app/_layout.tsx`, tab screens, `index.ts`) from standards work.
- CI under `.github/workflows/ci.yml` is owned by W8; if W1 also added a workflow, keep the package-detection / graceful skip behavior and fold any extra W1 checks in carefully.
- Keep `package.json` edits minimal and call them out in the PR body.
