/**
 * P2-W7 browser extension ↔ Whisk message protocol.
 * Validate at the boundary — never trust extension / page script payloads.
 */

export const EXTENSION_CAPTURE_MESSAGE_TYPE = 'whisk.extension.capture' as const;
export const EXTENSION_MESSAGE_VERSION = 1 as const;
export const BROWSER_EXTENSION_ADAPTER_ID = 'browser_extension' as const;

/** Soft caps — reject bulk / DoS-style dumps before they hit preview UI. */
export const EXTENSION_CAPTURE_LIMITS = {
  maxTitleLength: 500,
  maxStringFieldLength: 8_000,
  maxEvidenceLength: 50_000,
  maxIngredientLines: 200,
  maxInstructionSteps: 200,
  maxLineLength: 2_000,
  maxPayloadChars: 100_000,
} as const;

export type ExtensionCapturePayload = {
  title: string;
  sourceUrl: string | null;
  sourceName: string | null;
  ingredients: string[];
  instructions: string[];
  servings: number | null;
  notes: string | null;
  sourceEvidence: string | null;
};

export type ExtensionCaptureMessage = {
  type: typeof EXTENSION_CAPTURE_MESSAGE_TYPE;
  version: typeof EXTENSION_MESSAGE_VERSION;
  payload: ExtensionCapturePayload;
};

export type ExtensionValidationErrorCode =
  | 'invalid_envelope'
  | 'unknown_type'
  | 'unsupported_version'
  | 'invalid_payload'
  | 'forbidden_scheme'
  | 'payload_too_large';

export type ExtensionValidationError = {
  code: ExtensionValidationErrorCode;
  message: string;
};

export type ExtensionValidationResult =
  | { ok: true; message: ExtensionCaptureMessage }
  | { ok: false; error: ExtensionValidationError };
