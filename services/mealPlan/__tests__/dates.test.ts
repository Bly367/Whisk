import { describe, expect, it } from 'vitest';
import { dateKey, normalizeMealPlan, weekDates } from '../dates';

describe('meal plan dates', () => {
  it('builds Monday through Sunday for the selected week', () => {
    const dates = weekDates(0, new Date(2026, 6, 30));
    expect(dates.map(dateKey)).toEqual([
      '2026-07-27',
      '2026-07-28',
      '2026-07-29',
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
      '2026-08-02',
    ]);
  });

  it('migrates legacy day-index dinner slots', () => {
    const result = normalizeMealPlan(
      [{ dayIndex: 2, recipeId: 'recipe-1' }],
      new Date(2026, 6, 30),
    );
    expect(result[0]).toMatchObject({
      date: '2026-07-29',
      mealType: 'dinner',
      recipeId: 'recipe-1',
    });
  });
});
