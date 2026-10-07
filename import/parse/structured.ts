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

function singular(token: string): string {
  if (token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (/(ch|sh|ss|x)es$/.test(token)) return token.slice(0, -2);
  if (token.endsWith('oes')) return token.slice(0, -2);
  if (token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

function isGrounded(name: string, source: string): boolean {
  const sourceTokens = new Set(normalizeForGrounding(source).split(' ').filter(Boolean).map(singular));
  const descriptors = new Set(['large', 'small', 'medium', 'fresh', 'extra', 'virgin', 'all', 'purpose', 'chopped', 'minced', 'diced', 'sliced', 'ground', 'clove', 'cloves', 'leaf', 'leaves', 'sprig', 'sprigs']);
  const tokens = normalizeForGrounding(name).split(' ').filter(Boolean).filter((token) => !descriptors.has(token) && !descriptors.has(singular(token))).map(singular);
  if (!tokens.length) return false;
  const hits = tokens.filter((token) => sourceTokens.has(token));
  return hits.length === tokens.length || (sourceTokens.has(tokens[tokens.length - 1]) && hits.length >= Math.ceil(tokens.length / 2));
}

/** Keep model output tied to words present in the source supplied by the user. */
export function groundParsedRecipe(recipe: ParsedRecipe, sourceText: string): ParsedRecipe | null {
  const source = normalizeForGrounding(sourceText);
  const ingredients = recipe.ingredients
    .filter((ingredient) => ingredient.name.trim() && isGrounded(ingredient.name, source))
    .map((ingredient) => ({
      ...ingredient,
      name: ingredient.name.trim(),
      quantity: typeof ingredient.quantity === 'string' ? ingredient.quantity.trim() || null : null,
      unit: typeof ingredient.unit === 'string' ? ingredient.unit.trim() || null : null,
      note: typeof ingredient.note === 'string' ? ingredient.note.trim() || null : null,
    }));
  const steps = recipe.steps.map((step) => step.trim()).filter(Boolean);
  if (!ingredients.length && !steps.length) return null;
  return { ...recipe, title: recipe.title.trim(), ingredients, steps };
}

function looksLikeIngredient(line: string): boolean {
  return /^(?:[-*•]\s*)?(?:\d|[¼½¾⅓⅔⅛⅜⅝⅞]|(?:one|two|three)\s)/i.test(line)
    || /^(?:[-*•]\s*)?(?:a|an)\s+(?:cup|tbsp|tsp|oz|lb|gram|kg|ml|liter|pinch|dash|clove|can|stick|bunch|sprig|slice)\b/i.test(line);
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
  return !title.trim() || /^recipe from\b/i.test(title);
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
    title: options.titleHint?.trim() && isJunkTitle(recipe.title) ? 'high' : recipe.title ? 'medium' : 'low',
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
