/**
 * Ensures a sample recipe exists so cook mode can be exercised before W3 library UI lands.
 */
import type { Repositories } from '@/data/repositories';
import type { OfflineReader } from '@/data/offline';
import { createId } from '@/data/util';

export const SAMPLE_COOK_TITLE = 'Weeknight lemon pasta';

export function ensureSampleCookRecipe(repos: Repositories, reader: OfflineReader): string {
  const existing = reader.listRecipes({ search: SAMPLE_COOK_TITLE, limit: 5 });
  const match = existing.find((r) => r.title === SAMPLE_COOK_TITLE);
  if (match) return match.id;

  const created = repos.recipes.create({
    title: SAMPLE_COOK_TITLE,
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 15,
    notes: 'Sample recipe for cook mode — edit or replace anytime.',
    ingredients: [
      { name: 'spaghetti', quantity: '12', unit: 'oz' },
      { name: 'lemon', quantity: '1' },
      { name: 'olive oil', quantity: '2', unit: 'tbsp' },
      { name: 'garlic', quantity: '2', unit: 'cloves' },
      { name: 'parmesan', quantity: '1/2', unit: 'cup' },
    ],
    instructions: [
      { id: createId(), text: 'Bring a large pot of salted water to a boil.', position: 0 },
      {
        id: createId(),
        text: 'Cook spaghetti until just shy of al dente. Reserve a cup of pasta water, then drain.',
        position: 1,
      },
      {
        id: createId(),
        text: 'Warm olive oil in a skillet. Soften garlic, then add lemon zest and juice.',
        position: 2,
      },
      {
        id: createId(),
        text: 'Toss pasta with the lemon oil, a splash of pasta water, and parmesan. Season to taste.',
        position: 3,
      },
      { id: createId(), text: 'Plate and finish with extra cheese and black pepper.', position: 4 },
    ],
  });

  return created.id;
}
