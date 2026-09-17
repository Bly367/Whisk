import type { CookStep, IngredientInput } from '@/data/contracts';
import { createId, nowIso } from '@/data/util';

import { parseIngredientLine } from '@/import/parse/ingredients';
import type { ImportDraft, ImportWarning } from '@/import/types';

/**
 * Best-effort parse of freeform pasted recipe text into a draft.
 * Low confidence by design — user must review before save.
 */
export function draftFromPastedText(options: {
  text: string;
  titleHint?: string | null;
  sourceUrl?: string | null;
  adapterId: string;
}): ImportDraft | null {
  const lines = options.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return null;

  const title = (options.titleHint?.trim() || lines[0]).trim();
  const body = options.titleHint?.trim() ? lines : lines.slice(1);
  const splitAt = body.findIndex((line) =>
    /^(directions|instructions|method|steps)\b/i.test(line),
  );
  const ingredientSection = splitAt >= 0 ? body.slice(0, splitAt) : body;
  const stepSection = splitAt >= 0 ? body.slice(splitAt + 1) : [];

  const ingredients: IngredientInput[] = ingredientSection
    .filter((line) => !/^(ingredients)\b/i.test(line))
    .map((line, index) => parseIngredientLine(line, index))
    .filter((ing) => ing.name.trim().length > 0);

  const instructions: CookStep[] = stepSection.map((step, index) => ({
    id: createId(),
    text: step,
    position: index,
  }));

  if (!ingredients.length && !instructions.length) return null;

  const warnings: ImportWarning[] = [
    {
      code: 'low_confidence',
      message:
        'This draft came from pasted text. Double-check quantities and steps before saving.',
    },
  ];
  if (!ingredients.length) {
    warnings.push({
      code: 'missing_ingredients',
      message: 'No ingredients detected — add them before saving.',
      field: 'ingredients',
    });
  }
  if (!instructions.length) {
    warnings.push({
      code: 'missing_instructions',
      message: 'No steps detected — add them before saving.',
      field: 'instructions',
    });
  }

  return {
    id: createId(),
    sourceKind: 'paste_text',
    sourceUrl: options.sourceUrl ?? null,
    sourceName: null,
    imageUri: null,
    title,
    notes: null,
    servings: null,
    prepMinutes: null,
    cookMinutes: null,
    ingredients,
    instructions,
    confidence: {
      title: options.titleHint?.trim() ? 'high' : 'medium',
      ingredients: ingredients.length ? 'medium' : 'unknown',
      instructions: instructions.length ? 'medium' : 'unknown',
    },
    warnings,
    sourceEvidence: options.text.slice(0, 4000),
    adapterId: options.adapterId,
    createdAt: nowIso(),
  };
}
