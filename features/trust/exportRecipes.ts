import type { RecipeListItem, RecipeWithIngredients, Tag } from '@/data/contracts';
import type { OfflineReader } from '@/data/offline';
import type { Repositories } from '@/data/repositories';

export const WHISK_EXPORT_FORMAT = 'whisk-export' as const;
export const WHISK_EXPORT_VERSION = 1 as const;

export type WhiskRecipeExport = {
  id: string;
  title: string;
  notes: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  imageUri: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  rating: number | null;
  instructions: RecipeWithIngredients['instructions'];
  ingredients: {
    name: string;
    quantity: string | null;
    unit: string | null;
    note: string | null;
    aisle: string | null;
    groupName: string | null;
    position: number;
  }[];
  tags: string[];
  status: RecipeWithIngredients['status'];
  isFavorite: boolean;
  cookedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WhiskExportPayload = {
  format: typeof WHISK_EXPORT_FORMAT;
  version: typeof WHISK_EXPORT_VERSION;
  exportedAt: string;
  mode: 'guest' | 'signed_in';
  tags: { id: string; name: string }[];
  recipes: WhiskRecipeExport[];
};

function tagNamesFor(recipe: RecipeWithIngredients, tagsById: Map<string, Tag>): string[] {
  return recipe.tagIds
    .map((id) => tagsById.get(id)?.name)
    .filter((name): name is string => Boolean(name));
}

function toExportRecipe(
  recipe: RecipeWithIngredients,
  tagsById: Map<string, Tag>,
): WhiskRecipeExport {
  return {
    id: recipe.id,
    title: recipe.title,
    notes: recipe.notes,
    sourceUrl: recipe.sourceUrl,
    sourceName: recipe.sourceName,
    imageUri: recipe.imageUri,
    servings: recipe.servings,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    rating: recipe.rating,
    instructions: recipe.instructions,
    ingredients: recipe.ingredients.map((ing) => ({
      name: ing.name,
      quantity: ing.quantity ?? null,
      unit: ing.unit ?? null,
      note: ing.note ?? null,
      aisle: ing.aisle ?? null,
      groupName: ing.groupName ?? null,
      position: ing.position ?? 0,
    })),
    tags: tagNamesFor(recipe, tagsById),
    status: recipe.status,
    isFavorite: recipe.isFavorite,
    cookedAt: recipe.cookedAt,
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
  };
}

/**
 * Build a portable JSON export from the offline reader + tag repo.
 * Available anytime, including after free-tier downgrade.
 */
export function buildRecipeExport(options: {
  reader: OfflineReader;
  tags: Tag[];
  mode?: 'guest' | 'signed_in';
  now?: Date;
}): WhiskExportPayload {
  const tagsById = new Map(options.tags.map((t) => [t.id, t]));
  const list: RecipeListItem[] = options.reader.listRecipes({
    status: 'any',
    sort: 'title_asc',
  });

  const recipes: WhiskRecipeExport[] = [];
  for (const item of list) {
    const full = options.reader.getRecipe(item.id);
    if (!full || full.deletedAt) continue;
    recipes.push(toExportRecipe(full, tagsById));
  }

  return {
    format: WHISK_EXPORT_FORMAT,
    version: WHISK_EXPORT_VERSION,
    exportedAt: (options.now ?? new Date()).toISOString(),
    mode: options.mode ?? 'guest',
    tags: options.tags.map((t) => ({ id: t.id, name: t.name })),
    recipes,
  };
}

export function exportPayloadToJson(payload: WhiskExportPayload): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

/** Convenience for screens that already hold repositories. */
export function buildExportFromRepos(
  repos: Repositories,
  reader: OfflineReader,
  mode: 'guest' | 'signed_in' = 'guest',
): WhiskExportPayload {
  return buildRecipeExport({
    reader,
    tags: repos.tags.list(),
    mode,
  });
}
