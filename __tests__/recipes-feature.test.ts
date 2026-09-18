import { createRecipeAutosave } from '@/data/autosave';
import { explainSearchMatch } from '@/features/recipes/matchReason';
import {
  formatQuantity,
  isUnitSystemAvailable,
  parseQuantity,
  preferUnit,
  scaleQuantityDisplay,
} from '@/features/recipes/scale';
import { applyLibraryFilters, DEFAULT_LIBRARY_FILTERS } from '@/features/recipes/libraryFilters';
import { createRepositories } from '@/data/repositories';
import { createTestDbClient } from '@/data/testing/createTestDb';
import type { RecipeListItem } from '@/data/contracts';

function asListItem(
  partial: Partial<RecipeListItem> & Pick<RecipeListItem, 'id' | 'title'>,
): RecipeListItem {
  return {
    notes: null,
    sourceUrl: null,
    sourceName: null,
    imageUri: null,
    servings: 4,
    prepMinutes: null,
    cookMinutes: null,
    rating: null,
    instructions: [],
    status: 'published',
    isFavorite: false,
    cookedAt: null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    localRevision: 1,
    syncStatus: 'synced_local',
    householdId: null,
    remoteId: null,
    ingredientNames: [],
    tagNames: [],
    ...partial,
  };
}

describe('ingredient search match reason', () => {
  it('explains ingredient matches when the query is absent from the title', () => {
    const db = createTestDbClient();
    const { recipes } = createRepositories(db);
    const created = recipes.create({
      title: 'Weeknight Stir Fry',
      ingredients: [
        { name: 'chicken thighs', quantity: '1', unit: 'lb' },
        { name: 'broccoli', quantity: '2', unit: 'cups' },
      ],
    });

    const listed = recipes.list({ search: 'broccoli' });
    expect(listed.map((r) => r.id)).toContain(created.id);

    const item = listed.find((r) => r.id === created.id)!;
    const match = explainSearchMatch(item, 'broccoli');
    expect(match).not.toBeNull();
    expect(match?.field).toBe('ingredient');
    expect(match?.label).toMatch(/Matched ingredient: broccoli/i);
  });

  it('hides match reason when the title already contains the query', () => {
    const item = asListItem({
      id: '1',
      title: 'Broccoli cheddar soup',
      ingredientNames: ['broccoli', 'cheddar'],
    });
    expect(explainSearchMatch(item, 'broccoli')).toBeNull();
  });
});

describe('serving scale', () => {
  it('scales numeric quantities and keeps the original visible', () => {
    const scaled = scaleQuantityDisplay('2', 4, 8);
    expect(scaled.isScaled).toBe(true);
    expect(scaled.scaled).toBe('4');
    expect(scaled.original).toBe('2');
  });

  it('parses mixed fractions', () => {
    expect(parseQuantity('1 1/2')).toBeCloseTo(1.5);
    expect(formatQuantity(0.5)).toBe('1/2');
  });

  it('leaves non-numeric quantities unscaled', () => {
    const scaled = scaleQuantityDisplay('to taste', 4, 8);
    expect(scaled.isScaled).toBe(false);
    expect(scaled.scaled).toBe('to taste');
  });

  it('does not remap unit labels without converting quantities', () => {
    expect(preferUnit('tsp', 'metric')).toBe('tsp');
    expect(preferUnit('oz', 'metric')).toBe('oz');
    expect(preferUnit('ml', 'imperial')).toBe('ml');
    expect(preferUnit('2 cups', 'metric')).toBe('2 cups');
    expect(isUnitSystemAvailable('original')).toBe(true);
    expect(isUnitSystemAvailable('metric')).toBe(false);
    expect(isUnitSystemAvailable('imperial')).toBe(false);
  });
});

describe('library filters', () => {
  it('combines cook time, date, and collection membership', () => {
    const now = new Date('2026-09-17T12:00:00.000Z');
    const items = [
      asListItem({
        id: 'a',
        title: 'Quick eggs',
        prepMinutes: 5,
        cookMinutes: 5,
        createdAt: '2026-09-16T12:00:00.000Z',
      }),
      asListItem({
        id: 'b',
        title: 'Slow roast',
        prepMinutes: 20,
        cookMinutes: 90,
        createdAt: '2026-08-01T12:00:00.000Z',
      }),
    ];

    const filtered = applyLibraryFilters(
      items,
      {
        ...DEFAULT_LIBRARY_FILTERS,
        cookTime: 'le30',
        dateAdded: 'week',
      },
      new Set(['a']),
      now,
    );

    expect(filtered.map((r) => r.id)).toEqual(['a']);
  });
});

describe('editor autosave id reuse contract', () => {
  it('second saveDraft must use the id from the first result', async () => {
    const db = createTestDbClient();
    const autosave = createRecipeAutosave(db, { debounceMs: 0 });

    const first = await autosave.saveDraft({
      patch: { title: 'Draft A', ingredients: [{ name: 'salt' }] },
    });
    const second = await autosave.saveDraft({
      recipeId: first.recipe.id,
      patch: { title: 'Draft A updated', notes: 'keep one row' },
    });

    expect(second.recipe.id).toBe(first.recipe.id);

    const { recipes } = createRepositories(db);
    const all = recipes.list({ status: 'any' });
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('Draft A updated');
  });
});
