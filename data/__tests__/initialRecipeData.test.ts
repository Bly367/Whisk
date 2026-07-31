import { describe, expect, it } from 'vitest';
import {
  createInitialRecipeData,
  isSeedRecipe,
  withoutSeedRecipes,
} from '../initialRecipeData';

describe('initial recipe data', () => {
  it('starts with an empty recipe library by default', () => {
    const data = createInitialRecipeData({ isDevelopment: false });

    expect(data.recipes).toEqual([]);
    expect(data.folders.length).toBeGreaterThan(0);
  });

  it('only enables demo recipes behind the development switch', () => {
    expect(
      createInitialRecipeData({
        isDevelopment: false,
        enableDemoData: 'true',
      }).recipes,
    ).toEqual([]);
    expect(
      createInitialRecipeData({
        isDevelopment: true,
        enableDemoData: 'false',
      }).recipes,
    ).toEqual([]);

    const developmentData = createInitialRecipeData({
      isDevelopment: true,
      enableDemoData: 'true',
    });
    expect(developmentData.recipes.length).toBeGreaterThan(0);
    expect(developmentData.recipes.every(isSeedRecipe)).toBe(true);
  });

  it('removes seed recipes from account sync payloads', () => {
    const demoRecipes = createInitialRecipeData({
      isDevelopment: true,
      enableDemoData: 'true',
    }).recipes;
    const userRecipe = { ...demoRecipes[0], id: 'user-recipe' };

    expect(withoutSeedRecipes([...demoRecipes, userRecipe])).toEqual([userRecipe]);
  });
});
