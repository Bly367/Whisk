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

export function recipeTitleMap(
  recipes: RecipeListItem[],
): Map<string, RecipeListItem> {
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

export type GroceryPreviewLine = {
  recipeId: string;
  recipeTitle: string;
  mealCount: number;
  ingredientCount: number;
  ingredients: Array<{
    name: string;
    quantity: string | null;
    unit: string | null;
    aisle: string | null;
  }>;
};

/** Summarize unique recipes on the plan for grocery handoff (W6). */
export function buildGroceryPreview(
  entries: MealPlanEntry[],
  recipesById: Map<string, RecipeListItem>,
  getIngredients: (
    recipeId: string,
  ) => Array<{
    name: string;
    quantity: string | null;
    unit: string | null;
    aisle: string | null;
  }>,
): GroceryPreviewLine[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.recipeId) continue;
    counts.set(entry.recipeId, (counts.get(entry.recipeId) ?? 0) + 1);
  }

  const lines: GroceryPreviewLine[] = [];
  for (const [recipeId, mealCount] of counts) {
    const recipe = recipesById.get(recipeId);
    const ingredients = getIngredients(recipeId);
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
