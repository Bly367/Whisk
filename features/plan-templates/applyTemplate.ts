import type {
  MealPlanEntry,
  MealPlanTemplateWithEntries,
  MealSlot,
  Repositories,
} from '@/data';
import { addDays } from '@/components/plan/weekUtils';

export type TemplateApplyPreviewEntry = {
  dayOffset: number;
  planDate: string;
  slot: MealSlot;
  recipeId: string | null;
  note: string | null;
  position: number;
};

export type TemplateApplyPreview = {
  templateId: string;
  templateName: string;
  targetWeekStart: string;
  entries: TemplateApplyPreviewEntry[];
  /** Existing plan entries that share a day+slot with a previewed template entry. */
  conflictCount: number;
};

export type TemplateApplyResult = {
  mealPlanId: string;
  targetWeekStart: string;
  templateId: string;
  createdEntryIds: string[];
  preview: TemplateApplyPreview;
};

function requireTemplate(
  repos: Pick<Repositories, 'templates'>,
  templateId: string,
): MealPlanTemplateWithEntries {
  const template = repos.templates.getById(templateId);
  if (!template) {
    throw new Error(`Meal plan template not found: ${templateId}`);
  }
  return template;
}

function buildPreviewEntries(
  template: MealPlanTemplateWithEntries,
  targetWeekStart: string,
): TemplateApplyPreviewEntry[] {
  return template.entries.map((entry) => ({
    dayOffset: entry.dayOffset,
    planDate: addDays(targetWeekStart, entry.dayOffset),
    slot: entry.slot,
    recipeId: entry.recipeId,
    note: entry.note,
    position: entry.position,
  }));
}

function countConflicts(
  existing: MealPlanEntry[],
  previewEntries: TemplateApplyPreviewEntry[],
): number {
  let count = 0;
  for (const next of previewEntries) {
    const hit = existing.some((e) => e.planDate === next.planDate && e.slot === next.slot);
    if (hit) count += 1;
  }
  return count;
}

function existingEntriesForWeek(
  repos: Pick<Repositories, 'mealPlans'>,
  weekStart: string,
): MealPlanEntry[] {
  const match = repos.mealPlans.list().find((p) => p.weekStart === weekStart);
  if (!match) return [];
  return repos.mealPlans.getById(match.id)?.entries ?? [];
}

/**
 * Build an apply preview for a target week without writing plan entries.
 * Does not create a meal plan row — conflict detection uses an existing week only.
 */
export function previewApplyTemplate(
  repos: Pick<Repositories, 'templates' | 'mealPlans'>,
  input: { templateId: string; targetWeekStart: string },
): TemplateApplyPreview {
  const template = requireTemplate(repos, input.templateId);
  const entries = buildPreviewEntries(template, input.targetWeekStart);
  const existing = existingEntriesForWeek(repos, input.targetWeekStart);
  return {
    templateId: template.id,
    templateName: template.name,
    targetWeekStart: input.targetWeekStart,
    entries,
    conflictCount: countConflicts(existing, entries),
  };
}

/**
 * Apply a template onto a target week (merge — existing entries are kept).
 * Returns created entry ids for undo.
 */
export function applyTemplateToWeek(
  repos: Pick<Repositories, 'templates' | 'mealPlans'>,
  input: { templateId: string; targetWeekStart: string },
): TemplateApplyResult {
  const preview = previewApplyTemplate(repos, input);
  const plan = repos.mealPlans.getOrCreateForWeek(input.targetWeekStart);
  const createdEntryIds: string[] = [];

  for (const entry of preview.entries) {
    const siblings = plan.entries.filter(
      (e) => e.planDate === entry.planDate && e.slot === entry.slot,
    );
    const created = repos.mealPlans.addEntry({
      mealPlanId: plan.id,
      recipeId: entry.recipeId,
      planDate: entry.planDate,
      slot: entry.slot,
      note: entry.note,
      position: Math.max(entry.position, siblings.length),
    });
    createdEntryIds.push(created.id);
    plan.entries.push(created);
  }

  return {
    mealPlanId: plan.id,
    targetWeekStart: input.targetWeekStart,
    templateId: input.templateId,
    createdEntryIds,
    preview,
  };
}

/**
 * Undo a prior apply by removing only the entries that apply created.
 */
export function undoApplyTemplate(
  repos: Pick<Repositories, 'mealPlans'>,
  applied: Pick<TemplateApplyResult, 'createdEntryIds'>,
): void {
  for (const entryId of applied.createdEntryIds) {
    repos.mealPlans.removeEntry(entryId);
  }
}
