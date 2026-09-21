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

  // Look for explicit section headers
  const splitAt = body.findIndex((line) => /^(directions|instructions|method|steps)\b/i.test(line));

  let ingredientSection: string[];
  let stepSection: string[];

  if (splitAt >= 0) {
    // Explicit sections found
    ingredientSection = body.slice(0, splitAt);
    stepSection = body.slice(splitAt + 1);
  } else {
    // No explicit sections - use heuristics to separate ingredients from steps
    // Ingredient-like: starts with quantity/number, has measurements, or has bullet/emoji
    // Step-like: imperative verbs, longer sentences, numbered steps
    const heuristicSplit = body.findIndex((line, idx) => {
      if (idx === 0) return false; // Don't split on first line
      const isStepLike =
        /^\d+\.\s/.test(line) || // "1. Mix flour"
        /^(mix|add|cook|bake|heat|stir|combine|pour|bring|place|season|serve|fold|whisk|chop|slice|dice|preheat|blend|simmer|boil)/i.test(
          line,
        ); // Imperative verbs
      const isIngredientLike =
        /^[\d\/]+\s/.test(line) || // "1 cup" or "1/2 tsp"
        /^[🔸🔹▪️•\-\*]\s/.test(line) || // Emoji or traditional bullets
        /(cup|tbsp|tsp|oz|lb|gram|kg|ml|liter|pinch|dash|clove|slice)/i.test(line);
      return isStepLike && !isIngredientLike;
    });

    if (heuristicSplit >= 0) {
      ingredientSection = body.slice(0, heuristicSplit);
      stepSection = body.slice(heuristicSplit);
    } else {
      // Can't confidently split - treat shorter lines as ingredients, longer as steps
      const avgLength = body.reduce((sum, line) => sum + line.length, 0) / body.length;
      ingredientSection = body.filter((line) => line.length <= avgLength * 1.2);
      stepSection = body.filter((line) => line.length > avgLength * 1.2);

      // If that didn't work well, fallback: first half ingredients, second half steps
      if (ingredientSection.length === 0 || stepSection.length === 0) {
        const midpoint = Math.floor(body.length / 2);
        ingredientSection = body.slice(0, midpoint);
        stepSection = body.slice(midpoint);
      }
    }
  }

  const ingredients: IngredientInput[] = ingredientSection
    .filter((line) => !/^(ingredients)\b/i.test(line))
    .map((line, index) => parseIngredientLine(line, index))
    .filter((ing) => ing.name.trim().length > 0);

  const instructions: CookStep[] = stepSection
    .filter((line) => !/^(directions|instructions|method|steps)\b/i.test(line))
    .map((step, index) => ({
      id: createId(),
      text: step,
      position: index,
    }));

  if (!ingredients.length && !instructions.length) return null;

  const warnings: ImportWarning[] = [
    {
      code: 'low_confidence',
      message: 'This draft came from pasted text. Double-check quantities and steps before saving.',
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
