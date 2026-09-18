import {
  BROWSER_EXTENSION_ADAPTER_ID,
  EXTENSION_CAPTURE_LIMITS,
  EXTENSION_CAPTURE_MESSAGE_TYPE,
  EXTENSION_MESSAGE_VERSION,
  type ExtensionCaptureMessage,
  type ExtensionCapturePayload,
  type ExtensionValidationErrorCode,
  type ExtensionValidationResult,
} from '@/lib/extension/protocol';
import { assertAllowedCaptureSourceUrl } from '@/lib/extension/schemes';

function fail(code: ExtensionValidationErrorCode, message: string): ExtensionValidationResult {
  return { ok: false, error: { code, message } };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLen) return null;
  return trimmed;
}

function asStringList(value: unknown, maxItems: number, maxLine: number): string[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length > maxItems) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    const line = item.trim();
    if (!line) continue;
    if (line.length > maxLine) return null;
    out.push(line);
  }
  return out;
}

function estimatePayloadChars(payload: ExtensionCapturePayload): number {
  return (
    payload.title.length +
    (payload.sourceUrl?.length ?? 0) +
    (payload.sourceName?.length ?? 0) +
    (payload.notes?.length ?? 0) +
    (payload.sourceEvidence?.length ?? 0) +
    payload.ingredients.reduce((n, line) => n + line.length, 0) +
    payload.instructions.reduce((n, line) => n + line.length, 0)
  );
}

function normalizePayload(raw: unknown): ExtensionCapturePayload | { error: ExtensionValidationResult } {
  if (!isPlainObject(raw)) {
    return {
      error: fail('invalid_payload', 'Capture payload must be a plain object.'),
    };
  }

  const title = asTrimmedString(raw.title, EXTENSION_CAPTURE_LIMITS.maxTitleLength);
  if (!title) {
    return {
      error: fail('invalid_payload', 'Capture requires a non-empty title.'),
    };
  }

  let sourceUrl: string | null = null;
  if (raw.sourceUrl != null && raw.sourceUrl !== '') {
    if (typeof raw.sourceUrl !== 'string') {
      return {
        error: fail('invalid_payload', 'sourceUrl must be a string or null.'),
      };
    }
    try {
      sourceUrl = assertAllowedCaptureSourceUrl(raw.sourceUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Forbidden source URL scheme.';
      return { error: fail('forbidden_scheme', message) };
    }
  }

  const sourceName =
    raw.sourceName == null || raw.sourceName === ''
      ? null
      : asTrimmedString(raw.sourceName, EXTENSION_CAPTURE_LIMITS.maxStringFieldLength);
  if (raw.sourceName != null && raw.sourceName !== '' && sourceName == null) {
    return {
      error: fail('invalid_payload', 'sourceName is invalid or too long.'),
    };
  }

  const ingredients = asStringList(
    raw.ingredients ?? [],
    EXTENSION_CAPTURE_LIMITS.maxIngredientLines,
    EXTENSION_CAPTURE_LIMITS.maxLineLength,
  );
  if (!ingredients) {
    return {
      error: fail('invalid_payload', 'ingredients must be a bounded string array.'),
    };
  }

  const instructions = asStringList(
    raw.instructions ?? [],
    EXTENSION_CAPTURE_LIMITS.maxInstructionSteps,
    EXTENSION_CAPTURE_LIMITS.maxLineLength,
  );
  if (!instructions) {
    return {
      error: fail('invalid_payload', 'instructions must be a bounded string array.'),
    };
  }

  let servings: number | null = null;
  if (raw.servings != null && raw.servings !== '') {
    if (typeof raw.servings !== 'number' || !Number.isFinite(raw.servings) || raw.servings < 0) {
      return {
        error: fail('invalid_payload', 'servings must be a finite non-negative number or null.'),
      };
    }
    servings = raw.servings;
  }

  const notes =
    raw.notes == null || raw.notes === ''
      ? null
      : asTrimmedString(raw.notes, EXTENSION_CAPTURE_LIMITS.maxStringFieldLength);
  if (raw.notes != null && raw.notes !== '' && notes == null) {
    return { error: fail('invalid_payload', 'notes is invalid or too long.') };
  }

  let sourceEvidence: string | null = null;
  if (raw.sourceEvidence != null && raw.sourceEvidence !== '') {
    if (typeof raw.sourceEvidence !== 'string') {
      return {
        error: fail('invalid_payload', 'sourceEvidence must be a string or null.'),
      };
    }
    if (raw.sourceEvidence.length > EXTENSION_CAPTURE_LIMITS.maxEvidenceLength) {
      return {
        error: fail('payload_too_large', 'sourceEvidence exceeds the capture size limit.'),
      };
    }
    sourceEvidence = raw.sourceEvidence;
  }

  const payload: ExtensionCapturePayload = {
    title,
    sourceUrl,
    sourceName,
    ingredients,
    instructions,
    servings,
    notes,
    sourceEvidence,
  };

  if (estimatePayloadChars(payload) > EXTENSION_CAPTURE_LIMITS.maxPayloadChars) {
    return {
      error: fail('payload_too_large', 'Capture payload exceeds the maximum allowed size.'),
    };
  }

  return payload;
}

/**
 * Validate an untrusted extension → app message.
 * Returns a sanitized typed envelope; never echoes attacker-controlled extra keys.
 */
export function validateExtensionMessage(raw: unknown): ExtensionValidationResult {
  if (!isPlainObject(raw)) {
    return fail('invalid_envelope', 'Extension message must be a plain object.');
  }

  if (raw.type !== EXTENSION_CAPTURE_MESSAGE_TYPE) {
    return fail('unknown_type', 'Unrecognized extension message type.');
  }

  if (raw.version !== EXTENSION_MESSAGE_VERSION) {
    return fail('unsupported_version', 'Unsupported extension message version.');
  }

  const normalized = normalizePayload(raw.payload);
  if ('error' in normalized) {
    return normalized.error;
  }

  const message: ExtensionCaptureMessage = {
    type: EXTENSION_CAPTURE_MESSAGE_TYPE,
    version: EXTENSION_MESSAGE_VERSION,
    payload: normalized,
  };

  // Explicit allowlist copy — drop __proto__ / constructor / unknown authority keys.
  return { ok: true, message };
}

export { BROWSER_EXTENSION_ADAPTER_ID };
