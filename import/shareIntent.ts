import type { ShareIntent } from 'expo-share-intent';

import { extractUrl } from '@/import/parse/url';

export type ParsedShareIntent = {
  url?: string;
  text?: string;
  caption?: string;
};

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

  // If we have a webUrl, use it directly
  if (webUrl) {
    // Caption is any text that's not the URL
    const caption = rawText && rawText !== webUrl ? rawText.replace(webUrl, '').trim() : undefined;
    return {
      url: webUrl,
      text: rawText,
      caption,
    };
  }

  // Try to extract URL from raw text
  const extractedUrl = extractUrl(rawText);
  if (extractedUrl) {
    // Remove the URL from text to get the caption
    const caption = rawText.replace(extractedUrl, '').trim() || undefined;
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
