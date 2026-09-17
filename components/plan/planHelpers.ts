import type { MealPlanEntry, MealSlot, RecipeListItem } from '@/data/contracts';

export const MEAL_SLOTS: { slot: MealSlot; label: string }[] = [
  { slot: 'breakfast', label: 'Breakfast' },
  { slot: 'lunch', label: 'Lunch' },
  { slot: 'dinner', label: 'Dinner' },
  { slot: 'snack', label: 'Snack' },
];

export function slotLabel(slot: MealSlot): string {
  return MEAL_SLOTS.find((s) => s.slot === slot)?.label ?? slot;
}

export function recipeTitleMap(recipes: RecipeListItem[]): Map<string, RecipeListItem> {
  return new Map(recipes.map((r) => [r.id, r]));
}

export function entriesForDaySlot(
  entries: MealPlanEntry[],
  planDate: string,
  slot: MealSlot,
): MealPlanEntry[] {
  return entries
    .filter((e) => e.planDate === planDate && e.slot === slot)
    .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
}

export type GroceryIngredient = {
  name: string;
  quantity: string | null;
  unit: string | null;
  aisle: string | null;
};

export type GroceryPreviewLine = {
  recipeId: string;
  recipeTitle: string;
  mealCount: number;
  ingredientCount: number;
  ingredients: GroceryIngredient[];
};

/** Multiply a kitchen quantity by meal placements when numeric. */
export function scaleQuantityForMeals(
  quantity: string | null | undefined,
  mealCount: number,
): string | null {
  if (quantity == null) return null;
  const raw = quantity.trim();
  if (!raw) return null;
  if (!Number.isFinite(mealCount) || mealCount <= 1) return raw;

  const mixed = raw.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const value = Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
    return formatScaledNumber(value * mealCount);
  }

  const frac = raw.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const value = Number(frac[1]) / Number(frac[2]);
    return formatScaledNumber(value * mealCount);
  }

  const decimal = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(decimal)) {
    // Non-numeric ("to taste") — keep as written; mealCount still shown in summary.
    return raw;
  }
  return formatScaledNumber(decimal * mealCount);
}

function formatScaledNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}

function scaleIngredients(
  ingredients: GroceryIngredient[],
  mealCount: number,
): GroceryIngredient[] {
  if (mealCount <= 1) return ingredients;
  return ingredients.map((ing) => ({
    ...ing,
    quantity: scaleQuantityForMeals(ing.quantity, mealCount),
  }));
}

/**
 * Summarize unique recipes on the plan for grocery handoff (W6).
 * Quantities are multiplied by how many times the recipe appears this week
 * so summary + commit do not under-shop.
 */
export function buildGroceryPreview(
  entries: MealPlanEntry[],
  recipesById: Map<string, RecipeListItem>,
  getIngredients: (recipeId: string) => GroceryIngredient[],
): GroceryPreviewLine[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.recipeId) continue;
    counts.set(entry.recipeId, (counts.get(entry.recipeId) ?? 0) + 1);
  }

  const lines: GroceryPreviewLine[] = [];
  for (const [recipeId, mealCount] of counts) {
    const recipe = recipesById.get(recipeId);
    const ingredients = scaleIngredients(getIngredients(recipeId), mealCount);
    lines.push({
      recipeId,
      recipeTitle: recipe?.title ?? 'Unknown recipe',
      mealCount,
      ingredientCount: ingredients.length,
      ingredients,
    });
  }

  return lines.sort((a, b) => a.recipeTitle.localeCompare(b.recipeTitle));
}
