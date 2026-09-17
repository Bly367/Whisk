import { createOfflineReader } from '@/data/offline';
import { createRepositories } from '@/data/repositories';
import { createTestDbClient } from '@/data/testing/createTestDb';
import { ensureSampleCookRecipe, SAMPLE_COOK_TITLE } from '@/features/cook/ensureSampleRecipe';

describe('sample cook recipe', () => {
  it('creates once and reuses via offline reader', () => {
    const db = createTestDbClient();
    const repos = createRepositories(db);
    const reader = createOfflineReader(db);

    const first = ensureSampleCookRecipe(repos, reader);
    const second = ensureSampleCookRecipe(repos, createOfflineReader(db));
    expect(second).toBe(first);

    const recipe = createOfflineReader(db).getRecipe(first);
    expect(recipe?.title).toBe(SAMPLE_COOK_TITLE);
    expect(recipe?.instructions.length).toBeGreaterThan(1);
  });
});
