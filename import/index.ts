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
export { shareSheetAdapter, SHARE_SHEET_ADAPTER_ID } from '@/import/adapters/shareSheetAdapter';
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
export { parseIngredientLine } from '@/import/parse/ingredients';

/** OS share intent handling */
export { parseShareIntent } from '@/import/shareIntent';
export type { ParsedShareIntent } from '@/import/shareIntent';
export { useShareIntentHandler } from '@/import/shareIntentHandler';
export {
  setPendingSharePayload,
  consumePendingSharePayload,
  hasPendingSharePayload,
} from '@/import/pendingSharePayload';

/** Phase 2 compatibility packs (Paprika / JSON / Markdown) — see `@/import/compat`. */
export {
  listCompatAdapters,
  previewCompatImport,
  commitCompatImport,
  buildCompatExportPack,
} from '@/import/compat';
