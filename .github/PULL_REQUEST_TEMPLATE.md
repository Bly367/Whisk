## Pull request checklist

### Workstream & acceptance

- [ ] Matches the MVP roadmap acceptance criteria for this workstream
- [ ] Scope stays in Phase 1 / MVP (no Phase 2/3 features sneaking in)
- [ ] Linked roadmap / issue / workstream ID in the description

### Trust & offline

- [ ] Autosave / offline / undo / trash paths considered where relevant
- [ ] No silent bad imports; preview/confidence before commit when importing
- [ ] Sync status honest (never celebrate success before local persistence)
- [ ] Guest/local-first path not broken

### Accessibility

- [ ] Touch targets meet 44×44 (iOS) / 48×48 (Android) guidance
- [ ] Interactive controls have accessible names/roles
- [ ] No color-only meaning; Reduce Motion respected where motion is added
- [ ] Dynamic type does not clip essential recipe/cook text

### UI tokens & brand

- [ ] Colors come from Yolk & Chick design tokens (no hardcoded purple / generic AI palette)
- [ ] Five-tab nav only (Home · Recipes · Add · Plan · Shop); settings not a sixth tab
- [ ] Chick unused on payment / destructive paths

### Security & hygiene

- [ ] No secrets, API keys, or credentials committed
- [ ] Safe handling of URLs / OCR / user content
- [ ] Export / deletion paths sane when touched

### Quality gate

- [ ] `lint` / `typecheck` / `test` pass locally (or CI green once `package.json` exists)
- [ ] New behavior covered by Jest + RNTL (or justified why not)
- [ ] PR description includes merge notes if touching shared foundation files
