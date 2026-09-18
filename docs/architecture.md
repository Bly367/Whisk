# Whisk architecture

Short engineering map for agents and contributors. Matches the locked stack in the MVP roadmap; Phase 2 extensions are sequenced in [`phase-2-roadmap.md`](./phase-2-roadmap.md). Security baseline: [`../SECURITY.md`](../SECURITY.md). Test-first policy: [`../CONTRIBUTING.md`](../CONTRIBUTING.md) / [`../AGENTS.md`](../AGENTS.md).

## Stack

| Layer        | Choice                                                 | Notes                                         |
| ------------ | ------------------------------------------------------ | --------------------------------------------- |
| App          | Expo + React Native + TypeScript (strict)              | One codebase for iOS/Android                  |
| Navigation   | Expo Router                                            | Five tabs: Home · Recipes · Add · Plan · Shop |
| Persistence  | expo-sqlite + typed repositories                       | Local-first; offline by default               |
| UI / session | Zustand                                                | Ephemeral UI only—not domain storage          |
| Quality      | ESLint + Prettier; Jest + React Native Testing Library | GitHub Actions on every PR                    |

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

Reference helpers live in `lib/standards/localPersistence.ts` (covered by Jest contract tests).

## Import adapter pattern

Importers are **replaceable adapters** behind a shared interface (website, social/share sheet, OCR/photo). Contracts:

1. Produce an editable **preview** before commit; flag low-confidence fields.
2. On failure, never insert a blank or silently wrong recipe—offer paste / scan / manual fallbacks.
3. Retain source URL/image for comparison when available.
4. Re-import must not overwrite user edits without explicit choice.

Adapters live behind a stable import API so social parsers can be swapped when upstream APIs change.

## Browser extension & web/desktop (P2-W7)

- Protocol + validation: `@/lib/extension` (`whisk.extension.capture` v1).
- Extension shell: `extension/` (MV3, CSP, `activeTab` + `scripting` only).
- Capture landing: `app/extension/capture` → validates → import session preview (`/import/preview`).
- **SOT:** web/desktop is a capture/preview relay (`WEB_DESKTOP_SOT_POLICY`); mobile SQLite remains canonical until P2-W1/W2 sync contracts are used. Do not treat the web shell as a second recipe database.
- Schemes: allow `https:` and documented `whisk:` only; reject `javascript:`, `file:`, `data:`, cleartext `http:`.
- Web CSP: `WHISK_WEB_CSP` applied in `app/+html.tsx`.

## Workstream boundaries

| ID  | Owns                                                                     | Avoid                         |
| --- | ------------------------------------------------------------------------ | ----------------------------- |
| W1  | Expo scaffold, tokens, five-tab shell, a11y primitives                   | Domain schema, feature CRUD   |
| W2  | SQLite schema, repositories, autosave, offline read, sync-status model   | Feature screens beyond stubs  |
| W3  | Manual recipe CRUD, library, tags, search, serving scale                 | Import parsers, grocery merge |
| W4  | Import adapters, preview/confidence, share sheet + OCR                   | Meal plan / shop logic        |
| W5  | Weekly meal planner                                                      | Grocery merge implementation  |
| W6  | Grocery generate/merge/aisle/provenance/undo                             | Cook mode / export            |
| W7  | Cook mode, guest mode, export, free-tier limits UX                       | Competing nav shells          |
| W8  | CI, ESLint/Prettier/Jest/TS configs, CONTRIBUTING, PR template, this doc | App entrypoints owned by W1   |

Feature modules (W3–W7) depend on **published W2 repository contracts**, not each other's internals.

## Tooling enablement (W1 merge)

W8 ships:

- `eslint.config.js` — **flat config** for Expo SDK 53+ (`eslint-config-expo/flat` + `eslint-config-prettier`)
- `.prettierrc.json` / `.prettierignore`
- `tsconfig.base.json` — strict compiler options Whisk requires
- `tsconfig.json` — extends the base (merge with W1’s Expo `tsconfig` — see below)
- `jest.config.js` + contract tests under `__tests__/`
- `.github/workflows/ci.yml` — skips Node jobs until `package.json` exists; **fails** if `lint` / `typecheck` / `test` scripts are missing once it does
- `.github/PULL_REQUEST_TEMPLATE.md` + `CONTRIBUTING.md`

### Required scripts + known-good deps

When W1 merges `package.json`, CI will **hard-fail** unless these scripts exist and pass:

```json
{
  "scripts": {
    "lint": "eslint .",
    "format": "prettier --check .",
    "typecheck": "tsc --noEmit",
    "test": "jest"
  },
  "devDependencies": {
    "eslint": "^9.0.0",
    "eslint-config-expo": "~57.0.0",
    "eslint-config-prettier": "^10.0.0",
    "prettier": "^3.0.0",
    "typescript": "~5.9.0",
    "jest": "^29.0.0",
    "jest-expo": "~57.0.0",
    "@types/jest": "^29.0.0",
    "@testing-library/react-native": "^13.0.0"
  }
}
```

Pin `eslint-config-expo` / `jest-expo` to the same major as the Expo SDK (W1 currently targets Expo 57). Flat config requires **ESLint 9**; do not reintroduce `.eslintrc.*` alongside `eslint.config.js`.

### TypeScript merge with W1

W1 often ships:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": { "strict": true, "paths": { "@/*": ["./*"] } }
}
```

Preferred merge: keep W8’s `tsconfig.base.json`, and make root `tsconfig.json`:

```json
{
  "extends": ["./tsconfig.base.json", "expo/tsconfig.base"],
  "compilerOptions": {
    "paths": { "@/*": ["./*"] }
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules", "dist", "web-build", ".expo", "coverage", "android", "ios"]
}
```

(`extends` as an array needs TypeScript 5+.) Do not drop `tsconfig.base.json` strict flags without an explicit standards decision.

### Jest + RNTL

- Contract tests (`localPersistence`, CI workflow) run under plain Jest and must stay green.
- **RNTL component tests wait on W1** (Expo app entry + `jest-expo` native mocks). After W1 lands, add a shell primitive RNTL sample (e.g. tab bar / Button) and keep `@testing-library/react-native` in devDependencies.

If a foundation branch used Vitest, switch `npm test` to Jest (or dual-run temporarily)—CI requires a `test` script that exercises this harness.

## Conflict guidance with W1

- Do **not** overwrite Expo app entrypoints (`App.tsx`, `app/_layout.tsx`, tab screens, `index.ts`) from standards work.
- CI under `.github/workflows/ci.yml` is owned by W8; preserve package detection **and** the required-scripts hard fail when resolving conflicts with any W1 workflow.
- Keep `package.json` / `tsconfig.json` edits minimal and call them out in the PR body.
