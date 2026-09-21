import type { ShareIntent } from 'expo-share-intent';

import { extractUrl } from '@/import/parse/url';

export type ParsedShareIntent = {
  url?: string;
  text?: string;
  caption?: string;
};

/**
 * Hostile URL schemes that should be rejected for security.
 */
const HOSTILE_SCHEMES = ['javascript:', 'file:', 'data:', 'vbscript:', 'about:', 'blob:'];

/**
 * Check if a URL has a hostile scheme that should be rejected.
 */
function hasHostileScheme(url: string): boolean {
  const lowerUrl = url.toLowerCase().trim();
  return HOSTILE_SCHEMES.some((scheme) => lowerUrl.startsWith(scheme));
}

/**
 * Collapse multiple whitespace characters (spaces, tabs, newlines) into a single space.
 */
function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Parse share intent data into format expected by import system.
 * Extracts URL from text if present, and separates caption from URL.
 */
export function parseShareIntent(shareIntent: ShareIntent | null): ParsedShareIntent | null {
  if (!shareIntent) {
    return null;
  }

  // Get raw text from share (could be URL, text, or both)
  const rawText = shareIntent.text?.trim() || '';
  const webUrl = shareIntent.webUrl?.trim() || '';

  // Reject hostile URL schemes
  if (webUrl && hasHostileScheme(webUrl)) {
    return null;
  }

  // If we have a webUrl, use it directly
  if (webUrl) {
    // Caption is any text that's not the URL
    const caption =
      rawText && rawText !== webUrl ? collapseWhitespace(rawText.replace(webUrl, '')) : undefined;
    return {
      url: webUrl,
      text: rawText,
      caption: caption || undefined,
    };
  }

  // Try to extract URL from raw text
  const extractedUrl = extractUrl(rawText);
  if (extractedUrl) {
    // Reject hostile URL schemes
    if (hasHostileScheme(extractedUrl)) {
      return null;
    }
    // Remove the URL from text to get the caption, then collapse whitespace
    const caption = collapseWhitespace(rawText.replace(extractedUrl, '')) || undefined;
    return {
      url: extractedUrl,
      text: rawText,
      caption,
    };
  }

  // Text-only share (no URL)
  if (rawText) {
    return {
      text: rawText,
      caption: rawText,
    };
  }

  return null;
}
