import type { CompatFormat, CompatImportJob } from '@/data/contracts';
import type { CompatRepository } from '@/data/repositories/compat';

import { resolveCompatAdapter } from '@/import/compat/registry';
import type { CompatImportDraft } from '@/import/compat/types';

export type PreviewCompatImportInput = {
  format: CompatFormat;
  payload: string;
  sourceLabel?: string | null;
  adapterId?: string;
  compatRepo: CompatRepository;
};

export type PreviewCompatImportSuccess = {
  ok: true;
  job: CompatImportJob;
  drafts: CompatImportDraft[];
};

export type PreviewCompatImportFailure = {
  ok: false;
  error: {
    code: 'parse_failed' | 'unsupported' | 'empty';
    message: string;
  };
};

export type PreviewCompatImportResult = PreviewCompatImportSuccess | PreviewCompatImportFailure;

/**
 * Parse a compat pack into drafts and persist a preview-only CompatImportJob.
 * Does not create recipes — caller must confirm via commitCompatImport.
 */
export async function previewCompatImport(
  input: PreviewCompatImportInput,
): Promise<PreviewCompatImportResult> {
  const adapter = resolveCompatAdapter({
    format: input.format,
    payload: input.payload,
    adapterId: input.adapterId,
  });

  if (!adapter) {
    return {
      ok: false,
      error: {
        code: 'unsupported',
        message: 'No compatibility adapter handles that pack.',
      },
    };
  }

  const parsed = adapter.parse(input.payload);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const overall =
    parsed.drafts.reduce((sum, draft) => sum + draft.overallConfidence, 0) /
    Math.max(parsed.drafts.length, 1);

  const job = input.compatRepo.createImportJob({
    format: input.format,
    sourceLabel: input.sourceLabel ?? null,
    confidence: Math.round(overall * 100) / 100,
    preview: {
      adapterId: adapter.id,
      recipeCount: parsed.drafts.length,
      recipes: parsed.drafts.map((draft) => ({
        draftId: draft.id,
        title: draft.title,
        externalUid: draft.externalUid,
        sourceUrl: draft.sourceUrl,
        overallConfidence: draft.overallConfidence,
        confidence: draft.confidence,
        warnings: draft.warnings,
        ingredientCount: draft.ingredients.length,
        instructionCount: draft.instructions.length,
      })),
    },
  });

  return {
    ok: true,
    job,
    drafts: parsed.drafts,
  };
}
