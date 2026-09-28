import type { MealPlanTemplateWithEntries, MealSlot, Repositories } from '@/data';
import { daysBetween } from '@/lib/dates';

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
      const dayOffset = dayOffsetFromWeekStart(input.weekStart, entry.planDate);
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

function dayOffsetFromWeekStart(weekStart: string, planDate: string): number {
  const days = daysBetween(weekStart, planDate);
  return days >= 0 ? days : 0;
}
