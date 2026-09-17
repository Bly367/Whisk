import { createRepositories } from '@/data/repositories';
import { createTestDbClient } from '@/data/testing/createTestDb';
import {
  buildGroceryPreviewFromPlan,
  commitGroceryPreview,
  generateGroceryListFromPlan,
} from '@/features/shop/generateFromPlan';
import {
  completedItems,
  groupGroceryItems,
  isMergedItem,
} from '@/features/shop/groupItems';
import {
  buildMergeKey,
  mergeGroceryLines,
  parseMergeKey,
  splitMergedDraft,
  type GrocerySourceLine,
} from '@/features/shop/merge';
import { unmergeGroceryItem } from '@/features/shop/unmerge';
import { startOfWeekMonday } from '@/features/shop/week';

describe('grocery merge', () => {
  it('merges compatible quantities and keeps provenance for unmerge', () => {
    const lines: GrocerySourceLine[] = [
      {
        name: 'Chicken',
        quantity: '1',
        unit: 'lb',
        aisle: 'Meat & Seafood',
        recipeId: 'r1',
        recipeTitle: 'Tacos',
      },
      {
        name: 'chicken',
        quantity: '0.5',
        unit: 'lb',
        aisle: 'Meat & Seafood',
        recipeId: 'r2',
        recipeTitle: 'Soup',
      },
      {
        name: 'Salt',
        quantity: null,
        unit: null,
        aisle: 'Spices',
        recipeId: 'r1',
        recipeTitle: 'Tacos',
      },
      {
        name: 'Salt',
        quantity: '1',
        unit: 'tsp',
        aisle: 'Spices',
        recipeId: 'r2',
        recipeTitle: 'Soup',
      },
    ];

    const drafts = mergeGroceryLines(lines);
    const chicken = drafts.find((d) => d.name.toLowerCase() === 'chicken');
    expect(chicken).toBeTruthy();
    expect(chicken!.wasMerged).toBe(true);
    expect(chicken!.quantity).toBe('1.5');
    expect(chicken!.recipeTitle).toBe('Tacos · Soup');
    expect(parseMergeKey(chicken!.mergeKey).sources).toHaveLength(2);

    // Salt with null qty vs tsp should not merge
    const salts = drafts.filter((d) => d.name.toLowerCase() === 'salt');
    expect(salts.length).toBe(2);
  });

  it('splits merged drafts back into sources', () => {
    const merged = mergeGroceryLines([
      {
        name: 'Onion',
        quantity: '1',
        unit: null,
        aisle: 'Produce',
        recipeId: 'a',
        recipeTitle: 'A',
      },
      {
        name: 'Onion',
        quantity: '2',
        unit: null,
        aisle: 'Produce',
        recipeId: 'b',
        recipeTitle: 'B',
      },
    ])[0];

    const sources = splitMergedDraft(merged);
    expect(sources).toHaveLength(2);
    expect(buildMergeKey('Onion', null)).toBe('onion|');
  });
});

describe('generate grocery from plan', () => {
  it('builds one list with merged items and recipe provenance', () => {
    const db = createTestDbClient();
    const repos = createRepositories(db);

    const pasta = repos.recipes.create({
      title: 'Lemon Pasta',
      ingredients: [
        { name: 'spaghetti', quantity: '8', unit: 'oz', aisle: 'Pantry' },
        { name: 'lemon', quantity: '1', aisle: 'Produce' },
      ],
    });
    const salad = repos.recipes.create({
      title: 'Side Salad',
      ingredients: [
        { name: 'lemon', quantity: '1', aisle: 'Produce' },
        { name: 'lettuce', quantity: '1', aisle: 'Produce' },
      ],
    });

    const week = '2026-09-14';
    const plan = repos.mealPlans.getOrCreateForWeek(week);
    repos.mealPlans.addEntry({
      mealPlanId: plan.id,
      recipeId: pasta.id,
      planDate: '2026-09-15',
      slot: 'dinner',
    });
    repos.mealPlans.addEntry({
      mealPlanId: plan.id,
      recipeId: salad.id,
      planDate: '2026-09-16',
      slot: 'lunch',
    });

    const preview = buildGroceryPreviewFromPlan(repos, { weekStart: week });
    expect(preview).not.toBeNull();
    expect(preview!.recipeCount).toBe(2);
    expect(preview!.mergedCount).toBeGreaterThanOrEqual(1);

    const lemon = preview!.drafts.find((d) => d.name.toLowerCase() === 'lemon');
    expect(lemon?.quantity).toBe('2');
    expect(lemon?.recipeTitle).toContain('Lemon Pasta');
    expect(lemon?.recipeTitle).toContain('Side Salad');

    const list = commitGroceryPreview(repos.grocery, preview!);
    expect(list.items.length).toBe(preview!.drafts.length);
    expect(list.mealPlanId).toBe(plan.id);

    const viaHelper = generateGroceryListFromPlan(repos, { weekStart: week });
    expect(viaHelper?.items.length).toBe(list.items.length);
  });

  it('returns null when the week plan has no recipes', () => {
    const db = createTestDbClient();
    const repos = createRepositories(db);
    const preview = buildGroceryPreviewFromPlan(repos, {
      weekStart: startOfWeekMonday(new Date('2026-09-17T12:00:00Z')),
    });
    expect(preview).toBeNull();
  });
});

describe('aisle grouping + undo + unmerge', () => {
  it('groups by aisle by default and restores completed items via undo path', () => {
    const db = createTestDbClient();
    const repos = createRepositories(db);
    const recipe = repos.recipes.create({
      title: 'Tacos',
      ingredients: [
        { name: 'tortillas', quantity: '8', aisle: 'Bakery' },
        { name: 'chicken', quantity: '1', unit: 'lb', aisle: 'Meat & Seafood' },
      ],
    });
    const week = '2026-09-14';
    const plan = repos.mealPlans.getOrCreateForWeek(week);
    repos.mealPlans.addEntry({
      mealPlanId: plan.id,
      recipeId: recipe.id,
      planDate: '2026-09-15',
      slot: 'dinner',
    });

    // Second recipe to force a merge
    const soup = repos.recipes.create({
      title: 'Soup',
      ingredients: [
        { name: 'chicken', quantity: '1', unit: 'lb', aisle: 'Meat & Seafood' },
      ],
    });
    repos.mealPlans.addEntry({
      mealPlanId: plan.id,
      recipeId: soup.id,
      planDate: '2026-09-16',
      slot: 'dinner',
    });

    const list = generateGroceryListFromPlan(repos, { weekStart: week });
    expect(list).not.toBeNull();

    const aisleGroups = groupGroceryItems(list!.items, 'aisle');
    expect(aisleGroups.map((g) => g.title)).toEqual(
      expect.arrayContaining(['Bakery', 'Meat & Seafood']),
    );

    const recipeGroups = groupGroceryItems(list!.items, 'recipe');
    expect(recipeGroups.length).toBeGreaterThanOrEqual(1);

    const chicken = list!.items.find((i) => i.name.toLowerCase() === 'chicken');
    expect(chicken && isMergedItem(chicken)).toBe(true);

    const completed = repos.grocery.setCompleted(chicken!.id, true);
    expect(completed.isCompleted).toBe(true);
    expect(completedItems(repos.grocery.getById(list!.id)!.items)).toHaveLength(1);

    // Undo completion (W6 acceptance: undo restores completed item)
    const undone = repos.grocery.setCompleted(chicken!.id, false);
    expect(undone.isCompleted).toBe(false);

    const afterUnmerge = unmergeGroceryItem(
      repos.grocery,
      repos.grocery.getById(list!.id)!,
      repos.grocery.getById(list!.id)!.items.find((i) => i.name.toLowerCase() === 'chicken')!,
    );
    const chickens = afterUnmerge.items.filter((i) => i.name.toLowerCase() === 'chicken');
    expect(chickens.length).toBe(2);
    expect(chickens.every((c) => !isMergedItem(c))).toBe(true);
  });
});
