import type { CompatExportPack, CompatFormat } from '@/data/contracts';
import type { CompatRepository } from '@/data/repositories/compat';
import type { RecipeRepository } from '@/data/repositories/recipes';

import { getCompatAdapterForFormat } from '@/import/compat/registry';
import { extractCompatUid } from '@/import/compat/commit';
import type { CompatExportRecipe } from '@/import/compat/types';

export type BuildCompatExportPackInput = {
  format: CompatFormat;
  recipeIds: string[];
  recipesRepo: RecipeRepository;
  compatRepo: CompatRepository;
};

function toExportRecipe(
  recipe: NonNullable<ReturnType<RecipeRepository['getById']>>,
): CompatExportRecipe {
  return {
    id: recipe.id,
    externalUid: extractCompatUid(recipe.sourceUrl),
    title: recipe.title,
    notes: recipe.notes,
    sourceUrl: recipe.sourceUrl,
    sourceName: recipe.sourceName,
    servings: recipe.servings,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    rating: recipe.rating,
    ingredients: recipe.ingredients.map((ing) => ({
      name: ing.name,
      quantity: ing.quantity ?? null,
      unit: ing.unit ?? null,
      note: ing.note ?? null,
      aisle: ing.aisle ?? null,
      groupName: ing.groupName ?? null,
      position: ing.position ?? 0,
    })),
    instructions: recipe.instructions,
    tags: [],
  };
}

/**
 * Build a format-specific export pack and persist it via CompatRepository.
 */
export function buildCompatExportPack(input: BuildCompatExportPackInput): CompatExportPack {
  const adapter = getCompatAdapterForFormat(input.format);
  if (!adapter) {
    return input.compatRepo.createExportPack({
      format: input.format,
      recipeIds: input.recipeIds,
      status: 'failed',
      payload: { error: `No adapter for format: ${input.format}` },
    });
  }

  const recipes: CompatExportRecipe[] = [];
  for (const id of input.recipeIds) {
    const recipe = input.recipesRepo.getById(id);
    if (!recipe || recipe.deletedAt) continue;
    recipes.push(toExportRecipe(recipe));
  }

  const payload = adapter.serialize(recipes);
  return input.compatRepo.createExportPack({
    format: input.format,
    recipeIds: input.recipeIds,
    payload,
    status: 'ready',
  });
}
