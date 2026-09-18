/**
 * SECURITY.md §5 — allowlisted schemes for untrusted compat pack URLs.
 * Accept https: and documented app scheme whisk-compat:; reject file:,
 * javascript:, data:, and anything unexpected.
 */

const ALLOWED_SOURCE_PROTOCOLS = new Set(['https:', 'whisk-compat:']);
const ALLOWED_IMAGE_PROTOCOLS = new Set(['https:']);

function parseAbsoluteUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
}

/** Sanitize source_url / sourceUrl from an untrusted pack. */
export function sanitizeCompatSourceUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const url = parseAbsoluteUrl(raw);
  if (!url) return null;
  if (!ALLOWED_SOURCE_PROTOCOLS.has(url.protocol.toLowerCase())) {
    return null;
  }
  return url.toString();
}

/** Sanitize image_url / imageUri from an untrusted pack. */
export function sanitizeCompatImageUri(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const url = parseAbsoluteUrl(raw);
  if (!url) return null;
  if (!ALLOWED_IMAGE_PROTOCOLS.has(url.protocol.toLowerCase())) {
    return null;
  }
  return url.toString();
}

export function isAllowedCompatSourceUrl(raw: string | null | undefined): boolean {
  if (raw == null || !String(raw).trim()) return true;
  return sanitizeCompatSourceUrl(raw) != null;
}

export function isAllowedCompatImageUri(raw: string | null | undefined): boolean {
  if (raw == null || !String(raw).trim()) return true;
  return sanitizeCompatImageUri(raw) != null;
}
