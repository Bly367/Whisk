/**
 * P2-W4 — Pantry CRUD + pantry-aware recipe search (test-first).
 *
 * Acceptance:
 * - Add/update/consume pantry items offline-first
 * - Recipe search can boost/filter by pantry coverage with clear copy (not silent)
 * - Coverage scoring + empty-pantry behavior
 */
import {
  applyPantryAwareSearch,
  describePantrySearchMode,
  formatPantryCoverageLabel,
  scorePantryCoverage,
} from '@/features/pantry';
import type { RecipeListItem } from '@/data/contracts';
import { createRepositories } from '@/data/repositories';
import { createTestDbClient } from '@/data/testing/createTestDb';
import { useSyncStatusStore } from '@/data/sync/statusStore';

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

describe('P2-W4 pantry coverage scoring', () => {
  it('scores partial coverage and lists matched vs missing ingredients', () => {
    const coverage = scorePantryCoverage(
      ['Eggs', 'Whole milk', 'Flour', 'Blueberries'],
      ['eggs', 'milk', 'butter'],
    );

    expect(coverage.totalIngredients).toBe(4);
    expect(coverage.matchedCount).toBe(2);
    expect(coverage.ratio).toBeCloseTo(0.5);
    expect(coverage.matchedNames.map((n) => n.toLowerCase())).toEqual(
      expect.arrayContaining(['eggs', 'whole milk']),
    );
    expect(coverage.missingNames.map((n) => n.toLowerCase())).toEqual(
      expect.arrayContaining(['flour', 'blueberries']),
    );
  });

  it('does not match accidental substrings (egg vs eggplant)', () => {
    const coverage = scorePantryCoverage(['eggplant', 'olive oil'], ['egg', 'oil']);
    expect(coverage.matchedCount).toBe(1);
    expect(coverage.matchedNames.map((n) => n.toLowerCase())).toEqual(['olive oil']);
  });

  it('returns zero coverage for recipes with no ingredients', () => {
    const coverage = scorePantryCoverage([], ['eggs', 'milk']);
    expect(coverage.totalIngredients).toBe(0);
    expect(coverage.matchedCount).toBe(0);
    expect(coverage.ratio).toBe(0);
  });
});

describe('P2-W4 pantry-aware recipe search', () => {
  const recipes: RecipeListItem[] = [
    asListItem({
      id: 'low',
      title: 'Fancy Roast',
      ingredientNames: ['prime rib', 'rosemary', 'garlic', 'wine'],
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
    asListItem({
      id: 'high',
      title: 'Pantry Omelette',
      ingredientNames: ['eggs', 'cheese', 'butter'],
      createdAt: '2026-01-02T00:00:00.000Z',
    }),
    asListItem({
      id: 'mid',
      title: 'Toast',
      ingredientNames: ['bread', 'butter', 'jam'],
      createdAt: '2026-01-03T00:00:00.000Z',
    }),
  ];

  const pantryNames = ['eggs', 'butter', 'cheese', 'bread'];

  it('boost mode reorders by coverage and attaches clear pantry copy', () => {
    const result = applyPantryAwareSearch(recipes, pantryNames, 'boost');

    expect(result.map((r) => r.id)).toEqual(['high', 'mid', 'low']);
    expect(result[0].pantryCoverage.matchedCount).toBe(3);
    expect(result[0].pantryLabel).toMatch(/3 of 3/i);
    expect(result[0].pantryLabel).toMatch(/pantry/i);
    expect(result[2].pantryLabel).toMatch(/0 of 4|none|0 pantry/i);

    const banner = describePantrySearchMode('boost', pantryNames.length);
    expect(banner).toBeTruthy();
    expect(banner).toMatch(/ranked|coverage|pantry/i);
    expect(banner!.toLowerCase()).not.toMatch(/silently/);
  });

  it('filter mode keeps only recipes that use pantry items, with clear copy', () => {
    const result = applyPantryAwareSearch(recipes, pantryNames, 'filter');

    expect(result.map((r) => r.id)).toEqual(['high', 'mid']);
    expect(result.every((r) => r.pantryCoverage.matchedCount > 0)).toBe(true);

    const banner = describePantrySearchMode('filter', pantryNames.length);
    expect(banner).toMatch(/only showing|filter/i);
    expect(banner).toMatch(/pantry/i);
  });

  it('empty pantry: boost keeps original order and explains empty pantry (not silent)', () => {
    const result = applyPantryAwareSearch(recipes, [], 'boost');

    expect(result.map((r) => r.id)).toEqual(['low', 'high', 'mid']);
    expect(result.every((r) => r.pantryCoverage.matchedCount === 0)).toBe(true);
    expect(result.every((r) => r.pantryLabel === null)).toBe(true);

    const banner = describePantrySearchMode('boost', 0);
    expect(banner).toMatch(/empty/i);
    expect(banner).toMatch(/add/i);
  });

  it('empty pantry: filter returns no recipes and explains empty pantry', () => {
    const result = applyPantryAwareSearch(recipes, [], 'filter');
    expect(result).toEqual([]);

    const banner = describePantrySearchMode('filter', 0);
    expect(banner).toMatch(/empty/i);
    expect(banner).toMatch(/add|filter/i);
  });

  it('off mode leaves order untouched and produces no pantry labels', () => {
    const result = applyPantryAwareSearch(recipes, pantryNames, 'off');
    expect(result.map((r) => r.id)).toEqual(['low', 'high', 'mid']);
    expect(result.every((r) => r.pantryLabel === null)).toBe(true);
    expect(describePantrySearchMode('off', pantryNames.length)).toBeNull();
  });
});

describe('P2-W4 pantry coverage label copy', () => {
  it('formats human-readable coverage without claiming nutrition or delivery', () => {
    const label = formatPantryCoverageLabel({
      matchedCount: 2,
      totalIngredients: 5,
      ratio: 0.4,
      matchedNames: ['eggs', 'butter'],
      missingNames: ['flour', 'sugar', 'milk'],
    });
    expect(label).toMatch(/2 of 5/i);
    expect(label.toLowerCase()).toMatch(/pantry/);
    expect(label.toLowerCase()).not.toMatch(/calorie|nutrition|delivery|uber|instacart/);
  });
});

describe('P2-W4 pantry CRUD offline-first', () => {
  beforeEach(() => {
    useSyncStatusStore.getState().resetToLocalOk();
  });

  it('create/update/consume persist locally and mark local sync status', () => {
    const db = createTestDbClient();
    const { pantry } = createRepositories(db);

    const created = pantry.create({
      name: 'Rolled oats',
      quantity: '1',
      unit: 'bag',
      aisle: 'Pantry',
    });
    expect(created.name).toBe('Rolled oats');
    expect(created.depletedAt).toBeNull();
    expect(created.syncStatus).toBe('synced_local');
    expect(useSyncStatusStore.getState().lastLocalPersistAt).toBeTruthy();

    const updated = pantry.update(created.id, { quantity: '1/2', notes: 'almost out' });
    expect(updated.quantity).toBe('1/2');
    expect(updated.notes).toBe('almost out');
    expect(updated.localRevision).toBeGreaterThan(created.localRevision);

    const consumed = pantry.consume(created.id);
    expect(consumed.depletedAt).toBeTruthy();
    expect(pantry.list()).toHaveLength(0);
    expect(pantry.list({ includeDepleted: true }).map((i) => i.id)).toContain(created.id);
  });
});
