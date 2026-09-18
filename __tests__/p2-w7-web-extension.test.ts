/**
 * P2-W7 — Browser extension & desktop/web (test-first).
 *
 * Acceptance covered:
 * - Extension can send a recipe draft into the import preview path
 * - Web/desktop does not become SOT over mobile SQLite without sync contracts
 * - CSP / scheme rules per SECURITY.md
 * - Message-passing validation rejects untrusted payloads
 */
import fs from 'node:fs';
import path from 'node:path';

import { useImportSessionStore } from '@/import/sessionStore';
import {
  EXTENSION_CAPTURE_MESSAGE_TYPE,
  EXTENSION_MESSAGE_VERSION,
  WEB_DESKTOP_SOT_POLICY,
  WHISK_WEB_CSP,
  acceptExtensionCapture,
  applyExtensionCaptureToPreview,
  assertAllowedCaptureSourceUrl,
  isAllowedCaptureScheme,
  validateExtensionMessage,
} from '@/lib/extension';

const VALID_CAPTURE = {
  type: EXTENSION_CAPTURE_MESSAGE_TYPE,
  version: EXTENSION_MESSAGE_VERSION,
  payload: {
    title: 'Sheet-Pan Chickpeas',
    sourceUrl: 'https://example.com/recipes/chickpeas',
    sourceName: 'example.com',
    ingredients: ['1 can chickpeas', '2 tbsp olive oil'],
    instructions: ['Toss', 'Roast at 425°F'],
    servings: 4,
    notes: 'Crispy',
    sourceEvidence: '<h1>Sheet-Pan Chickpeas</h1>',
  },
} as const;

describe('P2-W7 message-passing validation', () => {
  it('accepts a well-formed extension capture message', () => {
    const result = validateExtensionMessage(VALID_CAPTURE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message.type).toBe(EXTENSION_CAPTURE_MESSAGE_TYPE);
      expect(result.message.payload.title).toBe('Sheet-Pan Chickpeas');
      expect(result.message.payload.ingredients).toHaveLength(2);
    }
  });

  it('rejects non-object and null payloads', () => {
    expect(validateExtensionMessage(null).ok).toBe(false);
    expect(validateExtensionMessage('capture').ok).toBe(false);
    expect(validateExtensionMessage(42).ok).toBe(false);
    expect(validateExtensionMessage(['whisk.extension.capture']).ok).toBe(false);
  });

  it('rejects unknown message types and wrong versions', () => {
    expect(
      validateExtensionMessage({
        ...VALID_CAPTURE,
        type: 'whisk.extension.hack',
      }).ok,
    ).toBe(false);
    expect(
      validateExtensionMessage({
        ...VALID_CAPTURE,
        version: 99,
      }).ok,
    ).toBe(false);
    expect(
      validateExtensionMessage({
        ...VALID_CAPTURE,
        version: '1',
      }).ok,
    ).toBe(false);
  });

  it('rejects captures missing a usable title', () => {
    const result = validateExtensionMessage({
      ...VALID_CAPTURE,
      payload: { ...VALID_CAPTURE.payload, title: '   ' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid_payload');
    }
  });

  it('rejects oversized captures (DoS / untrusted bulk paste)', () => {
    const huge = 'x'.repeat(200_000);
    const result = validateExtensionMessage({
      ...VALID_CAPTURE,
      payload: {
        ...VALID_CAPTURE.payload,
        sourceEvidence: huge,
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('payload_too_large');
    }
  });

  it('rejects prototype-polluting / unexpected top-level keys without a typed envelope', () => {
    const result = validateExtensionMessage({
      type: EXTENSION_CAPTURE_MESSAGE_TYPE,
      version: EXTENSION_MESSAGE_VERSION,
      payload: VALID_CAPTURE.payload,
      __proto__: { admin: true },
      constructor: { prototype: { polluted: true } },
    });
    // Validation must not throw and must not trust extra attacker keys as authority.
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect('admin' in result.message).toBe(false);
      expect(Object.keys(result.message).sort()).toEqual(['payload', 'type', 'version']);
    }
  });
});

describe('P2-W7 CSP / scheme rules (SECURITY.md)', () => {
  it('allows https (and documented whisk: app scheme) only', () => {
    expect(isAllowedCaptureScheme('https:')).toBe(true);
    expect(isAllowedCaptureScheme('whisk:')).toBe(true);
    expect(isAllowedCaptureScheme('http:')).toBe(false);
    expect(isAllowedCaptureScheme('javascript:')).toBe(false);
    expect(isAllowedCaptureScheme('file:')).toBe(false);
    expect(isAllowedCaptureScheme('data:')).toBe(false);
  });

  it('rejects untrusted source URLs on capture payloads', () => {
    expect(() => assertAllowedCaptureSourceUrl('javascript:alert(1)')).toThrow(/scheme/i);
    expect(() => assertAllowedCaptureSourceUrl('file:///etc/passwd')).toThrow(/scheme/i);
    expect(() => assertAllowedCaptureSourceUrl('http://insecure.example/recipe')).toThrow(
      /https/i,
    );
    expect(assertAllowedCaptureSourceUrl('https://example.com/recipe')).toBe(
      'https://example.com/recipe',
    );
    expect(assertAllowedCaptureSourceUrl(null)).toBeNull();
  });

  it('rejects capture messages whose sourceUrl uses a forbidden scheme', () => {
    const result = validateExtensionMessage({
      ...VALID_CAPTURE,
      payload: {
        ...VALID_CAPTURE.payload,
        sourceUrl: 'javascript:alert(1)',
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('forbidden_scheme');
    }
  });

  it('publishes a strict CSP string for web/desktop (no unsafe-eval)', () => {
    expect(WHISK_WEB_CSP).toMatch(/default-src\s+'self'/);
    expect(WHISK_WEB_CSP).toMatch(/object-src\s+'none'/);
    expect(WHISK_WEB_CSP).toMatch(/base-uri\s+'self'/);
    expect(WHISK_WEB_CSP).not.toMatch(/unsafe-eval/);
    expect(WHISK_WEB_CSP).toMatch(/frame-ancestors\s+'none'/);
  });

  it('extension manifest declares CSP and does not request broad host access by default', () => {
    const root = path.join(__dirname, '..');
    const manifestPath = path.join(root, 'extension', 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      content_security_policy?: { extension_pages?: string };
      host_permissions?: string[];
      permissions?: string[];
    };
    expect(manifest.content_security_policy?.extension_pages).toMatch(/script-src\s+'self'/);
    expect(manifest.content_security_policy?.extension_pages).not.toMatch(/unsafe-eval/);
    // ActiveTab + scripting for the current page only — not <all_urls> by default.
    expect(manifest.host_permissions ?? []).not.toContain('<all_urls>');
    expect(manifest.permissions ?? []).toEqual(
      expect.arrayContaining(['activeTab', 'scripting']),
    );
  });
});

describe('P2-W7 extension → import preview path', () => {
  beforeEach(() => {
    useImportSessionStore.getState().clear();
    useImportSessionStore.setState({ savedDraftIds: new Set() });
  });

  it('maps a validated capture into an ImportDraft for preview (no SQLite write)', () => {
    const accepted = acceptExtensionCapture(VALID_CAPTURE);
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.draft.sourceKind).toBe('browser_extension');
    expect(accepted.draft.title).toBe('Sheet-Pan Chickpeas');
    expect(accepted.draft.sourceUrl).toBe('https://example.com/recipes/chickpeas');
    expect(accepted.draft.ingredients.length).toBeGreaterThan(0);
    expect(accepted.draft.instructions.length).toBeGreaterThan(0);
    expect(accepted.draft.adapterId).toBe('browser_extension');
  });

  it('loads the draft into the import session preview phase', () => {
    const result = applyExtensionCaptureToPreview(VALID_CAPTURE);
    expect(result.ok).toBe(true);
    const session = useImportSessionStore.getState();
    expect(session.phase).toBe('preview');
    expect(session.draft?.title).toBe('Sheet-Pan Chickpeas');
    expect(session.draft?.sourceKind).toBe('browser_extension');
    // Preview only — never celebrate as saved.
    expect(session.savedRecipeId).toBeNull();
  });

  it('does not mutate the import session when the payload is untrusted', () => {
    const result = applyExtensionCaptureToPreview({
      type: EXTENSION_CAPTURE_MESSAGE_TYPE,
      version: EXTENSION_MESSAGE_VERSION,
      payload: {
        title: 'Evil',
        sourceUrl: 'javascript:alert(1)',
        ingredients: [],
        instructions: [],
      },
    });
    expect(result.ok).toBe(false);
    expect(useImportSessionStore.getState().phase).toBe('idle');
    expect(useImportSessionStore.getState().draft).toBeNull();
  });
});

describe('P2-W7 web/desktop is not domain SOT without sync', () => {
  it('declares web/desktop as capture+preview relay, not SQLite SOT', () => {
    expect(WEB_DESKTOP_SOT_POLICY.isDomainSourceOfTruth).toBe(false);
    expect(WEB_DESKTOP_SOT_POLICY.role).toBe('capture_and_preview_relay');
    expect(WEB_DESKTOP_SOT_POLICY.requiresSyncContractsFrom).toEqual(
      expect.arrayContaining(['P2-W1', 'P2-W2']),
    );
    expect(WEB_DESKTOP_SOT_POLICY.mobileSqliteRemainsCanonical).toBe(true);
  });

  it('refuse to mark web/desktop as synced library authority', () => {
    expect(WEB_DESKTOP_SOT_POLICY.mayClaimCloudSyncedLibrary).toBe(false);
    expect(WEB_DESKTOP_SOT_POLICY.mayWriteMobileSqliteDirectly).toBe(false);
  });
});
