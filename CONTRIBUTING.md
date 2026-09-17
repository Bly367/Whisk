# Contributing to Whisk

Whisk is built as a local-first Expo + React Native + TypeScript app. This note is the contributor (and agent) checklist for branch/PR workflow, review bar, and local-first rules.

## Source of product truth

Prefer these docs (Context store / repo as available):

1. **MVP roadmap** — workstreams W1–W8, acceptance criteria, locked stack
2. **Project context** — durable brief and non-negotiables
3. **Competitor research** — product/trust requirements
4. **UI/UX guidelines** — Yolk & Chick tokens, nav, a11y, copy

Do not invent alternate stacks (Firebase-as-primary-DB, Redux-by-default, web-first SPA) without updating the roadmap and project context.

## Branch & PR workflow

1. Branch from `main` using a descriptive name (Cloud Agents: `cursor/<short-name>-####`).
2. Keep PRs scoped to one workstream / one concern.
3. Open a **draft** PR early; mark ready when acceptance criteria and CI are green.
4. Use the PR template checklist (acceptance, a11y, offline/trust, no secrets, UI tokens).
5. Feature workstreams (W3–W7) need a **separate reviewer** (not the author) before integration merge.
6. Prefer files your workstream owns; if you must touch shared foundation files (`package.json`, app entrypoints, tokens), keep the diff minimal and document **merge notes** in the PR body.

### Suggested scripts (after the Expo app / `package.json` lands)

```json
{
  "lint": "eslint .",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "typecheck": "tsc --noEmit",
  "test": "jest"
}
```

W8 ships ESLint (flat `eslint.config.js`), Prettier, strict `tsconfig.base.json`, Jest config, and CI. Until W1 merges `package.json` and installs tooling deps, CI skips Node jobs and only verifies that standards files are present. **Once `package.json` exists, CI fails if `lint`, `typecheck`, or `test` scripts are missing** (no soft-pass).

## Review bar

Every workstream PR should be checked for:

1. **Correctness** vs roadmap acceptance for that workstream
2. **Trust / loss-prevention** — autosave, offline, undo, no silent bad imports, honest sync status
3. **UI guidelines** — tokens, five-tab nav, copy voice, chick usage
4. **Accessibility** — targets, labels, contrast, Reduce Motion (WCAG 2.2 AA)
5. **Efficiency** — no unnecessary re-renders, N+1 queries, dead code
6. **Type safety & errors** — strict TypeScript; loading / empty / offline / error paths designed
7. **Security basics** — no secrets; safe URL/OCR handling; sane export/deletion
8. **Tests** — new behavior covered or justified; CI green
9. **Scope** — no Phase 2/3 features; no competitor clones of branding/layout/copy

## Local-first rules

- **SQLite is the source of truth** for recipes, plans, grocery lists, and trash. Domain writes go through typed repositories only.
- **Zustand is UI/session only** (nav chrome, sheets, sync-banner presentation)—not a second recipe database.
- **Never celebrate success before local persistence succeeds.** Sync may follow in the background.
- **Importer adapters are replaceable.** Paste / photo / manual fallbacks must always remain available.
- Feature modules depend on **published repository contracts**, not each other's internals.
- Guest / local mode must complete the core loop without an account.

## CI

GitHub Actions runs on pull requests and pushes to `main`:

- If `package.json` is **absent**: skip Node jobs; confirm standards files exist
- If `package.json` is **present**: require `lint`, `typecheck`, and `test` scripts (fail if any are missing), then run them

See `docs/architecture.md` for known-good ESLint 9 flat-config deps and `tsconfig` merge notes with W1.

## Out of scope reminders

Do not treat automated nutrition, grocery delivery, AI meal recommendations, or a social discovery feed as MVP-critical unless the roadmap is explicitly updated.
