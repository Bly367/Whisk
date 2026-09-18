/**
 * Whisk compatibility I/O (P2-W6) — Paprika + common JSON/Markdown packs.
 *
 * @example
 * import { previewCompatImport, commitCompatImport, buildCompatExportPack } from '@/import/compat'
 */

export type * from '@/import/compat/types';

export {
  listCompatAdapters,
  getCompatAdapter,
  getCompatAdapterForFormat,
  resolveCompatAdapter,
  setCompatAdapters,
  resetCompatAdapters,
} from '@/import/compat/registry';

export { paprikaAdapter, PAPRIKA_ADAPTER_ID } from '@/import/compat/adapters/paprikaAdapter';
export { jsonAdapter, JSON_ADAPTER_ID, WHISK_COMPAT_JSON_FORMAT } from '@/import/compat/adapters/jsonAdapter';
export { markdownAdapter, MARKDOWN_ADAPTER_ID } from '@/import/compat/adapters/markdownAdapter';

export { previewCompatImport } from '@/import/compat/preview';
export type {
  PreviewCompatImportInput,
  PreviewCompatImportResult,
} from '@/import/compat/preview';

export {
  commitCompatImport,
  draftToRecipeCreateInput,
  embedCompatUid,
  extractCompatUid,
} from '@/import/compat/commit';
export type {
  CommitCompatImportInput,
  CommitCompatImportResult,
} from '@/import/compat/commit';

export { buildCompatExportPack } from '@/import/compat/export';
export type { BuildCompatExportPackInput } from '@/import/compat/export';
