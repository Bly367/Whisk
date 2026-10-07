import type { IngredientInput, CookStep } from '@/data/contracts';
import { createId, nowIso } from '@/data/util';
import type { ImportDraft, ImportSourceKind, ImportWarning } from '@/import/types';

export type ParsedIngredient = {
  quantity?: string | null;
  unit?: string | null;
  name: string;
  note?: string | null;
};

export type ParsedRecipe = {
  title: string;
  ingredients: ParsedIngredient[];
  steps: string[];
  parser: 'foundation' | 'openai' | 'heuristic';
};

const normalizeForGrounding = (value: string): string => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

function ingredientVariants(name: string): string[] {
  const normalized = normalizeForGrounding(name);
  if (!normalized) return [];
  const variants = new Set([normalized]);
  if (normalized.endsWith('ies')) variants.add(`${normalized.slice(0, -3)}y`);
  if (normalized.endsWith('es')) variants.add(normalized.slice(0, -2));
  if (normalized.endsWith('s')) variants.add(normalized.slice(0, -1));
  else variants.add(`${normalized}s`);
  return [...variants].filter(Boolean);
}

function isGrounded(name: string, source: string): boolean {
  return ingredientVariants(name).some((variant) => source.includes(variant));
}

/** Keep model output tied to words present in the source supplied by the user. */
export function groundParsedRecipe(recipe: ParsedRecipe, sourceText: string): ParsedRecipe | null {
  const source = normalizeForGrounding(sourceText);
  const ingredients = recipe.ingredients
    .filter((ingredient) => ingredient.name.trim() && isGrounded(ingredient.name, source))
    .map((ingredient) => ({
      ...ingredient,
      name: ingredient.name.trim(),
      quantity: ingredient.quantity?.trim() || null,
      unit: ingredient.unit?.trim() || null,
      note: ingredient.note?.trim() || null,
    }));
  const steps = recipe.steps.map((step) => step.trim()).filter(Boolean);
  if (!ingredients.length && !steps.length) return null;
  return { ...recipe, title: recipe.title.trim(), ingredients, steps };
}

function looksLikeIngredient(line: string): boolean {
  return /^(?:[-*•]\s*)?(?:\d|[¼½¾⅓⅔⅛⅜⅝⅞]|one\b|two\b|three\b|a\b|an\b)/i.test(line)
    || /\b(?:cup|tbsp|tsp|oz|lb|gram|kg|ml|liter|pinch|dash|clove|can|stick|bunch|sprig|slice)\b/i.test(line);
}

export function suitableTitleFromText(text: string): string | null {
  const line = text.split(/\r?\n/).map((item) => item.trim()).find((item) => {
    if (!item || /^(?:ingredients?|instructions?|directions?|method|steps?)\b/i.test(item)) return false;
    if (looksLikeIngredient(item) || /^(?:\d+[.)]|step\s+\d+)/i.test(item)) return false;
    return item.length >= 4 && item.length <= 100;
  });
  return line?.replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu, '').replace(/\s+/g, ' ').trim() || null;
}

function isJunkTitle(title: string): boolean {
  return !title.trim() || /^recipe from\b/i.test(title) || /^[A-Za-z-]+$/.test(title.trim()) && title.trim().length < 12;
}

export function parsedRecipeToDraft(
  recipe: ParsedRecipe,
  options: {
    sourceText: string;
    sourceUrl?: string | null;
    sourceName?: string | null;
    sourceKind?: ImportSourceKind;
    titleHint?: string | null;
    adapterId?: string;
  },
): ImportDraft {
  const title = options.titleHint?.trim() && isJunkTitle(recipe.title)
    ? options.titleHint.trim()
    : recipe.title.trim() || options.titleHint?.trim() || 'Recipe from import';
  const ingredients: IngredientInput[] = recipe.ingredients.map((ingredient, position) => ({
    name: ingredient.name,
    quantity: ingredient.quantity ?? null,
    unit: ingredient.unit ?? null,
    note: ingredient.note ?? null,
    position,
  }));
  const instructions: CookStep[] = recipe.steps.map((text, position) => ({ id: createId(), text, position }));
  const warnings: ImportWarning[] = [{
    code: 'low_confidence' as const,
    message: `Drafted with ${recipe.parser} recipe parsing. Review quantities and steps before saving.`,
  }];
  if (!ingredients.length) warnings.push({ code: 'missing_ingredients' as const, message: 'No ingredients detected — add them before saving.', field: 'ingredients' as const });
  if (!instructions.length) warnings.push({ code: 'missing_instructions' as const, message: 'No steps detected — add them before saving.', field: 'instructions' as const });
  return {
    id: createId(),
    sourceKind: options.sourceKind ?? 'paste_text',
    sourceUrl: options.sourceUrl ?? null,
    sourceName: options.sourceName ?? null,
    imageUri: null,
    title,
    notes: null,
    servings: null,
    prepMinutes: null,
    cookMinutes: null,
    ingredients,
    instructions,
    confidence: {
      title: options.titleHint?.trim() ? 'high' : recipe.title ? 'medium' : 'low',
      ingredients: ingredients.length ? 'medium' : 'unknown',
      instructions: instructions.length ? 'medium' : 'unknown',
    },
    warnings,
    sourceEvidence: options.sourceText.slice(0, 4000),
    adapterId: options.adapterId ?? recipe.parser,
    createdAt: nowIso(),
  };
}

export function parsedRecipeFromDraft(draft: ImportDraft): ParsedRecipe {
  return {
    title: draft.title,
    ingredients: draft.ingredients.map(({ quantity, unit, name, note }) => ({ quantity, unit, name, note })),
    steps: draft.instructions.map((step) => step.text),
    parser: 'heuristic',
  };
}
