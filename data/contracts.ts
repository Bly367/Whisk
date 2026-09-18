/**
 * Shared domain contracts for Whisk workstreams (W3–W7).
 * Import from `@/data` or `@/data/contracts` — do not redefine these shapes in feature modules.
 */

/** Local persistence outcome. Cloud sync is future; never treat as cloud success. */
export type LocalSyncStatus = 'synced_local' | 'pending' | 'needs_attention';

/** Maps to SyncStatusBanner presentation (honest local states only). */
export type SyncBannerStatus =
  'saved_locally' | 'syncing' | 'synced' | 'needs_attention' | 'offline';

export type RecipeStatus = 'draft' | 'published';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type CollectionKind = 'manual' | 'smart';

export type CookStep = {
  id: string;
  text: string;
  position: number;
};

export type IngredientInput = {
  name: string;
  quantity?: string | null;
  unit?: string | null;
  note?: string | null;
  aisle?: string | null;
  groupName?: string | null;
  position?: number;
};

export type Ingredient = IngredientInput & {
  id: string;
  recipeId: string;
};

export type Recipe = {
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
  instructions: CookStep[];
  status: RecipeStatus;
  isFavorite: boolean;
  cookedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  localRevision: number;
  syncStatus: LocalSyncStatus;
};

export type RecipeWithIngredients = Recipe & {
  ingredients: Ingredient[];
  tagIds: string[];
};

/** List-row shape: ingredients loaded in one query (no N+1). */
export type RecipeListItem = Recipe & {
  ingredientNames: string[];
  tagNames: string[];
};

export type RecipeCreateInput = {
  title: string;
  notes?: string | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
  imageUri?: string | null;
  servings?: number | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  rating?: number | null;
  instructions?: CookStep[];
  status?: RecipeStatus;
  isFavorite?: boolean;
  ingredients?: IngredientInput[];
  tagIds?: string[];
};

export type RecipeUpdateInput = Partial<RecipeCreateInput> & {
  cookedAt?: string | null;
};

export type Tag = {
  id: string;
  name: string;
  createdAt: string;
};

export type Collection = {
  id: string;
  name: string;
  kind: CollectionKind;
  rulesJson: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type MealPlan = {
  id: string;
  weekStart: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: LocalSyncStatus;
};

export type MealPlanEntry = {
  id: string;
  mealPlanId: string;
  recipeId: string | null;
  planDate: string;
  slot: MealSlot;
  note: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type MealPlanWithEntries = MealPlan & {
  entries: MealPlanEntry[];
};

export type GroceryList = {
  id: string;
  name: string;
  mealPlanId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: LocalSyncStatus;
};

export type GroceryItem = {
  id: string;
  listId: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  aisle: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  recipeId: string | null;
  recipeTitle: string | null;
  mergeKey: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type GroceryListWithItems = GroceryList & {
  items: GroceryItem[];
};

export type RecipeSort = 'newest' | 'oldest' | 'title_asc' | 'recently_cooked' | 'rating';

export type RecipeListQuery = {
  search?: string;
  tagIds?: string[];
  includeDeleted?: boolean;
  status?: RecipeStatus | 'any';
  sort?: RecipeSort;
  limit?: number;
  offset?: number;
};

export type AutosaveDraftInput = {
  recipeId?: string;
  patch: RecipeUpdateInput;
};

export type AutosaveResult = {
  recipe: RecipeWithIngredients;
  persistedAt: string;
};

/* ---- P2-W2 contracts (households, pantry, templates, leftovers, compat) ---- */

export type HouseholdMemberRole = 'owner' | 'member' | 'viewer';

export type HouseholdMemberStatus = 'active' | 'invited' | 'removed';

export type HouseholdMember = {
  id: string;
  householdId: string;
  userId: string | null;
  displayName: string | null;
  role: HouseholdMemberRole;
  status: HouseholdMemberStatus;
  createdAt: string;
  updatedAt: string;
};

export type Household = {
  id: string;
  name: string;
  ownerUserId: string | null;
  inviteCode: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  localRevision: number;
  syncStatus: LocalSyncStatus;
  remoteId: string | null;
};

export type HouseholdWithMembers = Household & {
  members: HouseholdMember[];
};

export type PantryItem = {
  id: string;
  householdId: string | null;
  name: string;
  quantity: string | null;
  unit: string | null;
  aisle: string | null;
  notes: string | null;
  expiresAt: string | null;
  depletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  localRevision: number;
  syncStatus: LocalSyncStatus;
  remoteId: string | null;
};

export type PantryListQuery = {
  householdId?: string | null;
  includeDepleted?: boolean;
  search?: string;
};

export type MealPlanTemplateEntry = {
  id: string;
  templateId: string;
  recipeId: string | null;
  dayOffset: number;
  slot: MealSlot;
  note: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type MealPlanTemplate = {
  id: string;
  householdId: string | null;
  name: string;
  sourceMealPlanId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  localRevision: number;
  syncStatus: LocalSyncStatus;
  remoteId: string | null;
};

export type MealPlanTemplateWithEntries = MealPlanTemplate & {
  entries: MealPlanTemplateEntry[];
};

export type LeftoversLink = {
  id: string;
  householdId: string | null;
  sourceRecipeId: string | null;
  sourceMealPlanEntryId: string | null;
  leftoverRecipeId: string | null;
  targetMealPlanEntryId: string | null;
  label: string | null;
  servingsRemaining: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  localRevision: number;
  syncStatus: LocalSyncStatus;
  remoteId: string | null;
};

export type CompatFormat = 'paprika' | 'json' | 'markdown' | 'generic';

export type CompatImportStatus = 'preview' | 'committed' | 'cancelled' | 'failed';

export type CompatExportStatus = 'draft' | 'ready' | 'failed';

export type CompatImportJob = {
  id: string;
  format: CompatFormat;
  status: CompatImportStatus;
  sourceLabel: string | null;
  preview: Record<string, unknown>;
  confidence: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  committedAt: string | null;
  localRevision: number;
};

export type CompatExportPack = {
  id: string;
  format: CompatFormat;
  status: CompatExportStatus;
  payload: Record<string, unknown> | null;
  recipeIds: string[];
  createdAt: string;
  updatedAt: string;
  localRevision: number;
};
