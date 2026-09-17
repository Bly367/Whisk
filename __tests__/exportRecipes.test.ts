import { createOfflineReader } from '@/data/offline';
import { createRepositories } from '@/data/repositories';
import { createTestDbClient } from '@/data/testing/createTestDb';
import {
  buildRecipeExport,
  exportPayloadToJson,
  WHISK_EXPORT_FORMAT,
} from '@/features/trust/exportRecipes';

describe('recipe export', () => {
  it('exports a non-empty library with tags in a common JSON format', () => {
    const db = createTestDbClient();
    const repos = createRepositories(db);
    const tag = repos.tags.upsertByName('Weeknight');
    repos.recipes.create({
      title: 'Soup',
      ingredients: [{ name: 'stock' }],
      tagIds: [tag.id],
      instructions: [{ id: '1', text: 'Simmer', position: 0 }],
    });

    const reader = createOfflineReader(db);
    const payload = buildRecipeExport({
      reader,
      tags: repos.tags.list(),
      mode: 'guest',
    });

    expect(payload.format).toBe(WHISK_EXPORT_FORMAT);
    expect(payload.recipes).toHaveLength(1);
    expect(payload.recipes[0].tags).toContain('Weeknight');
    expect(payload.recipes[0].ingredients[0].name).toBe('stock');

    const json = exportPayloadToJson(payload);
    expect(json).toContain('"format": "whisk-export"');
    expect(JSON.parse(json).recipes[0].title).toBe('Soup');
  });

  it('still exports after soft-delete restore (recipes.restore)', () => {
    const db = createTestDbClient();
    const repos = createRepositories(db);
    const created = repos.recipes.create({ title: 'Keep me' });
    repos.recipes.softDelete(created.id);
    expect(createOfflineReader(db).getRecipe(created.id)).toBeNull();

    const restored = repos.recipes.restore(created.id);
    expect(restored.deletedAt).toBeNull();

    const payload = buildRecipeExport({
      reader: createOfflineReader(db),
      tags: repos.tags.list(),
    });
    expect(payload.recipes.map((r) => r.id)).toContain(created.id);
  });
});
