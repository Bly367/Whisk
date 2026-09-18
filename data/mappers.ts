import type {
  Collection,
  CollectionKind,
  CompatExportPack,
  CompatExportStatus,
  CompatFormat,
  CompatImportJob,
  CompatImportStatus,
  CookStep,
  GroceryItem,
  GroceryList,
  Household,
  HouseholdMember,
  HouseholdMemberRole,
  HouseholdMemberStatus,
  Ingredient,
  LeftoversLink,
  LocalSyncStatus,
  MealPlan,
  MealPlanEntry,
  MealPlanTemplate,
  MealPlanTemplateEntry,
  MealSlot,
  PantryItem,
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
  household_id: string | null;
  remote_id: string | null;
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
    householdId: row.household_id ?? null,
    remoteId: row.remote_id ?? null,
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
  household_id?: string | null;
  remote_id?: string | null;
}): MealPlan {
  return {
    id: row.id,
    weekStart: row.week_start,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncStatus: row.sync_status,
    householdId: row.household_id ?? null,
    remoteId: row.remote_id ?? null,
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
  household_id?: string | null;
  remote_id?: string | null;
}): GroceryList {
  return {
    id: row.id,
    name: row.name,
    mealPlanId: row.meal_plan_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncStatus: row.sync_status,
    householdId: row.household_id ?? null,
    remoteId: row.remote_id ?? null,
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

export function mapHousehold(row: {
  id: string;
  name: string;
  owner_user_id: string | null;
  invite_code: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  local_revision: number;
  sync_status: LocalSyncStatus;
  remote_id: string | null;
}): Household {
  return {
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    inviteCode: row.invite_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    localRevision: row.local_revision,
    syncStatus: row.sync_status,
    remoteId: row.remote_id,
  };
}

export function mapHouseholdMember(row: {
  id: string;
  household_id: string;
  user_id: string | null;
  display_name: string | null;
  role: HouseholdMemberRole;
  status: HouseholdMemberStatus;
  created_at: string;
  updated_at: string;
}): HouseholdMember {
  return {
    id: row.id,
    householdId: row.household_id,
    userId: row.user_id,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPantryItem(row: {
  id: string;
  household_id: string | null;
  name: string;
  quantity: string | null;
  unit: string | null;
  aisle: string | null;
  notes: string | null;
  expires_at: string | null;
  depleted_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  local_revision: number;
  sync_status: LocalSyncStatus;
  remote_id: string | null;
}): PantryItem {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    aisle: row.aisle,
    notes: row.notes,
    expiresAt: row.expires_at,
    depletedAt: row.depleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    localRevision: row.local_revision,
    syncStatus: row.sync_status,
    remoteId: row.remote_id,
  };
}

export function mapMealPlanTemplate(row: {
  id: string;
  household_id: string | null;
  name: string;
  source_meal_plan_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  local_revision: number;
  sync_status: LocalSyncStatus;
  remote_id: string | null;
}): MealPlanTemplate {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    sourceMealPlanId: row.source_meal_plan_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    localRevision: row.local_revision,
    syncStatus: row.sync_status,
    remoteId: row.remote_id,
  };
}

export function mapMealPlanTemplateEntry(row: {
  id: string;
  template_id: string;
  recipe_id: string | null;
  day_offset: number;
  slot: MealSlot;
  note: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}): MealPlanTemplateEntry {
  return {
    id: row.id,
    templateId: row.template_id,
    recipeId: row.recipe_id,
    dayOffset: row.day_offset,
    slot: row.slot,
    note: row.note,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapLeftoversLink(row: {
  id: string;
  household_id: string | null;
  source_recipe_id: string | null;
  source_meal_plan_entry_id: string | null;
  leftover_recipe_id: string | null;
  target_meal_plan_entry_id: string | null;
  label: string | null;
  servings_remaining: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  local_revision: number;
  sync_status: LocalSyncStatus;
  remote_id: string | null;
}): LeftoversLink {
  return {
    id: row.id,
    householdId: row.household_id,
    sourceRecipeId: row.source_recipe_id,
    sourceMealPlanEntryId: row.source_meal_plan_entry_id,
    leftoverRecipeId: row.leftover_recipe_id,
    targetMealPlanEntryId: row.target_meal_plan_entry_id,
    label: row.label,
    servingsRemaining: row.servings_remaining,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    localRevision: row.local_revision,
    syncStatus: row.sync_status,
    remoteId: row.remote_id,
  };
}

function parseJsonObject(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

export function mapCompatImportJob(row: {
  id: string;
  format: CompatFormat;
  status: CompatImportStatus;
  source_label: string | null;
  preview_json: string;
  confidence: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  committed_at: string | null;
  local_revision: number;
}): CompatImportJob {
  return {
    id: row.id,
    format: row.format,
    status: row.status,
    sourceLabel: row.source_label,
    preview: parseJsonObject(row.preview_json),
    confidence: row.confidence,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    committedAt: row.committed_at,
    localRevision: row.local_revision,
  };
}

export function mapCompatExportPack(row: {
  id: string;
  format: CompatFormat;
  status: CompatExportStatus;
  payload_json: string | null;
  recipe_ids_json: string;
  created_at: string;
  updated_at: string;
  local_revision: number;
}): CompatExportPack {
  const payload = row.payload_json ? parseJsonObject(row.payload_json) : null;
  return {
    id: row.id,
    format: row.format,
    status: row.status,
    payload: row.payload_json ? payload : null,
    recipeIds: parseJsonArray<string>(row.recipe_ids_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    localRevision: row.local_revision,
  };
}
