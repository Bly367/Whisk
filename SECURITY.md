# Whisk Security Standards

Professional security baseline for Whisk (local-first Expo + React Native + TypeScript). Every contributor and agent must follow this document. Reviewers treat violations as **REQUEST_CHANGES**.

Related: [`CONTRIBUTING.md`](./CONTRIBUTING.md) · [`docs/architecture.md`](./docs/architecture.md) · [`docs/phase-2-roadmap.md`](./docs/phase-2-roadmap.md)

---

## 1. Principles

1. **Local-first trust** — Device SQLite is the domain source of truth. Never claim “saved” or “synced” until local persistence succeeds.
2. **Least privilege** — Grant the minimum permissions, network access, and data exposure needed for a feature.
3. **Defense in depth** — Validate at boundaries (import URLs, OCR text, unlock codes, future APIs); do not rely on UI alone.
4. **No secrets in the client** — Anything shipped in the app binary is public. Treat mobile code as untrusted for holding privileged credentials.
5. **Fail closed for destructive actions** — Export, delete, overwrite, and entitlement changes require explicit user confirmation and recoverable paths where product policy allows (trash/undo).
6. **Honest security UX** — Do not dark-pattern permissions, exaggerate encryption, or hide payment/unlock state.

Aligned at a high level with **OWASP MASVS** (storage, auth, network, platform, code quality, resilience) without cargo-culting controls we do not need yet.

---

## 2. Threat model (current + Phase 2)

| Asset | Risk if compromised | Primary controls |
| --- | --- | --- |
| Recipe library, plans, grocery lists | Data loss, privacy leak, silent overwrite | Typed repositories, autosave, trash/undo, export |
| Import pipeline (URL / OCR / share) | Malicious content, SSRF-like fetches, bad writes | Preview + confidence, allowlisted schemes, no silent commit |
| Unlock / influencer / admin codes | Piracy, unfair unlimited access | Client-side honesty + server verification when billing ships; no privileged secrets in repo |
| Future account / household sync | Account takeover, cross-user data bleed | Authn/z at API, tenancy checks, encrypted transport |
| Device storage | Casual access on unlocked device | OS app sandbox; sensitive tokens in secure storage only |

**Out of scope for MVP-era local guest mode:** full disk encryption product claims, anti-tamper DRM, or pretending client-only unlock codes are unbreakable.

---

## 3. Secrets, credentials, and configuration

- **Never commit** API keys, private keys, service-role tokens, webhook secrets, `.env` with production values, or personal access tokens.
- Use `.env.example` with placeholder names only; real values stay in CI secrets / EAS secrets / local untracked env.
- **No privileged backend keys in the mobile app.** Public anon keys (if any) must be scoped by Row Level Security / server policies—not “admin in disguise.”
- Rotate anything that was ever committed; treat history as leaked.
- Unlock/influencer **code registries** in-app are convenience only—not a security boundary. Document that admin unlock is device-local until a verified backend exists.

---

## 4. Data handling

### Classification

| Class | Examples | Rules |
| --- | --- | --- |
| **Public** | App copy, aisle labels, design tokens | No special handling |
| **User content** | Recipes, notes, photos, grocery items | User-controlled; sanitize for XSS if ever rendered as HTML/WebView |
| **Identity** | Email, auth tokens, household IDs | Secure storage; never log in full |
| **Payment** | Receipts, product IDs, redeem results | Prefer Store/Play APIs; do not log PAN/PII; minimize retention |
| **Telemetry** | Import kind, status, duration, error codes | No recipe body, captions, or photo bytes in analytics |

### Storage

- Domain data → **SQLite via repositories** only (no ad-hoc SQL from UI).
- Session / entitlement flags → prefer **Secure Store** for tokens; AsyncStorage only for non-sensitive UI/session caches.
- Do not write secrets to logs, crash reports, or sync-status banners.
- Web/desktop surfaces (Phase 2) must not weaken mobile sandbox assumptions (separate origin, CSP where applicable).

### Retention & deletion

- Soft-delete / trash with recovery for user content where the product promises it.
- Hard delete and account deletion (when accounts exist) must remove or orphan cloud copies per privacy policy—no “ghost” tenancy rows readable by others.
- Export must include the user’s library in a documented format; deletion must not strand unpaid “hostage” data.

---

## 5. Input boundaries

### URLs & network import

- Accept only **https:** (and documented app schemes for share sheets). Reject `file:`, `javascript:`, and unexpected schemes.
- Do not follow unbounded redirects; cap size/time of fetched documents.
- Treat fetched HTML/JSON as **untrusted**. Parse into structured preview fields; never `eval` or execute remote script.
- Server-side fetchers (Edge Functions) must block private/link-local IPs (SSRF) when introduced.

### OCR / photos / paste

- OCR and paste are untrusted text. Strip control characters where harmful; do not auto-execute links.
- Never insert a blank or silently wrong recipe—**preview + confidence** before commit.
- Do not upload cookbook photos to third parties without clear UX and privacy disclosure.

### Unlock & promo codes

- Normalize and rate-limit attempts in UI; avoid user enumeration messaging beyond “invalid code.”
- Admin codes that grant unlimited access are a **product backdoor**—gate behind build flavors or remote config before production scale; never ship unbounded undocumented god-codes in release notes as “security.”

---

## 6. Authentication, sessions, and household (Phase 2+)

When accounts / household sync land:

- Use a maintained auth SDK (e.g. Supabase Auth / Sign in with Apple/Google) — do not roll custom crypto.
- Store refresh/session tokens in **hardware-backed secure storage** where the platform allows.
- Every sync mutation must enforce **tenant isolation** (user/household id) on the server; client filters are not authorization.
- Real-time grocery sync channels must authorize membership before subscribe/publish.
- Sign-out clears tokens and cancels in-flight sync; guest mode remains usable offline without an account.

---

## 7. Transport & APIs

- **TLS everywhere** for network calls; no cleartext exceptions in production builds.
- Certificate pinning is optional until a threat justifies the ops cost; do not pin without a rotation plan.
- APIs validate authz server-side; return generic errors to clients for auth failures.
- Paginate and bound list endpoints; assume mobile clients can be modified.

---

## 8. Payments & entitlements

- Prefer **App Store / Play Billing** (or equivalent) as source of truth for paid unlock; local flags are a cache.
- Influencer discount codes may adjust offer presentation; **payment capture** still goes through the store/backend.
- Do not implement “restore purchases” in a way that trusts only a local boolean without receipt validation when a backend exists.
- Chick mascot and playful UX must not appear on payment or destructive confirmation paths (brand rule + anti-dark-pattern).

### IAP implementation (current)

As of the real IAP integration (replacing simulated purchases):

- **expo-iap** wraps App Store (StoreKit) and Google Play Billing for one-time unlock purchases.
- **Client entitlement cache**: `sessionStore.ts` persists unlock state locally; this is **not a security boundary** on jailbroken/rooted devices.
- **Store is source of truth**: "Restore purchases" queries the platform store to re-validate prior purchases; local flags are refreshed from that result.
- **No backend receipt validation yet**: Current implementation trusts the client-side store response. Phase 2+ should add server-side receipt validation (Apple App Store Server API / Google Play Developer API) before production at scale.
- **Product IDs are public**: Configured in `features/trust/iapConfig.ts`; no secrets required in client.
- **Admin unlock codes**: Local-only bypass for dev/demo; do not ship unbounded admin codes in production releases (see `features/trust/influencerCodes.ts`).
- **Sandbox/test accounts**: iOS sandbox and Android test tracks allow purchase testing without real charges; see `docs/iap.md`.

**Action items before production release**:
1. Replace placeholder product IDs with real App Store Connect / Play Console IDs.
2. Implement server-side receipt verification to prevent client-side entitlement tampering.
3. Rate-limit restore attempts to prevent abuse.
4. Remove or gate admin codes behind internal build flavors.

---

## 9. Platform & app integrity

- Request only required permissions (camera/photos for OCR, etc.) with a clear pre-prompt purpose string.
- Backup/export paths should not accidentally include auth tokens in share sheets.
- Deep links / universal links validate targets; do not auto-navigate to untrusted WebViews with elevated JS bridges.
- Keep dependencies updated; run `npm audit` / Dependabot-style alerts on the lockfile for high/critical issues before release.

---

## 10. Secure coding checklist (PR bar)

- [ ] No secrets or production credentials in the diff
- [ ] New network/import paths validate scheme, size, and failure UX
- [ ] User content not rendered as raw HTML without sanitization
- [ ] Entitlement and delete/export flows are explicit and test-covered
- [ ] Logs/telemetry free of recipe bodies, tokens, and photo bytes
- [ ] New SQLite access goes through repositories; migrations are reviewed
- [ ] Phase 2 sync/auth changes include server-side tenancy tests
- [ ] Follows **test-first** policy in [`CONTRIBUTING.md`](./CONTRIBUTING.md)

---

## 11. Security testing

Security-relevant behavior gets automated tests **before** implementation (same red → green rule as product tests):

- URL scheme rejection / import failure paths
- Preview-required before recipe commit
- Export completeness and delete/trash recovery
- Entitlement transitions (free ↔ unlocked ↔ admin) without privilege confusion
- Future: authz denials across household boundaries (expect **403/empty**, not other users’ rows)

Manual / release checks: permission prompts, backup exclusion of tokens, and “airplane mode” trust paths.

---

## 12. Vulnerability reporting

If you discover a security issue in Whisk:

1. **Do not** open a public GitHub issue with exploit details.
2. Email **ly.brian367@gmail.com** with repro steps, impact, and affected versions/branches.
3. Allow reasonable time for a fix before public disclosure.

Maintainers should patch on a private branch when practical, then publish a short advisory in release notes.

---

## 13. Document control

| Version | Notes |
| --- | --- |
| 1.0 | Initial standards for post-MVP / Phase 2 multi-agent work |

Update this file when auth, sync, web extension, or billing backends change the threat model. Security regressions block integration merges the same way trust/offline regressions do.
