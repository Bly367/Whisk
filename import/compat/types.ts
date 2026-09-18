/**
 * P2-W6 — Replaceable compatibility import/export adapters.
 * Paprika + common JSON/Markdown packs; preview before commit.
 */

import type { CompatFormat, CookStep, IngredientInput } from '@/data/contracts';
import type { ConfidenceLevel, FieldConfidence, ImportWarning } from '@/import/types';

export type CompatAdapterId = 'compat-paprika' | 'compat-json' | 'compat-markdown';

export type CompatConflictPolicy = 'skip' | 'create_new' | 'overwrite';

export type CompatMatchExistingBy = 'none' | 'externalUid' | 'sourceUrl';

/** Format-specific draft — never written to recipes until commit. */
export type CompatImportDraft = {
  id: string;
  format: CompatFormat;
  adapterId: CompatAdapterId;
  externalUid: string | null;
  title: string;
  notes: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  imageUri: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  rating: number | null;
  ingredients: IngredientInput[];
  instructions: CookStep[];
  tags: string[];
  confidence: FieldConfidence;
  /** 0–1 aggregate for CompatImportJob.confidence */
  overallConfidence: number;
  warnings: ImportWarning[];
  sourceEvidence: string | null;
  createdAt: string;
};

export type CompatAdapterParseSuccess = {
  ok: true;
  drafts: CompatImportDraft[];
};

export type CompatAdapterParseFailure = {
  ok: false;
  error: {
    code: 'parse_failed' | 'unsupported' | 'empty';
    message: string;
  };
};

export type CompatAdapterParseResult = CompatAdapterParseSuccess | CompatAdapterParseFailure;

export interface CompatAdapter {
  readonly id: CompatAdapterId;
  readonly format: CompatFormat;
  readonly label: string;
  canHandle(input: { format?: CompatFormat; payload: string }): boolean;
  parse(payload: string): CompatAdapterParseResult;
  serialize(drafts: CompatExportRecipe[]): Record<string, unknown>;
}

export type CompatExportRecipe = {
  id: string;
  externalUid: string | null;
  title: string;
  notes: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  rating: number | null;
  ingredients: IngredientInput[];
  instructions: CookStep[];
  tags: string[];
};

export type CompatSkipReason = 'user_edited' | 'already_exists';

export type CompatSkippedImport = {
  draftId: string;
  existingRecipeId: string;
  reason: CompatSkipReason;
  title: string;
};

export function confidenceRank(level: ConfidenceLevel | undefined): number {
  switch (level) {
    case 'high':
      return 1;
    case 'medium':
      return 0.7;
    case 'low':
      return 0.4;
    case 'unknown':
    default:
      return 0.2;
  }
}

export function aggregateConfidence(confidence: FieldConfidence): number {
  const keys: (keyof FieldConfidence)[] = [
    'title',
    'ingredients',
    'instructions',
    'servings',
    'times',
    'notes',
  ];
  const scores = keys
    .map((key) => confidence[key])
    .filter((level): level is ConfidenceLevel => level != null)
    .map(confidenceRank);
  if (!scores.length) return 0.3;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
}
