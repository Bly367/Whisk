import type { GroceryListWithItems, Ingredient, MealPlanWithEntries, Repositories } from '@/data';
import { resolveAisle } from '@/features/shop/aisle';
import {
  mergeGroceryLines,
  type GrocerySourceLine,
  type MergedGroceryDraft,
} from '@/features/shop/merge';
import { formatWeekLabel, startOfWeekMonday } from '@/features/shop/week';

export type GroceryGeneratePreview = {
  mealPlanId: string;
  weekStart: string;
  listName: string;
  recipeCount: number;
  drafts: MergedGroceryDraft[];
  mergedCount: number;
  rawLineCount: number;
};

function ingredientToSource(
  ingredient: Ingredient,
  recipeId: string,
  recipeTitle: string,
): GrocerySourceLine {
  return {
    name: ingredient.name,
    quantity: ingredient.quantity ?? null,
    unit: ingredient.unit ?? null,
    aisle: resolveAisle(ingredient.name, ingredient.aisle),
    recipeId,
    recipeTitle,
  };
}

/**
 * Collect plan ingredients and build a merge preview (does not write SQLite).
 */
export function buildGroceryPreviewFromPlan(
  repos: Pick<Repositories, 'recipes' | 'mealPlans'>,
  options?: { weekStart?: string; now?: Date },
): GroceryGeneratePreview | null {
  const weekStart = options?.weekStart ?? startOfWeekMonday(options?.now ?? new Date());
  const plan: MealPlanWithEntries = repos.mealPlans.getOrCreateForWeek(weekStart);
  const recipeIds = [
    ...new Set(
      plan.entries
        .map((e) => e.recipeId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  ];

  if (recipeIds.length === 0) {
    return null;
  }

  const lines: GrocerySourceLine[] = [];
  for (const recipeId of recipeIds) {
    const recipe = repos.recipes.getById(recipeId);
    if (!recipe) continue;
    for (const ingredient of recipe.ingredients) {
      lines.push(ingredientToSource(ingredient, recipe.id, recipe.title));
    }
  }

  if (lines.length === 0) {
    return null;
  }

  const drafts = mergeGroceryLines(lines);
  const mergedCount = drafts.filter((d) => d.wasMerged).length;

  return {
    mealPlanId: plan.id,
    weekStart,
    listName: formatWeekLabel(weekStart),
    recipeCount: recipeIds.length,
    drafts,
    mergedCount,
    rawLineCount: lines.length,
  };
}

/**
 * Persist preview as a grocery list via `@/data` grocery repository.
 */
export function commitGroceryPreview(
  grocery: Repositories['grocery'],
  preview: GroceryGeneratePreview,
): GroceryListWithItems {
  return grocery.create({
    name: preview.listName,
    mealPlanId: preview.mealPlanId,
    items: preview.drafts.map((draft, index) => ({
      name: draft.name,
      quantity: draft.quantity,
      unit: draft.unit,
      aisle: draft.aisle,
      recipeId: draft.recipeId,
      recipeTitle: draft.recipeTitle,
      mergeKey: draft.mergeKey,
      position: index,
    })),
  });
}

export function generateGroceryListFromPlan(
  repos: Pick<Repositories, 'recipes' | 'mealPlans' | 'grocery'>,
  options?: { weekStart?: string; now?: Date },
): GroceryListWithItems | null {
  const preview = buildGroceryPreviewFromPlan(repos, options);
  if (!preview) return null;
  return commitGroceryPreview(repos.grocery, preview);
}
