# Whisk browser extension (P2-W7)

Capture a recipe draft from the current tab and send it into the Whisk **import preview** path.

## Trust model

1. The extension builds a `whisk.extension.capture` message envelope.
2. Whisk (`lib/extension`) **re-validates** the payload (scheme allowlist, size, shape).
3. A validated draft is loaded into the ephemeral import session → `/import/preview`.
4. **Nothing is written to SQLite** until the user confirms on preview.
5. Web/desktop is a **capture + preview relay**, not the domain source of truth over mobile SQLite (see `WEB_DESKTOP_SOT_POLICY`). Sync contracts from P2-W1/W2 are required before any shared-library SOT claim.

## Load unpacked (Chromium)

1. Open `chrome://extensions` → Developer mode → Load unpacked.
2. Select this `extension/` directory.
3. Open an `https:` recipe page → click the extension → **Send to Whisk preview**.

## CSP / permissions

- MV3 `content_security_policy.extension_pages`: `script-src 'self'; object-src 'none'`
- Permissions: `activeTab`, `scripting` only (no `<all_urls>` host permission by default)
- Source URLs: `https:` and documented `whisk:` only (`SECURITY.md`)
