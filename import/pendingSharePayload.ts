/**
 * Ephemeral storage for pending share payloads, including video files.
 * Used to bridge OS share intent data to the share screen.
 */

export type SharePayload = {
  url?: string;
  caption?: string;
  videoPath?: string;
  imagePath?: string;
  mimeType?: string;
};

let currentPayload: SharePayload | null = null;

/**
 * Store a pending share payload for retrieval by the share screen.
 */
export function setPendingSharePayload(payload: SharePayload): void {
  currentPayload = payload;
}

/**
 * Retrieve and clear the pending share payload.
 */
export function consumePendingSharePayload(): SharePayload | null {
  const payload = currentPayload;
  currentPayload = null;
  return payload;
}

/**
 * Peek at the pending share payload without consuming it.
 */
export function getPendingSharePayload(): SharePayload | null {
  return currentPayload;
}

/**
 * Clear the pending share payload without retrieving it.
 */
export function clearPendingSharePayload(): void {
  currentPayload = null;
}
