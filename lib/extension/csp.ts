/**
 * Content-Security-Policy for Whisk web/desktop surfaces (SECURITY.md).
 * No unsafe-eval; object-src none; frame-ancestors none.
 */
export const WHISK_WEB_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

/** MV3 extension_pages CSP (no remote script). */
export const WHISK_EXTENSION_PAGES_CSP = "script-src 'self'; object-src 'none'; base-uri 'self'";
