import type {
  Collection,
  CollectionKind,
  CookStep,
  GroceryItem,
  GroceryList,
  Ingredient,
  LocalSyncStatus,
  MealPlan,
  MealPlanEntry,
  MealSlot,
  Recipe,
  RecipeStatus,
  Tag,
} from '@/data/contracts';
import { parseJsonArray, toBool } from '@/data/util';

export type RecipeRow = {
  id: string;
  title: string;
  notes: string | null;
  source_url: string | null;
  source_name: string | null;
  image_uri: string | null;
  servings: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  rating: number | null;
  instructions_json: string;
  status: RecipeStatus;
  is_favorite: number;
  cooked_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  local_revision: number;
  sync_status: LocalSyncStatus;
};

export type IngredientRow = {
  id: string;
  recipe_id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  note: string | null;
  aisle: string | null;
  group_name: string | null;
  position: number;
};

export function mapRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    imageUri: row.image_uri,
    servings: row.servings,
    prepMinutes: row.prep_minutes,
    cookMinutes: row.cook_minutes,
    rating: row.rating,
    instructions: parseJsonArray<CookStep>(row.instructions_json, []),
    status: row.status,
    isFavorite: toBool(row.is_favorite),
    cookedAt: row.cooked_at,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    localRevision: row.local_revision,
    syncStatus: row.sync_status,
  };
}

export function mapIngredient(row: IngredientRow): Ingredient {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    note: row.note,
    aisle: row.aisle,
    groupName: row.group_name,
    position: row.position,
  };
}

export function mapTag(row: { id: string; name: string; created_at: string }): Tag {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

export function mapCollection(row: {
  id: string;
  name: string;
  kind: CollectionKind;
  rules_json: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): Collection {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    rulesJson: row.rules_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapMealPlan(row: {
  id: string;
  week_start: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: LocalSyncStatus;
}): MealPlan {
  return {
    id: row.id,
    weekStart: row.week_start,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncStatus: row.sync_status,
  };
}

export function mapMealPlanEntry(row: {
  id: string;
  meal_plan_id: string;
  recipe_id: string | null;
  plan_date: string;
  slot: MealSlot;
  note: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}): MealPlanEntry {
  return {
    id: row.id,
    mealPlanId: row.meal_plan_id,
    recipeId: row.recipe_id,
    planDate: row.plan_date,
    slot: row.slot,
    note: row.note,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapGroceryList(row: {
  id: string;
  name: string;
  meal_plan_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: LocalSyncStatus;
}): GroceryList {
  return {
    id: row.id,
    name: row.name,
    mealPlanId: row.meal_plan_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncStatus: row.sync_status,
  };
}

export function mapGroceryItem(row: {
  id: string;
  list_id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  aisle: string | null;
  is_completed: number;
  completed_at: string | null;
  recipe_id: string | null;
  recipe_title: string | null;
  merge_key: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): GroceryItem {
  return {
    id: row.id,
    listId: row.list_id,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    aisle: row.aisle,
    isCompleted: toBool(row.is_completed),
    completedAt: row.completed_at,
    recipeId: row.recipe_id,
    recipeTitle: row.recipe_title,
    mergeKey: row.merge_key,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}
