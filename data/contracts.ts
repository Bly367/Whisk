/**
 * Shared domain contracts for Whisk workstreams (W3–W7).
 * Import from `@/data` or `@/data/contracts` — do not redefine these shapes in feature modules.
 */

/** Local persistence outcome. Cloud sync is future; never treat as cloud success. */
export type LocalSyncStatus =
  | 'synced_local'
  | 'pending'
  | 'needs_attention';

/** Maps to SyncStatusBanner presentation (honest local states only). */
export type SyncBannerStatus =
  | 'saved_locally'
  | 'syncing'
  | 'synced'
  | 'needs_attention'
  | 'offline';

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

export type RecipeSort =
  | 'newest'
  | 'oldest'
  | 'title_asc'
  | 'recently_cooked'
  | 'rating';

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
