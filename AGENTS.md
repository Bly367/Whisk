# Agent instructions — Whisk

Operating rules for Cursor Cloud Agents and other automated contributors. Humans should also read [`CONTRIBUTING.md`](./CONTRIBUTING.md) and [`SECURITY.md`](./SECURITY.md).

## Source of truth

1. [`docs/phase-2-roadmap.md`](./docs/phase-2-roadmap.md) — active Phase 2 build plan (P2-W1…P2-W8)
2. MVP history / architecture — [`docs/architecture.md`](./docs/architecture.md), [`docs/data-layer.md`](./docs/data-layer.md)
3. [`SECURITY.md`](./SECURITY.md) — security standards (blocking)
4. [`CONTRIBUTING.md`](./CONTRIBUTING.md) — workflow, local-first rules, **test-first** policy
5. Context store (when mounted): project-context, competitor research, UI/UX guidelines

Do not invent alternate stacks or Phase 3 scope unless the Phase 2 roadmap is explicitly updated.

## Test-first (mandatory)

**Write the failing test before production code.** This prevents “tests we are already passing.”

For every behavior change:

1. **Red** — Add or extend a Jest (and RNTL when UI) test that expresses the acceptance criterion. Run it; confirm it **fails** for the right reason.
2. **Green** — Implement the minimum code to make that test pass.
3. **Refactor** — Clean up with tests still green.
4. **Evidence** — PR description must note the red→green sequence (command + expected failure, then pass). Do not commit greenfield tests that pass against pre-existing code unless the PR is explicitly a characterization/regression harness and labeled as such.

Skip test-first only for pure docs/chore with no behavior change.

## Multi-agent process

- One workstream → one branch → one draft PR.
- Implementation agents do not self-approve; a **separate review agent** checks the review bar (including security + test-first evidence).
- Prefer files your workstream owns; document merge notes for shared foundation touches.
- Coordinator integrates only after senior review **APPROVE**.

## Security

Follow [`SECURITY.md`](./SECURITY.md). No secrets in commits. Safe URL/OCR handling. Honest entitlement and export/deletion paths.
