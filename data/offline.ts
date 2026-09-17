import type {
  GroceryListWithItems,
  MealPlanWithEntries,
  RecipeListItem,
  RecipeListQuery,
  RecipeWithIngredients,
} from '@/data/contracts';
import type { DbClient } from '@/data/client';
import { createRepositories } from '@/data/repositories';

/**
 * Offline read path — all data comes from local SQLite.
 * Feature screens should use these (or repositories) rather than network.
 */
export function createOfflineReader(db: DbClient) {
  const repos = createRepositories(db);

  return {
    getRecipe(id: string): RecipeWithIngredients | null {
      return repos.recipes.getById(id);
    },

    listRecipes(query?: RecipeListQuery): RecipeListItem[] {
      return repos.recipes.list(query);
    },

    listTrashedRecipes(): RecipeListItem[] {
      return repos.recipes.listTrash();
    },

    getMealPlan(id: string): MealPlanWithEntries | null {
      return repos.mealPlans.getById(id);
    },

    getMealPlanForWeek(weekStart: string): MealPlanWithEntries {
      return repos.mealPlans.getOrCreateForWeek(weekStart);
    },

    listMealPlans() {
      return repos.mealPlans.list();
    },

    getGroceryList(id: string): GroceryListWithItems | null {
      return repos.grocery.getById(id);
    },

    listGroceryLists() {
      return repos.grocery.list();
    },
  };
}

export type OfflineReader = ReturnType<typeof createOfflineReader>;
