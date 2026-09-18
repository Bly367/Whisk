/**
 * Pantry ↔ recipe ingredient coverage scoring (P2-W4).
 * Matching is name-based with word boundaries (not silent substring traps).
 */

export type PantryCoverage = {
  matchedCount: number;
  totalIngredients: number;
  /** 0..1; recipes with no ingredients score 0. */
  ratio: number;
  matchedNames: string[];
  missingNames: string[];
};

export function normalizePantryName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True when either name equals the other or appears as a whole-word phrase. */
export function pantryNamesMatch(pantryName: string, ingredientName: string): boolean {
  const pantry = normalizePantryName(pantryName);
  const ingredient = normalizePantryName(ingredientName);
  if (!pantry || !ingredient) return false;
  if (pantry === ingredient) return true;

  const asWholePhrase = (needle: string, haystack: string): boolean => {
    const pattern = new RegExp(`(?:^|\\s)${escapeRegExp(needle)}(?:\\s|$)`);
    return pattern.test(haystack);
  };

  return asWholePhrase(pantry, ingredient) || asWholePhrase(ingredient, pantry);
}

export function scorePantryCoverage(
  ingredientNames: string[],
  pantryNames: string[],
): PantryCoverage {
  const ingredients = ingredientNames.map((n) => n.trim()).filter(Boolean);
  const pantry = pantryNames.map((n) => n.trim()).filter(Boolean);

  if (ingredients.length === 0) {
    return {
      matchedCount: 0,
      totalIngredients: 0,
      ratio: 0,
      matchedNames: [],
      missingNames: [],
    };
  }

  const matchedNames: string[] = [];
  const missingNames: string[] = [];

  for (const ingredient of ingredients) {
    const hit = pantry.some((item) => pantryNamesMatch(item, ingredient));
    if (hit) {
      matchedNames.push(ingredient);
    } else {
      missingNames.push(ingredient);
    }
  }

  const matchedCount = matchedNames.length;
  return {
    matchedCount,
    totalIngredients: ingredients.length,
    ratio: matchedCount / ingredients.length,
    matchedNames,
    missingNames,
  };
}

export function formatPantryCoverageLabel(coverage: PantryCoverage): string {
  if (coverage.totalIngredients === 0) {
    return 'No ingredients to compare with your pantry';
  }
  if (coverage.matchedCount === 0) {
    return `0 of ${coverage.totalIngredients} ingredients in your pantry`;
  }
  return `Uses ${coverage.matchedCount} of ${coverage.totalIngredients} ingredients from your pantry`;
}
