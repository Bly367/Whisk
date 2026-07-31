import { Folder, GroceryItem, MealPlanSlot, Recipe } from '../../types/recipe';
import { supabase, supabaseConfigured } from '../../lib/supabase';

const emptyMealPlan = (): MealPlanSlot[] =>
  Array.from({ length: 7 }, (_, dayIndex) => ({ dayIndex, recipeId: null }));

export async function pullUserData(userId: string): Promise<{
  recipes: Recipe[];
  folders: Folder[];
  mealPlan: MealPlanSlot[];
  groceryCheckedIds: string[];
} | null> {
  if (!supabase) return null;

  const [recipesRes, foldersRes, planRes, groceryRes] = await Promise.all([
    supabase.from('user_recipes').select('data').eq('user_id', userId),
    supabase.from('user_folders').select('data').eq('user_id', userId),
    supabase.from('user_meal_plan').select('slots').eq('user_id', userId).maybeSingle(),
    supabase.from('user_grocery_state').select('checked_ids').eq('user_id', userId).maybeSingle(),
  ]);

  if (recipesRes.error || foldersRes.error) return null;

  return {
    recipes: (recipesRes.data ?? []).map((row) => row.data as Recipe),
    folders: (foldersRes.data ?? []).map((row) => row.data as Folder),
    mealPlan: (planRes.data?.slots as MealPlanSlot[] | undefined) ?? emptyMealPlan(),
    groceryCheckedIds: (groceryRes.data?.checked_ids as string[] | undefined) ?? [],
  };
}

export async function pushUserData(
  userId: string,
  data: {
    recipes: Recipe[];
    folders: Folder[];
    mealPlan: MealPlanSlot[];
    groceryCheckedIds: string[];
  },
): Promise<boolean> {
  if (!supabase) return false;

  const recipeRows = data.recipes.map((recipe) => ({
    id: recipe.id,
    user_id: userId,
    data: recipe,
    updated_at: new Date().toISOString(),
  }));
  const folderRows = data.folders.map((folder) => ({
    id: folder.id,
    user_id: userId,
    data: folder,
    updated_at: new Date().toISOString(),
  }));

  const { error: recipeError } = await supabase.from('user_recipes').upsert(recipeRows);
  const { error: folderError } = await supabase.from('user_folders').upsert(folderRows);
  const { error: planError } = await supabase.from('user_meal_plan').upsert({
    user_id: userId,
    slots: data.mealPlan,
    updated_at: new Date().toISOString(),
  });
  const { error: groceryError } = await supabase.from('user_grocery_state').upsert({
    user_id: userId,
    checked_ids: data.groceryCheckedIds,
    updated_at: new Date().toISOString(),
  });

  return !(recipeError || folderError || planError || groceryError);
}

export async function deleteRecipeRemote(userId: string, recipeId: string) {
  if (!supabase) return;
  await supabase.from('user_recipes').delete().eq('user_id', userId).eq('id', recipeId);
}

export function isSyncAvailable() {
  return supabaseConfigured;
}
