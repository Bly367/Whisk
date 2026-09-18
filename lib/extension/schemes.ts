/**
 * URL scheme allowlist for extension capture (SECURITY.md §5).
 * https: for public recipe pages; whisk: for documented app deep links.
 * Reject file:, javascript:, data:, and cleartext http:.
 */

const ALLOWED_SCHEMES = new Set(['https:', 'whisk:']);

export function isAllowedCaptureScheme(scheme: string): boolean {
  const normalized = scheme.toLowerCase().endsWith(':')
    ? scheme.toLowerCase()
    : `${scheme.toLowerCase()}:`;
  return ALLOWED_SCHEMES.has(normalized);
}

/**
 * Normalize and assert a capture source URL, or null when absent.
 * Throws when the scheme is not allowlisted.
 */
export function assertAllowedCaptureSourceUrl(input: string | null | undefined): string | null {
  if (input == null) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('Capture source URL must use an allowlisted scheme (https: or whisk:).');
  }

  if (!isAllowedCaptureScheme(url.protocol)) {
    if (url.protocol === 'http:') {
      throw new Error('Only https: recipe links are accepted (http: is not allowed).');
    }
    throw new Error(
      `Rejected capture source URL scheme "${url.protocol}". Only https: and whisk: are allowed.`,
    );
  }

  return url.toString();
}
