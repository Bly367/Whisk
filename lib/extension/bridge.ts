import { createId } from '@/data/util';
import { parseIngredientLine } from '@/import/parse/ingredients';
import { useImportSessionStore } from '@/import/sessionStore';
import type { ImportDraft } from '@/import/types';
import {
  BROWSER_EXTENSION_ADAPTER_ID,
  type ExtensionCaptureMessage,
  type ExtensionValidationError,
} from '@/lib/extension/protocol';
import { validateExtensionMessage } from '@/lib/extension/validate';
import { WEB_DESKTOP_SOT_POLICY } from '@/lib/extension/sotPolicy';

export type AcceptExtensionCaptureResult =
  | { ok: true; draft: ImportDraft; message: ExtensionCaptureMessage }
  | { ok: false; error: ExtensionValidationError };

/**
 * Map a validated extension capture into an editable ImportDraft.
 * Does not write SQLite — preview + explicit commit remain required.
 */
export function extensionCaptureToImportDraft(message: ExtensionCaptureMessage): ImportDraft {
  const { payload } = message;
  const now = new Date().toISOString();

  const ingredients = payload.ingredients.map((line, index) => parseIngredientLine(line, index));
  const instructions = payload.instructions.map((text, index) => ({
    id: createId(),
    text,
    position: index,
  }));

  const confidence = {
    title: 'high' as const,
    ingredients: ingredients.length > 0 ? ('medium' as const) : ('low' as const),
    instructions: instructions.length > 0 ? ('medium' as const) : ('low' as const),
    servings: payload.servings != null ? ('medium' as const) : ('unknown' as const),
    notes: payload.notes ? ('medium' as const) : ('unknown' as const),
  };

  const warnings = [];
  if (ingredients.length === 0) {
    warnings.push({
      code: 'missing_ingredients' as const,
      message: 'No ingredients were captured — add them before saving.',
      field: 'ingredients' as const,
    });
  }
  if (instructions.length === 0) {
    warnings.push({
      code: 'missing_instructions' as const,
      message: 'No steps were captured — add them before saving.',
      field: 'instructions' as const,
    });
  }

  return {
    id: createId(),
    sourceKind: 'browser_extension',
    sourceUrl: payload.sourceUrl,
    sourceName: payload.sourceName ?? (payload.sourceUrl ? new URL(payload.sourceUrl).hostname : null),
    imageUri: null,
    title: payload.title,
    notes: payload.notes,
    servings: payload.servings,
    prepMinutes: null,
    cookMinutes: null,
    ingredients,
    instructions,
    confidence,
    warnings,
    sourceEvidence: payload.sourceEvidence,
    adapterId: BROWSER_EXTENSION_ADAPTER_ID,
    createdAt: now,
  };
}

/** Validate raw message and produce an ImportDraft (still preview-only). */
export function acceptExtensionCapture(raw: unknown): AcceptExtensionCaptureResult {
  const validated = validateExtensionMessage(raw);
  if (!validated.ok) {
    return validated;
  }
  return {
    ok: true,
    message: validated.message,
    draft: extensionCaptureToImportDraft(validated.message),
  };
}

export type ApplyExtensionCaptureResult =
  | { ok: true; draft: ImportDraft }
  | { ok: false; error: ExtensionValidationError };

/**
 * Load a trusted-after-validation capture into the import preview session.
 * Web/desktop remains a relay — see WEB_DESKTOP_SOT_POLICY (no direct mobile SQLite write).
 */
export function applyExtensionCaptureToPreview(
  raw: unknown,
  store: typeof useImportSessionStore = useImportSessionStore,
): ApplyExtensionCaptureResult {
  // SOT guard: this path only touches ephemeral import session state.
  if (WEB_DESKTOP_SOT_POLICY.mayWriteMobileSqliteDirectly) {
    return {
      ok: false,
      error: {
        code: 'invalid_envelope',
        message: 'Web/desktop SOT policy misconfigured — refusing capture apply.',
      },
    };
  }

  const accepted = acceptExtensionCapture(raw);
  if (!accepted.ok) {
    return accepted;
  }

  store.getState().setPreview(accepted.draft);
  return { ok: true, draft: accepted.draft };
}
