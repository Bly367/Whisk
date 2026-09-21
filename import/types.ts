/**
 * Replaceable import adapter contracts (W4).
 * Feature UI depends on these types + the registry — not on a specific parser.
 */

import type { CookStep, IngredientInput } from '@/data/contracts';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown';

export type ImportFieldKey =
  'title' | 'ingredients' | 'instructions' | 'servings' | 'times' | 'notes' | 'image';

export type FieldConfidence = Partial<Record<ImportFieldKey, ConfidenceLevel>>;

export type ImportWarningCode =
  | 'missing_ingredients'
  | 'missing_instructions'
  | 'missing_title'
  | 'low_confidence'
  | 'unsupported_source'
  | 'private_or_unavailable'
  | 'manual_transcription'
  | 'stub';

export type ImportWarning = {
  code: ImportWarningCode;
  message: string;
  field?: ImportFieldKey;
};

export type ImportSourceKind =
  | 'website'
  | 'share_sheet'
  | 'ocr'
  | 'manual'
  | 'paste_text'
  | 'browser_extension';

export type ImportFallbackAction = 'try_again' | 'paste_text' | 'scan' | 'manual';

export type ImportAdapterErrorCode =
  | 'invalid_url'
  | 'network'
  | 'parse_failed'
  | 'unsupported'
  | 'needs_input'
  | 'stub'
  | 'native_unavailable';

export type ImportAdapterError = {
  code: ImportAdapterErrorCode;
  message: string;
  fallbacks: ImportFallbackAction[];
};

/** Editable preview payload — never written to SQLite until commit. */
export type ImportDraft = {
  id: string;
  sourceKind: ImportSourceKind;
  sourceUrl: string | null;
  sourceName: string | null;
  imageUri: string | null;
  title: string;
  notes: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: IngredientInput[];
  instructions: CookStep[];
  confidence: FieldConfidence;
  warnings: ImportWarning[];
  /** Original snippet / HTML / caption for side-by-side comparison when available. */
  sourceEvidence: string | null;
  adapterId: string;
  createdAt: string;
};

export type ImportAdapterInput = {
  url?: string;
  text?: string;
  imageUri?: string;
  /** Raw payload from the OS share sheet. */
  sharedContent?: string;
};

export type ImportAdapterSuccess = {
  ok: true;
  draft: ImportDraft;
};

export type ImportAdapterFailure = {
  ok: false;
  error: ImportAdapterError;
};

export type ImportAdapterResult = ImportAdapterSuccess | ImportAdapterFailure;

/**
 * Replaceable importer. Website, share-sheet, and OCR each implement this.
 * Social APIs change — keep paste / photo / manual fallbacks always available.
 */
export interface ImportAdapter {
  readonly id: string;
  readonly kind: ImportSourceKind;
  readonly label: string;
  canHandle(input: ImportAdapterInput): boolean;
  import(input: ImportAdapterInput): Promise<ImportAdapterResult>;
}

export const DEFAULT_FALLBACKS: ImportFallbackAction[] = [
  'try_again',
  'paste_text',
  'scan',
  'manual',
];
