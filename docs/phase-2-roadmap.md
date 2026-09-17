# Whisk Phase 2 Roadmap

Build plan for **post-MVP** Whisk. Prefer this file for Phase 2 sequencing and acceptance; keep MVP core-loop trust intact (local-first SQLite, guest path, honest sync status).

**Standards (blocking):** [`SECURITY.md`](../SECURITY.md) · [`CONTRIBUTING.md`](../CONTRIBUTING.md) (test-first) · [`AGENTS.md`](../AGENTS.md)

**MVP baseline tip for this pass:** branch from the integrated Phase C + one-time unlock line (`cursor/one-time-payment-influencer-0fc2` / successor on `main` once merged).

---

## 1. Product thesis (Phase 2)

Phase 1 proved **capture → plan → shop → cook** on-device. Phase 2 makes Whisk work for **households**, **pantry-aware cooking**, **portable libraries**, and **better cook/web surfaces**—without becoming a social network or delivery marketplace (those stay Phase 3).

---

## 2. Locked stack (unchanged unless roadmap updated)

| Layer | Choice |
| --- | --- |
| App | Expo + React Native + TypeScript (strict) |
| Navigation | Expo Router (five tabs: Home · Recipes · Add · Plan · Shop) |
| Persistence | expo-sqlite + typed repositories (local SOT) |
| UI / session | Zustand (not a second recipe DB) |
| Quality | ESLint + Prettier; Jest + RNTL; GitHub Actions |
| Phase 2 sync | Add authenticated sync **beside** local SOT—never replace offline guest loop |

---

## 3. Scope

### In scope (Phase 2)

1. Household collaboration and real-time grocery syncing
2. Pantry tracking and pantry-aware recipe search
3. Reusable meal-plan templates and leftovers
4. Import/export compatibility with Paprika and common formats
5. Browser extension and desktop/web experience
6. Multiple cooking timers and hands-free step navigation

### Explicitly out of scope (Phase 3+)

- Nutrition estimates with provenance
- Dietary/allergen filters as a safety product
- Personalized social-style discovery feed
- Grocery pickup/delivery integrations
- Optional AI substitutions / meal suggestions / cleanup-as-magic

---

## 4. Orchestration (multi-agent)

Mirror MVP Phase A → B → C:

| Stage | Who | Outcome |
| --- | --- | --- |
| **Phase A₂** | Standards + roadmap (this doc + SECURITY + test-first) | Agents have a single build plan |
| **Phase B₂** | One **implementation** cloud agent per workstream P2-W1…P2-W8; separate **review** agent per PR | Draft PRs; APPROVE / REQUEST_CHANGES |
| **Phase C₂** | Integration agent | Merge order below; E2E proof; no Phase 3 creep |

**Rules**

- No shared checkout between implementers.
- **Test-first** on every behavior change ([`AGENTS.md`](../AGENTS.md)).
- Security bar from [`SECURITY.md`](../SECURITY.md).
- Feature agents depend on **published repository contracts**, not each other’s internals.

### Sequencing

```text
P2-W1 (sync/auth foundation)
    └─► P2-W2 (data extensions: household, pantry, templates, compat models)
            ├─► P2-W3 household collab + realtime grocery
            ├─► P2-W4 pantry + pantry-aware search
            ├─► P2-W5 meal-plan templates + leftovers
            ├─► P2-W6 Paprika / common-format I/O
            └─► P2-W7 browser extension + desktop/web
P2-W8 cook v2 (multi-timer + hands-free) may start in parallel with P2-W1
         (cook is local-first; avoid conflicting with W7 web shell)
```

**Integration merge order (Phase C₂):**  
standards/SECURITY (if not on `main`) → **P2-W1 → P2-W2 → P2-W3 → P2-W4 → P2-W5 → P2-W6 → P2-W8 → P2-W7**  
(Adjust only if review notes document a safer graph.)

---

## 5. Workstreams

### P2-W1 — Sync & auth foundation

**Owns:** identity session, secure token storage, sync client contracts, honest sync-status wiring to real transport stubs/impl.

**Acceptance**

- Guest/local core loop still works with network off.
- Sign-in optional; tokens in secure storage (not plain AsyncStorage).
- Sync status reflects local save vs remote attempt per SECURITY.md.
- Test-first: session clear on sign-out; no “Synced” before local persist.

**Avoid:** household UI, pantry schema, web extension shell.

---

### P2-W2 — Data extensions

**Owns:** SQLite migrations + repositories for households/membership, pantry items, meal-plan templates, leftovers links, compat import/export models.

**Acceptance**

- Migrations idempotent; repository contracts published for P2-W3–W6.
- Tenant fields ready for sync (local ids stable).
- Test-first against empty DB and migration-from-MVP schema.

**Avoid:** feature screens beyond stubs; realtime networking.

---

### P2-W3 — Household collaboration

**Owns:** shared library/plan/list membership UX + **real-time grocery syncing**.

**Acceptance**

- Invite/join household; members see shared grocery list updates.
- Conflict policy documented (last-write vs merge) and tested.
- Authz failures never leak another household’s rows.
- Test-first for membership boundary and realtime apply/reorder.

**Avoid:** pantry search, Paprika parsers, web extension.

---

### P2-W4 — Pantry

**Owns:** pantry CRUD + **pantry-aware recipe search**.

**Acceptance**

- Add/update/consume pantry items offline-first.
- Recipe search can boost/filter by pantry coverage with clear copy (not silent).
- Test-first for coverage scoring and empty-pantry behavior.

**Avoid:** delivery integrations; nutrition claims.

---

### P2-W5 — Plan templates & leftovers

**Owns:** reusable meal-plan templates; leftovers workflow into later plan slots.

**Acceptance**

- Save week (or selection) as template; apply to a new week with preview.
- Leftovers create plan entries without destroying source recipe.
- Test-first for apply/undo and leftover linkage.

**Avoid:** grocery merge rewrites owned by MVP W6 unless contract extension agreed.

---

### P2-W6 — Compatibility import/export

**Owns:** **Paprika and common-format** import/export packs behind replaceable adapters.

**Acceptance**

- Import preview + confidence before commit (MVP import rules).
- Export round-trip documented; no silent clobber of user edits.
- Test-first fixtures for at least one Paprika-class fixture and one generic JSON/Markdown pack.

**Avoid:** AI cleanup; social scrapers beyond existing MVP adapters.

---

### P2-W7 — Browser extension & desktop/web

**Owns:** extension capture → Whisk library; desktop/web experience consistent with Yolk & Chick tokens.

**Acceptance**

- Extension can send a recipe draft into the import preview path.
- Web/desktop does not become SOT over mobile SQLite without sync contracts from P2-W1/W2.
- CSP / scheme rules per SECURITY.md.
- Test-first for message-passing validation and rejection of untrusted payloads.

**Avoid:** rebuilding mobile tabs as a marketing site; Phase 3 discovery feed.

---

### P2-W8 — Cook v2 (timers & hands-free)

**Owns:** **multiple cooking timers** + **hands-free step navigation** (voice/large targets/keep-awake already in MVP where present).

**Acceptance**

- Multiple concurrent timers per cook session; clear audible/visual completion.
- Hands-free next/back without leaving cook mode; Reduce Motion respected.
- Test-first for timer concurrency and step index boundaries.
- No payment/destructive UI chrome with chick mascot.

**Avoid:** household sync; web extension.

---

## 6. Engineering bar (Phase 2)

1. **Test-first** — failing test before implementation; no tests written to match already-passing code.
2. **Security** — [`SECURITY.md`](../SECURITY.md) checklist on every PR.
3. **Trust** — autosave, offline, undo/trash, honest sync language.
4. **A11y** — WCAG 2.2 AA targets; cook/hands-free paths especially.
5. **UI** — Yolk & Chick tokens; five-tab IA unless roadmap amends.
6. **Reviews** — separate senior review agent; integration only after APPROVE.

---

## 7. Kickoff template (implementers)

```text
You are Whisk Phase 2 workstream <P2-Wn> (<name>).
Open a draft PR from the Phase 2 base branch.
Do not edit the plan file except merge notes in the PR body.

Read: docs/phase-2-roadmap.md (your section), SECURITY.md, AGENTS.md, CONTRIBUTING.md,
docs/architecture.md, docs/data-layer.md.

Mandatory: test-first (red → green). Show failing test output before implementation.
Stay in Phase 2 scope; no Phase 3 features.
```

Reviewers use the same docs plus the PR template security + test-first checklist.

---

## 8. Success metrics (post soft-launch)

- Household grocery realtime apply latency / conflict rate
- Pantry-aware search → recipe open rate
- Template apply rate; leftovers → plan conversion
- Compat import correction rate; export completion
- Extension capture → saved recipe rate
- Cook sessions using ≥2 timers; hands-free step usage

---

## Document control

| Version | Notes |
| --- | --- |
| 1.0 | Phase 2 multi-agent kickoff — workstreams P2-W1…P2-W8 |
