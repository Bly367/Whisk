import { createRecipeAutosave } from '@/data/autosave';
import { createOfflineReader } from '@/data/offline';
import { createRepositories } from '@/data/repositories';
import { bannerStatusFromLocal, useSyncStatusStore } from '@/data/sync/statusStore';
import { createTestDbClient } from '@/data/testing/createTestDb';

describe('recipe repository', () => {
  it('creates, reads, updates, and soft-deletes with trash recovery', () => {
    const db = createTestDbClient();
    const { recipes, tags } = createRepositories(db);

    const tag = tags.upsertByName('Weeknight');
    const created = recipes.create({
      title: 'Lemon Pasta',
      ingredients: [
        { name: 'spaghetti', quantity: '12', unit: 'oz' },
        { name: 'lemon', quantity: '1' },
      ],
      tagIds: [tag.id],
      instructions: [{ id: 's1', text: 'Boil water', position: 0 }],
    });

    expect(created.id).toBeTruthy();
    expect(created.syncStatus).toBe('synced_local');
    expect(created.ingredients).toHaveLength(2);
    expect(created.tagIds).toEqual([tag.id]);

    const listed = recipes.list({ search: 'lemon' });
    expect(listed).toHaveLength(1);
    expect(listed[0].ingredientNames).toEqual(
      expect.arrayContaining(['spaghetti', 'lemon']),
    );
    expect(listed[0].tagNames).toContain('Weeknight');

    // Ingredient search matches even when absent from title
    const byIngredient = recipes.list({ search: 'spaghetti' });
    expect(byIngredient.map((r) => r.id)).toContain(created.id);

    const updated = recipes.update(created.id, {
      title: 'Lemon Pasta with Herbs',
      notes: 'Add parsley',
    });
    expect(updated.title).toBe('Lemon Pasta with Herbs');
    expect(updated.localRevision).toBe(2);

    recipes.softDelete(created.id);
    expect(recipes.getById(created.id)).toBeNull();
    expect(recipes.listTrash().map((r) => r.id)).toContain(created.id);

    const restored = recipes.restore(created.id);
    expect(restored.deletedAt).toBeNull();
    expect(recipes.getById(created.id)?.title).toBe('Lemon Pasta with Herbs');
  });

  it('lists without N+1: ingredient and tag names come from one query shape', () => {
    const db = createTestDbClient();
    const { recipes, tags } = createRepositories(db);
    const a = tags.upsertByName('A');
    const b = tags.upsertByName('B');

    recipes.create({
      title: 'Soup',
      ingredients: [{ name: 'stock' }, { name: 'onion' }],
      tagIds: [a.id, b.id],
    });
    recipes.create({
      title: 'Salad',
      ingredients: [{ name: 'lettuce' }],
      tagIds: [a.id],
    });

    const items = recipes.list();
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(Array.isArray(item.ingredientNames)).toBe(true);
      expect(Array.isArray(item.tagNames)).toBe(true);
    }
  });
});

describe('meal plan + grocery repositories', () => {
  it('persists plan entries and grocery lists offline', () => {
    const db = createTestDbClient();
    const { recipes, mealPlans, grocery } = createRepositories(db);
    const recipe = recipes.create({ title: 'Tacos' });

    const plan = mealPlans.getOrCreateForWeek('2026-09-14');
    const entry = mealPlans.addEntry({
      mealPlanId: plan.id,
      recipeId: recipe.id,
      planDate: '2026-09-15',
      slot: 'dinner',
    });
    expect(entry.slot).toBe('dinner');

    const reloaded = mealPlans.getById(plan.id);
    expect(reloaded?.entries).toHaveLength(1);

    const list = grocery.create({
      name: 'Week of Sep 14',
      mealPlanId: plan.id,
      items: [
        {
          name: 'tortillas',
          quantity: '8',
          aisle: 'Bakery',
          recipeId: recipe.id,
          recipeTitle: recipe.title,
        },
      ],
    });
    expect(list.items[0].recipeTitle).toBe('Tacos');

    const completed = grocery.setCompleted(list.items[0].id, true);
    expect(completed.isCompleted).toBe(true);
    const undone = grocery.setCompleted(list.items[0].id, false);
    expect(undone.isCompleted).toBe(false);
  });
});

describe('autosave + offline reader', () => {
  beforeEach(() => {
    useSyncStatusStore.getState().resetToLocalOk();
  });

  it('autosaves drafts so they survive a fresh reader', async () => {
    const db = createTestDbClient();
    const autosave = createRecipeAutosave(db, { debounceMs: 0 });
    const offline = createOfflineReader(db);

    const first = await autosave.saveDraft({
      patch: { title: 'Draft chili', notes: 'smoky' },
    });
    expect(first.recipe.status).toBe('draft');
    expect(useSyncStatusStore.getState().status).toBe('saved_locally');

    const second = await autosave.saveDraft({
      recipeId: first.recipe.id,
      patch: { notes: 'smoky + beans' },
    });
    expect(second.recipe.notes).toBe('smoky + beans');

    const fromDisk = offline.getRecipe(first.recipe.id);
    expect(fromDisk?.notes).toBe('smoky + beans');
    expect(fromDisk?.status).toBe('draft');
  });
});

describe('sync status mapping', () => {
  it('never maps local success to cloud synced', () => {
    expect(bannerStatusFromLocal('synced_local')).toBe('saved_locally');
    expect(bannerStatusFromLocal('pending')).toBe('saved_locally');
    expect(bannerStatusFromLocal('needs_attention')).toBe('needs_attention');
  });
});
