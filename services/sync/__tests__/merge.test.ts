import { describe, expect, it } from 'vitest';
import { mergeCloudData, mergeEntities, mergeTombstones } from '../merge';
import { Recipe } from '../../../types/recipe';

const recipe = (id: string, updatedAt: string, title = id): Recipe => ({
  id,
  title,
  imageGradient: ['#111', '#222'],
  source: 'manual',
  folderIds: [],
  servings: 2,
  ingredients: [],
  steps: ['Cook'],
  tags: [],
  createdAt: updatedAt,
  updatedAt,
});

describe('sync merge', () => {
  it('keeps the newer entity by updatedAt', () => {
    const merged = mergeEntities(
      [recipe('a', '2026-01-01T00:00:00.000Z', 'local')],
      [recipe('a', '2026-02-01T00:00:00.000Z', 'cloud')],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe('cloud');
  });

  it('prefers newer tombstones and drops resurrected recipes', () => {
    const tombstones = mergeTombstones(
      [{ id: 'a', deletedAt: '2026-01-01T00:00:00.000Z' }],
      [{ id: 'a', deletedAt: '2026-03-01T00:00:00.000Z' }],
    );
    expect(tombstones[0].deletedAt).toBe('2026-03-01T00:00:00.000Z');

    const merged = mergeCloudData(
      {
        recipes: [recipe('a', '2026-02-01T00:00:00.000Z')],
        recipeTombstones: [],
        folders: [],
        folderTombstones: [],
        mealPlan: [],
        mealPlanUpdatedAt: '2026-01-01T00:00:00.000Z',
        groceryCheckedIds: [],
        manualGroceryItems: [],
        groceryUpdatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        recipes: [],
        recipeTombstones: [{ id: 'a', deletedAt: '2026-03-01T00:00:00.000Z' }],
        folders: [],
        folderTombstones: [],
        mealPlan: [],
        mealPlanUpdatedAt: '2026-01-01T00:00:00.000Z',
        groceryCheckedIds: ['honey'],
        manualGroceryItems: [],
        groceryUpdatedAt: '2026-04-01T00:00:00.000Z',
      },
    );

    expect(merged.recipes).toHaveLength(0);
    expect(merged.recipeTombstones).toEqual([
      { id: 'a', deletedAt: '2026-03-01T00:00:00.000Z' },
    ]);
    expect(merged.groceryCheckedIds).toEqual(['honey']);
  });

  it('keeps a recipe that was updated after a tombstone', () => {
    const merged = mergeCloudData(
      {
        recipes: [recipe('a', '2026-04-01T00:00:00.000Z', 'restored')],
        recipeTombstones: [],
        folders: [],
        folderTombstones: [],
        mealPlan: [],
        mealPlanUpdatedAt: '2026-01-01T00:00:00.000Z',
        groceryCheckedIds: [],
        manualGroceryItems: [],
        groceryUpdatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        recipes: [],
        recipeTombstones: [{ id: 'a', deletedAt: '2026-03-01T00:00:00.000Z' }],
        folders: [],
        folderTombstones: [],
        mealPlan: [],
        mealPlanUpdatedAt: '2026-01-01T00:00:00.000Z',
        groceryCheckedIds: [],
        manualGroceryItems: [],
        groceryUpdatedAt: '2026-01-01T00:00:00.000Z',
      },
    );

    expect(merged.recipes).toHaveLength(1);
    expect(merged.recipes[0].title).toBe('restored');
    expect(merged.recipeTombstones).toHaveLength(0);
  });
});
