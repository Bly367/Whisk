/**
 * Whisk import pipeline (W4) — replaceable adapters + preview before save.
 *
 * @example
 * import { runImport, commitImportDraft, useImportSessionStore } from '@/import';
 */

export type * from '@/import/types';

export {
  listImportAdapters,
  getImportAdapter,
  runImport,
  setImportAdapters,
  resetImportAdapters,
} from '@/import/adapters/registry';
export {
  websiteAdapter,
  createWebsiteAdapter,
  WEBSITE_ADAPTER_ID,
} from '@/import/adapters/websiteAdapter';
export { ocrAdapter, OCR_ADAPTER_ID } from '@/import/adapters/ocrAdapter';

export {
  commitImportDraft,
  toRecipeCreateInput,
  assertDraftReadyToSave,
  ImportCommitError,
} from '@/import/commit';
export { useImportSessionStore } from '@/import/sessionStore';

export { canonicalizeUrl, detectSource, extractUrl, isSocialSource } from '@/import/parse/url';
export { extractRecipeJsonLd, extractPageMetadata } from '@/import/parse/jsonLd';
export { draftFromPastedText } from '@/import/parse/pasteText';
export { draftFromTranscript } from '@/import/parse/transcript';
export { parseRecipeText } from '@/import/parse/parseRecipeText';
export type { ParsedIngredient, ParsedRecipe } from '@/import/parse/structured';
export { parseIngredientLine } from '@/import/parse/ingredients';
export { scoreDraft } from '@/import/score';
export { runAutoImport } from '@/import/autoImport';

/** OS share intent handling */
export { parseShareIntent } from '@/import/shareIntent';
export type { ParsedShareIntent } from '@/import/shareIntent';
export { useShareIntentHandler } from '@/import/shareIntentHandler';

/** Phase 2 compatibility packs (Paprika / JSON / Markdown) — see `@/import/compat`. */
export {
  listCompatAdapters,
  previewCompatImport,
  commitCompatImport,
  buildCompatExportPack,
} from '@/import/compat';
