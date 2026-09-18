/**
 * P2-W7 — Browser extension & desktop/web contracts.
 *
 * Extension capture → validated message → import preview path.
 * Web/desktop is a capture/preview relay — not domain SOT without P2-W1/W2 sync.
 */

export {
  BROWSER_EXTENSION_ADAPTER_ID,
  EXTENSION_CAPTURE_LIMITS,
  EXTENSION_CAPTURE_MESSAGE_TYPE,
  EXTENSION_MESSAGE_VERSION,
  type ExtensionCaptureMessage,
  type ExtensionCapturePayload,
  type ExtensionValidationError,
  type ExtensionValidationErrorCode,
  type ExtensionValidationResult,
} from '@/lib/extension/protocol';

export { assertAllowedCaptureSourceUrl, isAllowedCaptureScheme } from '@/lib/extension/schemes';
export { WHISK_EXTENSION_PAGES_CSP, WHISK_WEB_CSP } from '@/lib/extension/csp';
export { WEB_DESKTOP_SOT_POLICY, type WebDesktopSotPolicy } from '@/lib/extension/sotPolicy';
export { validateExtensionMessage } from '@/lib/extension/validate';
export {
  acceptExtensionCapture,
  applyExtensionCaptureToPreview,
  extensionCaptureToImportDraft,
  type AcceptExtensionCaptureResult,
  type ApplyExtensionCaptureResult,
} from '@/lib/extension/bridge';
