import { withoutSeedRecipes } from '../../data/initialRecipeData';
import {
  Folder,
  FolderTombstone,
  GroceryItem,
  MealPlanSlot,
  Recipe,
  RecipeTombstone,
} from '../../types/recipe';

export const parsedTime = (value?: string) => {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

export function mergeEntities<T extends { id: string; updatedAt?: string }>(
  local: T[],
  cloud: T[],
  fallbackTime: (entity: T) => string | undefined = () => undefined,
): T[] {
  const merged = new Map<string, T>();
  for (const entity of [...cloud, ...local]) {
    const existing = merged.get(entity.id);
    const entityTime = parsedTime(entity.updatedAt ?? fallbackTime(entity));
    const existingTime = existing
      ? parsedTime(existing.updatedAt ?? fallbackTime(existing))
      : -1;
    if (!existing || entityTime >= existingTime) merged.set(entity.id, entity);
  }
  return Array.from(merged.values());
}

export function mergeTombstones<T extends { id: string; deletedAt: string }>(
  local: T[],
  cloud: T[],
): T[] {
  const merged = new Map<string, T>();
  for (const tombstone of [...cloud, ...local]) {
    const existing = merged.get(tombstone.id);
    if (!existing || parsedTime(tombstone.deletedAt) >= parsedTime(existing.deletedAt)) {
      merged.set(tombstone.id, tombstone);
    }
  }
  return Array.from(merged.values());
}

export interface SyncMergeInput {
  recipes: Recipe[];
  recipeTombstones: RecipeTombstone[];
  folders: Folder[];
  folderTombstones: FolderTombstone[];
  mealPlan: MealPlanSlot[];
  mealPlanUpdatedAt: string;
  groceryCheckedIds: string[];
  manualGroceryItems: GroceryItem[];
  groceryUpdatedAt: string;
}

export function mergeCloudData(local: SyncMergeInput, cloud: SyncMergeInput): SyncMergeInput {
  const tombstones = mergeTombstones(local.recipeTombstones, cloud.recipeTombstones);
  const tombstoneById = new Map(tombstones.map((item) => [item.id, item]));
  const recipes = mergeEntities(
    withoutSeedRecipes(local.recipes),
    withoutSeedRecipes(cloud.recipes),
    (recipe) => recipe.createdAt,
  ).filter((recipe) => {
    const deleted = tombstoneById.get(recipe.id);
    return (
      !deleted ||
      parsedTime(recipe.updatedAt ?? recipe.createdAt) > parsedTime(deleted.deletedAt)
    );
  });
  const activeIds = new Set(recipes.map((recipe) => recipe.id));
  const folderTombstones = mergeTombstones(local.folderTombstones, cloud.folderTombstones);
  const folderTombstoneById = new Map(folderTombstones.map((item) => [item.id, item]));
  const folders = mergeEntities(local.folders, cloud.folders).filter((folder) => {
    const deleted = folderTombstoneById.get(folder.id);
    return !deleted || parsedTime(folder.updatedAt) > parsedTime(deleted.deletedAt);
  });
  const activeFolderIds = new Set(folders.map((folder) => folder.id));

  const cloudPlanIsNewer =
    parsedTime(cloud.mealPlanUpdatedAt) > parsedTime(local.mealPlanUpdatedAt);
  const cloudGroceryIsNewer =
    parsedTime(cloud.groceryUpdatedAt) > parsedTime(local.groceryUpdatedAt);

  return {
    recipes,
    recipeTombstones: tombstones.filter((item) => !activeIds.has(item.id)),
    folders,
    folderTombstones: folderTombstones.filter((item) => !activeFolderIds.has(item.id)),
    mealPlan: cloudPlanIsNewer ? cloud.mealPlan : local.mealPlan,
    mealPlanUpdatedAt: cloudPlanIsNewer
      ? cloud.mealPlanUpdatedAt
      : local.mealPlanUpdatedAt,
    groceryCheckedIds: cloudGroceryIsNewer
      ? cloud.groceryCheckedIds
      : local.groceryCheckedIds,
    manualGroceryItems: cloudGroceryIsNewer
      ? cloud.manualGroceryItems
      : local.manualGroceryItems,
    groceryUpdatedAt: cloudGroceryIsNewer
      ? cloud.groceryUpdatedAt
      : local.groceryUpdatedAt,
  };
}
