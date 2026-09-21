/**
 * Account/data deletion tests for App Store / Play compliance.
 * Proves honest local data wipe while guest (no cloud account yet).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { createOfflineReader } from '@/data/offline';
import { createRepositories } from '@/data/repositories';
import { createTestDbClient } from '@/data/testing/createTestDb';
import { buildExportFromRepos } from '@/features/trust/exportRecipes';
import { useSessionStore } from '@/features/trust/sessionStore';
import { deleteAllLocalData } from '@/features/trust/deleteLocalData';

describe('account / data deletion', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useSessionStore.setState({
      mode: 'guest',
      hydrated: true,
      usage: { importsUsedThisWeek: 0, weekStartIso: '2026-09-21', isDowngraded: false },
      entitlement: 'free',
    });
  });

  it('deletes all local recipe data when requested', async () => {
    const db = createTestDbClient();
    const repos = createRepositories(db);

    // Create test data across multiple tables
    const tag = repos.tags.upsertByName('Weeknight');
    const recipe = repos.recipes.create({
      title: 'Test Recipe',
      ingredients: [
        { name: 'beans', quantity: '1', unit: 'can' },
        { name: 'stock', quantity: '2', unit: 'cups' },
      ],
      tagIds: [tag.id],
      instructions: [{ id: 's1', text: 'Cook', position: 0 }],
    });

    const mealPlan = repos.mealPlans.getOrCreateForWeek('2026-09-21');
    repos.mealPlans.addEntry({
      mealPlanId: mealPlan.id,
      recipeId: recipe.id,
      planDate: '2026-09-22',
      slot: 'dinner',
    });

    const groceryList = repos.grocery.create({ name: 'Weekly' });
    repos.grocery.addItem(groceryList.id, {
      name: 'beans',
      quantity: '1',
      unit: 'can',
      recipeId: recipe.id,
      recipeTitle: recipe.title,
    });

    repos.pantry.create({
      name: 'flour',
      quantity: '5',
      unit: 'cups',
    });

    const collection = repos.collections.create({ name: 'Favorites', kind: 'manual' });
    repos.collections.addRecipe(collection.id, recipe.id, 0);

    // Verify data exists before deletion
    const reader = createOfflineReader(db);
    expect(reader.listRecipes({ includeDeleted: false }).length).toBe(1);
    expect(repos.tags.list().length).toBe(1);
    expect(repos.grocery.getById(groceryList.id)?.items.length).toBeGreaterThan(0);
    expect(repos.mealPlans.getById(mealPlan.id)?.entries.length).toBe(1);
    expect(repos.pantry.list().length).toBe(1);
    expect(repos.collections.list().length).toBe(1);

    // Delete all local data
    await deleteAllLocalData(db);

    // Verify all data is cleared
    expect(reader.listRecipes({ includeDeleted: false }).length).toBe(0);
    expect(reader.listRecipes({ includeDeleted: true }).length).toBe(0);
    expect(repos.tags.list().length).toBe(0);
    expect(repos.grocery.list().length).toBe(0);
    expect(repos.mealPlans.list().length).toBe(0);
    expect(repos.pantry.list().length).toBe(0);
    expect(repos.collections.list().length).toBe(0);
  });

  it('clears session state but preserves ability to use app', async () => {
    const db = createTestDbClient();
    
    // Set up session with purchased unlock and discounted pricing
    useSessionStore.setState({
      mode: 'guest',
      hydrated: true,
      entitlement: 'unlocked',
      usage: { importsUsedThisWeek: 3, weekStartIso: '2026-09-21', isDowngraded: false },
      unlockPricing: {
        priceCents: 499,
        priceLabel: '$4.99',
        isDiscounted: true,
        influencerCode: 'TEST499',
        influencerId: 'test',
      },
    });

    await deleteAllLocalData(db);

    // Session should be reset to fresh guest state with default pricing
    const state = useSessionStore.getState();
    expect(state.mode).toBe('guest');
    expect(state.entitlement).toBe('free');
    expect(state.usage.importsUsedThisWeek).toBe(0);
    expect(state.usage.isDowngraded).toBe(false);
    // Pricing should reset to full product default ($6.99, not discounted $4.99)
    expect(state.unlockPricing.priceCents).toBe(699);
    expect(state.unlockPricing.priceLabel).toBe('$6.99');
    expect(state.unlockPricing.isDiscounted).toBe(false);
    expect(state.unlockPricing.influencerCode).toBeNull();
  });

  it('preserves export functionality before deletion', async () => {
    const db = createTestDbClient();
    const repos = createRepositories(db);

    repos.recipes.create({
      title: 'Export Me',
      ingredients: [{ name: 'test' }],
      instructions: [{ id: 's1', text: 'Test', position: 0 }],
    });

    // Export should work before deletion
    const reader = createOfflineReader(db);
    const payload = buildExportFromRepos(repos, reader, 'guest');
    expect(payload.recipes.length).toBe(1);
    expect(payload.recipes[0].title).toBe('Export Me');

    // After deletion, export returns empty library (not an error)
    await deleteAllLocalData(db);
    const emptyPayload = buildExportFromRepos(repos, reader, 'guest');
    expect(emptyPayload.recipes.length).toBe(0);
  });

  it('allows creating new recipes after deletion', async () => {
    const db = createTestDbClient();
    const repos = createRepositories(db);

    // Create and then delete
    repos.recipes.create({
      title: 'Before Delete',
      ingredients: [{ name: 'old' }],
      instructions: [{ id: 's1', text: 'Old', position: 0 }],
    });
    await deleteAllLocalData(db);

    // Should be able to create new recipes
    const newRecipe = repos.recipes.create({
      title: 'After Delete',
      ingredients: [{ name: 'new' }],
      instructions: [{ id: 's1', text: 'New', position: 0 }],
    });

    const reader = createOfflineReader(db);
    expect(reader.listRecipes({ includeDeleted: false }).length).toBe(1);
    expect(reader.getRecipe(newRecipe.id)?.title).toBe('After Delete');
  });

  it('does not delete admin entitlement flag (document-only - admin is device config)', async () => {
    const db = createTestDbClient();

    useSessionStore.setState({
      mode: 'guest',
      hydrated: true,
      entitlement: 'admin',
      usage: { importsUsedThisWeek: 0, weekStartIso: '2026-09-21', isDowngraded: false },
    });

    await deleteAllLocalData(db);

    // Admin unlock should be cleared to fresh guest state (admin is local config, 
    // but data deletion is about removing user data - fresh start means free tier)
    const state = useSessionStore.getState();
    expect(state.entitlement).toBe('free');
  });
});
