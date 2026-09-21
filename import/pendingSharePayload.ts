import type { ParsedShareIntent } from '@/import/shareIntent';

/**
 * In-memory store for pending share payload.
 * Used to pass share data from OS share intent to import screen without
 * putting long captions or file paths in URL query params.
 * 
 * Extended to support video/image files for transcription and OCR.
 */
let pendingPayload: ParsedShareIntent | null = null;

/**
 * Store parsed share payload for import screen to pick up.
 */
export function setPendingSharePayload(payload: ParsedShareIntent | null): void {
  pendingPayload = payload;
  if (__DEV__ && payload) {
    console.log('[Share] Stored pending payload:', {
      hasUrl: !!payload.url,
      hasText: !!payload.text,
      hasCaption: !!payload.caption,
      captionLength: payload.caption?.length || 0,
      captionPreview: payload.caption?.slice(0, 100),
      hasVideo: !!payload.videoPath,
      hasImage: !!payload.imagePath,
      mimeType: payload.mimeType,
    });
  }
}

/**
 * Retrieve and clear the pending share payload.
 * Import screen should call this on mount.
 */
export function consumePendingSharePayload(): ParsedShareIntent | null {
  const payload = pendingPayload;
  pendingPayload = null;
  if (__DEV__ && payload) {
    console.log('[Share] Consumed pending payload');
  }
  return payload;
}

/**
 * Check if there's a pending payload without consuming it.
 */
export function hasPendingSharePayload(): boolean {
  return pendingPayload !== null;
}
