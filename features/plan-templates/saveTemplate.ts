import type { MealPlanTemplateWithEntries, MealSlot, Repositories } from '@/data';
import { addDays } from '@/components/plan/weekUtils';

export type SaveWeekAsTemplateInput = {
  name: string;
  mealPlanId: string;
  weekStart: string;
  householdId?: string | null;
};

export type SaveSelectionAsTemplateInput = {
  name: string;
  weekStart: string;
  entryIds: string[];
  sourceMealPlanId?: string | null;
  householdId?: string | null;
};

/**
 * Persist the full week plan as a reusable template (relative day offsets).
 */
export function saveWeekAsTemplate(
  repos: Pick<Repositories, 'templates'>,
  input: SaveWeekAsTemplateInput,
): MealPlanTemplateWithEntries {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Template name is required');
  }
  return repos.templates.createFromMealPlan({
    name,
    mealPlanId: input.mealPlanId,
    weekStart: input.weekStart,
    householdId: input.householdId,
  });
}

/**
 * Persist only the selected meal-plan entries as a template.
 * Day offsets are relative to `weekStart`.
 */
export function saveSelectionAsTemplate(
  repos: Pick<Repositories, 'templates' | 'mealPlans'>,
  input: SaveSelectionAsTemplateInput,
): MealPlanTemplateWithEntries {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Template name is required');
  }
  if (input.entryIds.length === 0) {
    throw new Error('Select at least one meal to save as a template');
  }

  const entryIdSet = new Set(input.entryIds);
  const plans = repos.mealPlans.list();
  const selected: {
    recipeId: string | null;
    dayOffset: number;
    slot: MealSlot;
    note: string | null;
    position: number;
  }[] = [];

  let sourceMealPlanId = input.sourceMealPlanId ?? null;

  for (const planMeta of plans) {
    const plan = repos.mealPlans.getById(planMeta.id);
    if (!plan) continue;
    for (const entry of plan.entries) {
      if (!entryIdSet.has(entry.id)) continue;
      if (!sourceMealPlanId) {
        sourceMealPlanId = plan.id;
      }
      const start = Date.parse(`${input.weekStart}T00:00:00.000Z`);
      const day = Date.parse(`${entry.planDate}T00:00:00.000Z`);
      const dayOffset =
        Number.isNaN(start) || Number.isNaN(day)
          ? 0
          : Math.round((day - start) / (24 * 60 * 60 * 1000));
      selected.push({
        recipeId: entry.recipeId,
        dayOffset,
        slot: entry.slot,
        note: entry.note,
        position: entry.position,
      });
    }
  }

  if (selected.length === 0) {
    throw new Error('No matching meal plan entries found for selection');
  }
  if (selected.length !== entryIdSet.size) {
    throw new Error('One or more selected meals could not be found');
  }

  return repos.templates.createFromEntries({
    name,
    sourceMealPlanId,
    householdId: input.householdId,
    entries: selected,
  });
}

/** Helper exported for UI previews that need absolute dates from offsets. */
export function planDateForOffset(weekStart: string, dayOffset: number): string {
  return addDays(weekStart, dayOffset);
}
