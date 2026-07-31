import { Folder, Recipe } from '../types/recipe';
import { seedFolders, seedRecipes } from './seedRecipes';

export interface InitialRecipeData {
  recipes: Recipe[];
  folders: Folder[];
}

export interface InitialRecipeDataOptions {
  isDevelopment: boolean;
  enableDemoData?: string;
}

const seedRecipeIds = new Set(seedRecipes.map((recipe) => recipe.id));

export const isSeedRecipe = (recipe: Recipe): boolean => seedRecipeIds.has(recipe.id);

export const withoutSeedRecipes = (recipes: Recipe[]): Recipe[] =>
  recipes.filter((recipe) => !isSeedRecipe(recipe));

export const createInitialRecipeData = ({
  isDevelopment,
  enableDemoData,
}: InitialRecipeDataOptions): InitialRecipeData => ({
  recipes: isDevelopment && enableDemoData === 'true' ? [...seedRecipes] : [],
  folders: [...seedFolders],
});
