import {
  addDays,
  formatWeekRange,
  startOfWeek,
  shiftWeek,
  toDateOnly,
  weekDays,
} from '@/components/plan/weekUtils';
import { entriesForDaySlot } from '@/components/plan/planHelpers';
import { createRepositories } from '@/data/repositories';
import { createTestDbClient } from '@/data/testing/createTestDb';
import { daysBetween, parseDateOnly, startOfWeekMonday } from '@/lib/dates';

describe('weekUtils', () => {
  it('runs under a time zone with daylight saving time', () => {
    expect(new Date(2027, 0, 1).getTimezoneOffset()).not.toBe(
      new Date(2027, 6, 1).getTimezoneOffset(),
    );
  });

  it('starts the week on Monday', () => {
    // Thursday Sep 17, 2026
    const thursday = new Date(2026, 8, 17);
    expect(startOfWeek(thursday)).toBe('2026-09-14');
    expect(addDays('2026-09-14', 6)).toBe('2026-09-20');
    expect(formatWeekRange('2026-09-14')).toContain('14');
  });

  it('marks today inside the week', () => {
    const today = new Date(2026, 8, 17);
    const days = weekDays('2026-09-14', today);
    expect(days).toHaveLength(7);
    expect(days[0].shortLabel).toBe('Mon');
    expect(days.find((d) => d.isToday)?.date).toBe(toDateOnly(today));
  });

  it('keeps each day of a DST-ending week distinct in Los Angeles', () => {
    expect(weekDays('2026-10-26').map((day) => day.date)).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
  });

  it('keeps calendar arithmetic correct across the DST-starting week', () => {
    expect(addDays('2027-03-14', 1)).toBe('2027-03-15');
    expect(weekDays('2027-03-08').map((day) => day.date)).toEqual([
      '2027-03-08',
      '2027-03-09',
      '2027-03-10',
      '2027-03-11',
      '2027-03-12',
      '2027-03-13',
      '2027-03-14',
    ]);
  });

  it('shifts weeks and days across DST boundaries by calendar date', () => {
    expect(shiftWeek('2026-10-26', 1)).toBe('2026-11-02');
    expect(shiftWeek('2027-03-15', -1)).toBe('2027-03-08');
    expect(addDays('2027-03-15', -1)).toBe('2027-03-14');
  });
});

describe('lib dates', () => {
  it('uses local calendar dates without 24-hour offsets', () => {
    expect(parseDateOnly('2026-11-01').getDate()).toBe(1);
    expect(startOfWeekMonday(new Date(2026, 10, 1))).toBe('2026-10-26');
    expect(daysBetween('2026-10-26', '2026-11-01')).toBe(6);
    expect(daysBetween('2027-03-08', '2027-03-15')).toBe(7);
  });
});

describe('planHelpers + mealPlans persistence', () => {
  it('places a recipe on a day/slot and reloads offline', () => {
    const db = createTestDbClient();
    const { recipes, mealPlans } = createRepositories(db);
    const recipe = recipes.create({
      title: 'Shakshuka',
      ingredients: [
        { name: 'eggs', quantity: '4' },
        { name: 'tomatoes', quantity: '3' },
      ],
      isFavorite: true,
    });

    const plan = mealPlans.getOrCreateForWeek('2026-09-14');
    mealPlans.addEntry({
      mealPlanId: plan.id,
      recipeId: recipe.id,
      planDate: '2026-09-16',
      slot: 'breakfast',
    });

    const reloaded = mealPlans.getOrCreateForWeek('2026-09-14');
    const slotEntries = entriesForDaySlot(reloaded.entries, '2026-09-16', 'breakfast');
    expect(slotEntries).toHaveLength(1);
    expect(slotEntries[0].recipeId).toBe(recipe.id);

    mealPlans.updateEntry(slotEntries[0].id, { slot: 'lunch', planDate: '2026-09-17' });
    mealPlans.addEntry({
      mealPlanId: plan.id,
      recipeId: recipe.id,
      planDate: '2026-09-17',
      slot: 'lunch',
      position: 1,
    });

    const after = mealPlans.getById(plan.id);
    expect(after?.entries).toHaveLength(2);
  });
});
