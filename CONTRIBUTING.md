# Contributing to Whisk

Whisk is built as a local-first Expo + React Native + TypeScript app. This note is the contributor (and agent) checklist for branch/PR workflow, review bar, and local-first rules.

## Source of product truth

Prefer these docs (Context store / repo as available):

1. **Phase 2 roadmap** — [`docs/phase-2-roadmap.md`](./docs/phase-2-roadmap.md) (active build plan, P2-W1…P2-W8)
2. **Security standards** — [`SECURITY.md`](./SECURITY.md) (blocking)
3. **Agent rules** — [`AGENTS.md`](./AGENTS.md) (test-first + multi-agent)
4. **Architecture / data layer** — [`docs/architecture.md`](./docs/architecture.md), [`docs/data-layer.md`](./docs/data-layer.md)
5. **MVP roadmap / project context / competitor research / UI guidelines** — Context store when mounted

Do not invent alternate stacks (Firebase-as-primary-DB, Redux-by-default, web-first SPA) without updating the roadmap and project context.

## Test-first development (mandatory)

**Create tests before implementation** so we never invent tests that already pass against existing code.

1. **Red** — Write a Jest (and RNTL when UI) test for the new behavior. Run it and confirm it **fails** for the expected reason.
2. **Green** — Implement only enough production code to make that test pass.
3. **Refactor** — Improve structure with the suite still green.
4. **PR evidence** — Describe the red→green sequence in the PR body (command + failure, then pass).

Exceptions: docs-only/chore PRs with no behavior change; explicit **characterization** tests that lock current behavior (must be labeled as such—not used to “cover” new feature work).

Reviewers **REQUEST_CHANGES** if new behavior lands without a preceding failing test (or a justified exception).

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
7. **Security** — [`SECURITY.md`](./SECURITY.md): no secrets; safe URL/OCR handling; sane export/deletion; Phase 2 authz/tenancy when touched
8. **Tests** — **test-first** evidence; new behavior covered; CI green
9. **Scope** — matches the active roadmap workstream (Phase 2 PRs: no Phase 3); no competitor clones of branding/layout/copy

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

Do not treat automated nutrition, grocery delivery, AI meal recommendations, or a social discovery feed as Phase 2-critical unless [`docs/phase-2-roadmap.md`](./docs/phase-2-roadmap.md) is explicitly updated.
