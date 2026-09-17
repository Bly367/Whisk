/**
 * End-to-end core loop against SQLite repositories (no UI).
 * Proves guest/local → recipe → plan → grocery → cook progress → export.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { addDays, startOfWeek } from '@/components/plan/weekUtils';
import { createRecipeAutosave } from '@/data/autosave';
import { createOfflineReader } from '@/data/offline';
import { createRepositories } from '@/data/repositories';
import { createTestDbClient } from '@/data/testing/createTestDb';
import { useCookProgressStore } from '@/features/cook/cookProgressStore';
import { generateGroceryListFromPlan } from '@/features/shop/generateFromPlan';
import {
  buildExportFromRepos,
  exportPayloadToJson,
} from '@/features/trust/exportRecipes';
import { gateImportAction } from '@/features/trust/freeTier';
import { useSessionStore } from '@/features/trust/sessionStore';

describe('MVP core loop (integration)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useCookProgressStore.setState({ byRecipeId: {}, hydrated: false });
  });

  it('guest → manual recipe → plan → grocery → cook progress → export', async () => {
    const db = createTestDbClient();
    const repos = createRepositories(db);
    const offline = createOfflineReader(db);
    const autosave = createRecipeAutosave(db, { debounceMs: 0 });

    // Guest / free-tier gate visible before import
    useSessionStore.setState({
      mode: 'guest',
      usage: {
        importsUsedThisWeek: 0,
        weekStartIso: '2026-09-14',
        isDowngraded: false,
      },
      hydrated: true,
    });
    const gate = gateImportAction(useSessionStore.getState().usage);
    expect(gate.allowed).toBe(true);

    // Manual create + autosave
    const draft = await autosave.saveDraft({
      patch: {
        title: 'Weeknight Chili',
        ingredients: [
          { name: 'beans', quantity: '2', unit: 'cans' },
          { name: 'tomato', quantity: '1', unit: 'can' },
        ],
        instructions: [
          { id: 's1', text: 'Sauté aromatics', position: 0 },
          { id: 's2', text: 'Simmer 20 minutes', position: 1 },
        ],
      },
    });
    const published = repos.recipes.update(draft.recipe.id, { status: 'published' });
    expect(offline.getRecipe(published.id)?.title).toBe('Weeknight Chili');

    // Plan
    const monday = startOfWeek(new Date('2026-09-17T12:00:00'));
    const plan = repos.mealPlans.getOrCreateForWeek(monday);
    repos.mealPlans.addEntry({
      mealPlanId: plan.id,
      recipeId: published.id,
      planDate: addDays(monday, 2),
      slot: 'dinner',
    });
    expect(repos.mealPlans.getById(plan.id)?.entries).toHaveLength(1);

    // Grocery from plan
    const list = generateGroceryListFromPlan(repos, { weekStart: monday });
    expect(list).not.toBeNull();
    expect(list!.items.length).toBeGreaterThan(0);
    expect(offline.getGroceryList(list!.id)?.items.length).toBeGreaterThan(0);

    // Cook progress survives hydrate (relaunch)
    await useCookProgressStore.getState().setStep(published.id, 1);
    useCookProgressStore.setState({ byRecipeId: {}, hydrated: false });
    await useCookProgressStore.getState().hydrate();
    expect(useCookProgressStore.getState().getProgress(published.id)?.stepIndex).toBe(1);

    // Export anytime (guest)
    const payload = buildExportFromRepos(repos, offline, 'guest');
    expect(payload.recipes.length).toBeGreaterThanOrEqual(1);
    const json = exportPayloadToJson(payload);
    expect(json).toContain('Weeknight Chili');
  });
});
