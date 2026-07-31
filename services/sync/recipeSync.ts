import {
  Folder,
  FolderTombstone,
  GroceryItem,
  MealPlanSlot,
  Recipe,
  RecipeTombstone,
} from '../../types/recipe';
import { supabase, supabaseConfigured } from '../../lib/supabase';
import { normalizeMealPlan } from '../mealPlan/dates';

const emptyMealPlan = (): MealPlanSlot[] => [];

const epoch = '1970-01-01T00:00:00.000Z';

export interface CloudUserData {
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

interface CloudEntityRow {
  id: string;
  data: unknown;
  updated_at: string;
  deleted_at?: string | null;
}

export async function pullUserData(userId: string): Promise<CloudUserData | null> {
  if (!supabase) return null;

  const [recipesRes, foldersRes, planRes, groceryRes] = await Promise.all([
    supabase
      .from('user_recipes')
      .select('id,data,updated_at,deleted_at')
      .eq('user_id', userId),
    supabase
      .from('user_folders')
      .select('id,data,updated_at,deleted_at')
      .eq('user_id', userId),
    supabase
      .from('user_meal_plan')
      .select('slots,updated_at')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('user_grocery_state')
      .select('checked_ids,manual_items,updated_at')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (recipesRes.error || foldersRes.error || planRes.error || groceryRes.error) return null;

  const recipeRows = (recipesRes.data ?? []) as CloudEntityRow[];
  const folderRows = (foldersRes.data ?? []) as CloudEntityRow[];
  const recipes = recipeRows
    .filter((row) => !row.deleted_at)
    .map((row) => ({ ...(row.data as Recipe), id: row.id, updatedAt: row.updated_at }));
  const recipeTombstones = recipeRows
    .filter((row) => Boolean(row.deleted_at))
    .map((row) => ({ id: row.id, deletedAt: row.deleted_at! }));
  const folders = folderRows
    .filter((row) => !row.deleted_at)
    .map((row) => ({ ...(row.data as Folder), id: row.id, updatedAt: row.updated_at }));
  const folderTombstones = folderRows
    .filter((row) => Boolean(row.deleted_at))
    .map((row) => ({ id: row.id, deletedAt: row.deleted_at! }));

  return {
    recipes,
    recipeTombstones,
    folders,
    folderTombstones,
    mealPlan: normalizeMealPlan(planRes.data?.slots ?? emptyMealPlan()),
    mealPlanUpdatedAt: planRes.data?.updated_at ?? epoch,
    groceryCheckedIds: (groceryRes.data?.checked_ids as string[] | undefined) ?? [],
    manualGroceryItems:
      (groceryRes.data?.manual_items as GroceryItem[] | undefined) ?? [],
    groceryUpdatedAt: groceryRes.data?.updated_at ?? epoch,
  };
}

export async function pushUserData(
  _userId: string,
  data: {
    recipes: Recipe[];
    recipeTombstones: RecipeTombstone[];
    folders: Folder[];
    folderTombstones: FolderTombstone[];
    mealPlan: MealPlanSlot[];
    mealPlanUpdatedAt: string;
    groceryCheckedIds: string[];
    manualGroceryItems: GroceryItem[];
    groceryUpdatedAt: string;
  },
): Promise<boolean> {
  if (!supabase) return false;

  const { error: stateError } = await supabase.rpc('sync_user_state', {
    p_recipes: data.recipes,
    p_recipe_tombstones: data.recipeTombstones,
    p_folders: data.folders,
    p_plan: data.mealPlan,
    p_plan_updated_at: data.mealPlanUpdatedAt,
    p_grocery_checked_ids: data.groceryCheckedIds,
    p_grocery_updated_at: data.groceryUpdatedAt,
  });
  if (stateError) return false;

  const { error: folderError } = await supabase.rpc('sync_folder_tombstones', {
    p_tombstones: data.folderTombstones,
  });
  if (folderError) return false;

  const { error: groceryError } = await supabase.rpc('sync_manual_grocery_items', {
    p_items: data.manualGroceryItems,
    p_updated_at: data.groceryUpdatedAt,
  });
  return !groceryError;
}

export function isSyncAvailable() {
  return supabaseConfigured;
}
