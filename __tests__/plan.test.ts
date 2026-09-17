import {
  addDays,
  formatWeekRange,
  startOfWeek,
  toDateOnly,
  weekDays,
} from '@/components/plan/weekUtils';
import { buildGroceryPreview, entriesForDaySlot } from '@/components/plan/planHelpers';
import type { MealPlanEntry } from '@/data/contracts';
import { createRepositories } from '@/data/repositories';
import { createTestDbClient } from '@/data/testing/createTestDb';

describe('weekUtils', () => {
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

    const preview = buildGroceryPreview(
      after!.entries,
      new Map([[recipe.id, { ...recipe, ingredientNames: ['eggs', 'tomatoes'], tagNames: [] }]]),
      (id) => {
        const full = recipes.getById(id);
        return (full?.ingredients ?? []).map((ing) => ({
          name: ing.name,
          quantity: ing.quantity ?? null,
          unit: ing.unit ?? null,
          aisle: ing.aisle ?? null,
        }));
      },
    );

    expect(preview).toHaveLength(1);
    expect(preview[0].mealCount).toBe(2);
    expect(preview[0].ingredientCount).toBe(2);
    // Quantities scaled by meal placements (4 eggs × 2 meals → 8)
    expect(preview[0].ingredients.find((i) => i.name === 'eggs')?.quantity).toBe('8');
    expect(preview[0].ingredients.find((i) => i.name === 'tomatoes')?.quantity).toBe('6');
  });

  it('scales grocery quantities when the same recipe appears multiple times', () => {
    const db = createTestDbClient();
    const { recipes, mealPlans } = createRepositories(db);
    const recipe = recipes.create({
      title: 'Tacos',
      ingredients: [{ name: 'tortillas', quantity: '1', unit: 'pack' }],
    });
    const plan = mealPlans.getOrCreateForWeek('2026-09-14');
    mealPlans.addEntry({
      mealPlanId: plan.id,
      recipeId: recipe.id,
      planDate: '2026-09-15',
      slot: 'dinner',
    });
    mealPlans.addEntry({
      mealPlanId: plan.id,
      recipeId: recipe.id,
      planDate: '2026-09-16',
      slot: 'dinner',
    });
    mealPlans.addEntry({
      mealPlanId: plan.id,
      recipeId: recipe.id,
      planDate: '2026-09-17',
      slot: 'lunch',
    });

    const after = mealPlans.getById(plan.id)!;
    const preview = buildGroceryPreview(
      after.entries,
      new Map([[recipe.id, { ...recipe, ingredientNames: ['tortillas'], tagNames: [] }]]),
      (id) => {
        const full = recipes.getById(id);
        return (full?.ingredients ?? []).map((ing) => ({
          name: ing.name,
          quantity: ing.quantity ?? null,
          unit: ing.unit ?? null,
          aisle: ing.aisle ?? null,
        }));
      },
    );

    expect(preview[0].mealCount).toBe(3);
    expect(preview[0].ingredients[0].quantity).toBe('3');
  });
});
