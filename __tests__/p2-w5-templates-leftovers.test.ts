/**
 * P2-W5 — Plan templates & leftovers (test-first).
 *
 * Acceptance covered:
 * - Save week (or selection) as template
 * - Apply template to a new week with preview
 * - Apply / undo restores prior plan entries
 * - Leftovers create plan entries without destroying source recipe
 */
import { createRepositories } from '@/data/repositories';
import { createTestDbClient } from '@/data/testing/createTestDb';
import { useSyncStatusStore } from '@/data/sync/statusStore';
import {
  applyTemplateToWeek,
  previewApplyTemplate,
  undoApplyTemplate,
} from '@/features/plan-templates/applyTemplate';
import {
  saveSelectionAsTemplate,
  saveWeekAsTemplate,
} from '@/features/plan-templates/saveTemplate';
import {
  scheduleLeftovers,
  undoScheduleLeftovers,
  defaultLaterTargetDate,
  filterLaterWeekDates,
} from '@/features/plan-templates/leftoversWorkflow';
import { weekDays } from '@/components/plan/weekUtils';

function seedWeekPlan() {
  const db = createTestDbClient();
  const repos = createRepositories(db);
  const chili = repos.recipes.create({ title: 'Chili' });
  const salad = repos.recipes.create({ title: 'Salad' });
  const soup = repos.recipes.create({ title: 'Soup' });
  const plan = repos.mealPlans.getOrCreateForWeek('2026-09-14');
  const monDinner = repos.mealPlans.addEntry({
    mealPlanId: plan.id,
    recipeId: chili.id,
    planDate: '2026-09-14',
    slot: 'dinner',
    position: 0,
  });
  const wedLunch = repos.mealPlans.addEntry({
    mealPlanId: plan.id,
    recipeId: salad.id,
    planDate: '2026-09-16',
    slot: 'lunch',
    position: 0,
  });
  const friDinner = repos.mealPlans.addEntry({
    mealPlanId: plan.id,
    recipeId: soup.id,
    planDate: '2026-09-18',
    slot: 'dinner',
    position: 0,
  });
  return { db, repos, chili, salad, soup, plan, monDinner, wedLunch, friDinner };
}

describe('P2-W5 save week / selection as template', () => {
  beforeEach(() => {
    useSyncStatusStore.getState().resetToLocalOk();
  });

  it('saves an entire week as a reusable template with relative day offsets', () => {
    const { repos, plan, chili, salad, soup } = seedWeekPlan();

    const template = saveWeekAsTemplate(repos, {
      name: 'Comfort week',
      mealPlanId: plan.id,
      weekStart: '2026-09-14',
    });

    expect(template.name).toBe('Comfort week');
    expect(template.sourceMealPlanId).toBe(plan.id);
    expect(template.entries).toHaveLength(3);
    expect(template.entries.map((e) => e.dayOffset).sort()).toEqual([0, 2, 4]);
    expect(template.entries.map((e) => e.recipeId).sort()).toEqual(
      [chili.id, salad.id, soup.id].sort(),
    );
    // Source plan must remain intact
    expect(repos.mealPlans.getById(plan.id)?.entries).toHaveLength(3);
  });

  it('saves only a selection of entries as a template', () => {
    const { repos, plan, monDinner, friDinner, chili, soup } = seedWeekPlan();

    const template = saveSelectionAsTemplate(repos, {
      name: 'Dinner duo',
      weekStart: '2026-09-14',
      entryIds: [monDinner.id, friDinner.id],
      sourceMealPlanId: plan.id,
    });

    expect(template.name).toBe('Dinner duo');
    expect(template.entries).toHaveLength(2);
    expect(template.entries.map((e) => e.dayOffset).sort()).toEqual([0, 4]);
    expect(template.entries.map((e) => e.recipeId).sort()).toEqual(
      [chili.id, soup.id].sort(),
    );
    expect(template.entries.every((e) => e.slot === 'dinner')).toBe(true);
  });
});

describe('P2-W5 apply template with preview + undo', () => {
  beforeEach(() => {
    useSyncStatusStore.getState().resetToLocalOk();
  });

  it('previews apply onto a new week without writing plan entries', () => {
    const { repos, plan } = seedWeekPlan();
    const template = saveWeekAsTemplate(repos, {
      name: 'Comfort week',
      mealPlanId: plan.id,
      weekStart: '2026-09-14',
    });

    const targetWeek = '2026-09-21';
    const preview = previewApplyTemplate(repos, {
      templateId: template.id,
      targetWeekStart: targetWeek,
    });

    expect(preview.templateId).toBe(template.id);
    expect(preview.templateName).toBe('Comfort week');
    expect(preview.targetWeekStart).toBe(targetWeek);
    expect(preview.entries).toHaveLength(3);
    expect(preview.entries.map((e) => e.planDate).sort()).toEqual([
      '2026-09-21',
      '2026-09-23',
      '2026-09-25',
    ]);
    expect(preview.conflictCount).toBe(0);

    // Preview must not mutate the target week
    const targetPlan = repos.mealPlans.getOrCreateForWeek(targetWeek);
    expect(targetPlan.entries).toHaveLength(0);
  });

  it('applies a template to a new week and reports conflicts in preview', () => {
    const { repos, plan, chili } = seedWeekPlan();
    const template = saveWeekAsTemplate(repos, {
      name: 'Comfort week',
      mealPlanId: plan.id,
      weekStart: '2026-09-14',
    });

    const targetWeek = '2026-09-21';
    const targetPlan = repos.mealPlans.getOrCreateForWeek(targetWeek);
    repos.mealPlans.addEntry({
      mealPlanId: targetPlan.id,
      recipeId: chili.id,
      planDate: '2026-09-21',
      slot: 'dinner',
    });

    const preview = previewApplyTemplate(repos, {
      templateId: template.id,
      targetWeekStart: targetWeek,
    });
    expect(preview.conflictCount).toBe(1);

    const applied = applyTemplateToWeek(repos, {
      templateId: template.id,
      targetWeekStart: targetWeek,
    });

    expect(applied.createdEntryIds).toHaveLength(3);
    const after = repos.mealPlans.getById(applied.mealPlanId);
    expect(after?.entries.length).toBeGreaterThanOrEqual(4);
    // Existing conflict entry remains; apply merges (does not destroy prior meals)
    expect(after?.entries.some((e) => e.id !== applied.createdEntryIds[0])).toBe(true);
  });

  it('undoes an apply by removing only the entries it created', () => {
    const { repos, plan, chili } = seedWeekPlan();
    const template = saveWeekAsTemplate(repos, {
      name: 'Comfort week',
      mealPlanId: plan.id,
      weekStart: '2026-09-14',
    });

    const targetWeek = '2026-09-21';
    const targetPlan = repos.mealPlans.getOrCreateForWeek(targetWeek);
    const kept = repos.mealPlans.addEntry({
      mealPlanId: targetPlan.id,
      recipeId: chili.id,
      planDate: '2026-09-22',
      slot: 'lunch',
      note: 'Already planned',
    });

    const applied = applyTemplateToWeek(repos, {
      templateId: template.id,
      targetWeekStart: targetWeek,
    });
    expect(applied.createdEntryIds).toHaveLength(3);

    undoApplyTemplate(repos, applied);

    const afterUndo = repos.mealPlans.getById(targetPlan.id);
    expect(afterUndo?.entries).toHaveLength(1);
    expect(afterUndo?.entries[0].id).toBe(kept.id);
    expect(afterUndo?.entries[0].note).toBe('Already planned');
  });
});

describe('P2-W5 leftovers → plan entries', () => {
  beforeEach(() => {
    useSyncStatusStore.getState().resetToLocalOk();
  });

  it('schedules leftovers into a later slot without destroying the source recipe', () => {
    const { repos, plan, monDinner, chili } = seedWeekPlan();

    const result = scheduleLeftovers(repos, {
      sourceMealPlanEntryId: monDinner.id,
      targetPlanDate: '2026-09-15',
      targetSlot: 'lunch',
      label: 'Chili leftovers',
      servingsRemaining: 2,
    });

    expect(result.targetEntry.recipeId).toBe(chili.id);
    expect(result.targetEntry.planDate).toBe('2026-09-15');
    expect(result.targetEntry.slot).toBe('lunch');
    expect(result.targetEntry.note).toMatch(/leftover/i);
    expect(result.link.sourceRecipeId).toBe(chili.id);
    expect(result.link.sourceMealPlanEntryId).toBe(monDinner.id);
    expect(result.link.targetMealPlanEntryId).toBe(result.targetEntry.id);
    expect(result.link.label).toBe('Chili leftovers');
    expect(result.link.servingsRemaining).toBe(2);

    // Source recipe and source plan entry remain intact
    expect(repos.recipes.getById(chili.id)?.title).toBe('Chili');
    expect(repos.recipes.getById(chili.id)?.deletedAt).toBeNull();
    const sourceEntry = repos.mealPlans
      .getById(plan.id)
      ?.entries.find((e) => e.id === monDinner.id);
    expect(sourceEntry?.recipeId).toBe(chili.id);
    expect(sourceEntry?.planDate).toBe('2026-09-14');
    expect(sourceEntry?.slot).toBe('dinner');
  });

  it('undoes leftovers scheduling by removing the target entry and soft-deleting the link', () => {
    const { repos, plan, monDinner } = seedWeekPlan();

    const result = scheduleLeftovers(repos, {
      sourceMealPlanEntryId: monDinner.id,
      targetPlanDate: '2026-09-17',
      targetSlot: 'dinner',
    });

    undoScheduleLeftovers(repos, result);

    const after = repos.mealPlans.getById(plan.id);
    expect(after?.entries.find((e) => e.id === result.targetEntry.id)).toBeUndefined();
    expect(repos.leftovers.getById(result.link.id)).toBeNull();
    // Source entry still present
    expect(after?.entries.find((e) => e.id === monDinner.id)).toBeTruthy();
  });

  it('rejects a target date on or before the source meal date', () => {
    const { repos, monDinner } = seedWeekPlan();

    expect(() =>
      scheduleLeftovers(repos, {
        sourceMealPlanEntryId: monDinner.id,
        targetPlanDate: '2026-09-14',
        targetSlot: 'lunch',
      }),
    ).toThrow(/later/i);

    expect(() =>
      scheduleLeftovers(repos, {
        sourceMealPlanEntryId: monDinner.id,
        targetPlanDate: '2026-09-13',
        targetSlot: 'dinner',
      }),
    ).toThrow(/later/i);
  });

  it('does not allow last-day-of-week leftovers to fall back to an earlier weekday', () => {
    const db = createTestDbClient();
    const repos = createRepositories(db);
    const roast = repos.recipes.create({ title: 'Sunday Roast' });
    // Week Mon 2026-09-14 … Sun 2026-09-20
    const plan = repos.mealPlans.getOrCreateForWeek('2026-09-14');
    const sundayDinner = repos.mealPlans.addEntry({
      mealPlanId: plan.id,
      recipeId: roast.id,
      planDate: '2026-09-20',
      slot: 'dinner',
    });

    const week = weekDays('2026-09-14');
    expect(filterLaterWeekDates('2026-09-20', week)).toEqual([]);
    // Must not return Monday (days[0]) — that would schedule leftovers earlier.
    expect(defaultLaterTargetDate('2026-09-20', week)).toBeNull();

    expect(() =>
      scheduleLeftovers(repos, {
        sourceMealPlanEntryId: sundayDinner.id,
        targetPlanDate: '2026-09-14',
        targetSlot: 'lunch',
        label: 'Roast leftovers',
      }),
    ).toThrow(/later/i);

    // Explicit next-week date (after source) is allowed.
    const nextWeek = scheduleLeftovers(repos, {
      sourceMealPlanEntryId: sundayDinner.id,
      targetPlanDate: '2026-09-21',
      targetSlot: 'lunch',
      targetMealPlanId: repos.mealPlans.getOrCreateForWeek('2026-09-21').id,
      label: 'Roast leftovers',
    });
    expect(nextWeek.targetEntry.planDate).toBe('2026-09-21');
    expect(repos.recipes.getById(roast.id)?.title).toBe('Sunday Roast');
  });

  it('defaults leftovers target to the next later day in the week when available', () => {
    const week = weekDays('2026-09-14');
    expect(defaultLaterTargetDate('2026-09-14', week)).toBe('2026-09-15');
    expect(filterLaterWeekDates('2026-09-18', week).map((d) => d.date)).toEqual([
      '2026-09-19',
      '2026-09-20',
    ]);
  });
});
