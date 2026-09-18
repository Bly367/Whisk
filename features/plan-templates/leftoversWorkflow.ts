import type { LeftoversLink, MealPlanEntry, MealSlot, Repositories } from '@/data';

export type ScheduleLeftoversInput = {
  sourceMealPlanEntryId: string;
  targetPlanDate: string;
  targetSlot: MealSlot;
  /** Defaults to the source entry's meal plan. */
  targetMealPlanId?: string;
  label?: string | null;
  servingsRemaining?: number | null;
  note?: string | null;
};

export type ScheduleLeftoversResult = {
  link: LeftoversLink;
  targetEntry: MealPlanEntry;
  sourceEntry: MealPlanEntry;
  sourceRecipeId: string | null;
};

function findEntryAcrossPlans(
  repos: Pick<Repositories, 'mealPlans'>,
  entryId: string,
): { planId: string; entry: MealPlanEntry } | null {
  for (const planMeta of repos.mealPlans.list()) {
    const plan = repos.mealPlans.getById(planMeta.id);
    if (!plan) continue;
    const entry = plan.entries.find((e) => e.id === entryId);
    if (entry) {
      return { planId: plan.id, entry };
    }
  }
  return null;
}

/**
 * Place leftovers into a later plan slot.
 * Reuses the source recipe id — never deletes or mutates the source recipe/entry.
 */
export function scheduleLeftovers(
  repos: Pick<Repositories, 'mealPlans' | 'leftovers' | 'recipes'>,
  input: ScheduleLeftoversInput,
): ScheduleLeftoversResult {
  const found = findEntryAcrossPlans(repos, input.sourceMealPlanEntryId);
  if (!found) {
    throw new Error(`Meal plan entry not found: ${input.sourceMealPlanEntryId}`);
  }

  const { entry: sourceEntry, planId: sourcePlanId } = found;
  const sourceRecipeId = sourceEntry.recipeId;

  if (sourceRecipeId) {
    const recipe = repos.recipes.getById(sourceRecipeId);
    if (!recipe || recipe.deletedAt) {
      throw new Error(`Source recipe not found: ${sourceRecipeId}`);
    }
  }

  const targetMealPlanId = input.targetMealPlanId ?? sourcePlanId;
  const targetPlan = repos.mealPlans.getById(targetMealPlanId);
  if (!targetPlan) {
    throw new Error(`Meal plan not found: ${targetMealPlanId}`);
  }

  const siblings = targetPlan.entries.filter(
    (e) => e.planDate === input.targetPlanDate && e.slot === input.targetSlot,
  );

  const defaultNote =
    input.label?.trim() ||
    (sourceRecipeId
      ? `Leftovers`
      : 'Leftovers');
  const note = input.note?.trim() || defaultNote;

  const targetEntry = repos.mealPlans.addEntry({
    mealPlanId: targetMealPlanId,
    recipeId: sourceRecipeId,
    planDate: input.targetPlanDate,
    slot: input.targetSlot,
    note,
    position: siblings.length,
  });

  const link = repos.leftovers.create({
    sourceRecipeId,
    sourceMealPlanEntryId: sourceEntry.id,
    leftoverRecipeId: sourceRecipeId,
    targetMealPlanEntryId: targetEntry.id,
    householdId: targetPlan.householdId,
    label: input.label ?? null,
    servingsRemaining: input.servingsRemaining ?? null,
  });

  // Source recipe + entry must remain unchanged (assert via return of originals).
  return {
    link,
    targetEntry,
    sourceEntry,
    sourceRecipeId,
  };
}

/**
 * Undo leftovers scheduling: remove the target plan entry and soft-delete the link.
 * Source recipe and source plan entry are left untouched.
 */
export function undoScheduleLeftovers(
  repos: Pick<Repositories, 'mealPlans' | 'leftovers'>,
  result: Pick<ScheduleLeftoversResult, 'link' | 'targetEntry'>,
): void {
  repos.mealPlans.removeEntry(result.targetEntry.id);
  repos.leftovers.softDelete(result.link.id);
}
