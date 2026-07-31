import { describe, expect, it } from 'vitest';
import {
  estimateNutritionFromIngredients,
  resolveRecipeNutrition,
} from '../estimateFromIngredients';

describe('estimateNutritionFromIngredients', () => {
  it('estimates per-serving macros from matched ingredients', () => {
    const estimate = estimateNutritionFromIngredients(
      [
        { id: '1', amount: '200', unit: 'g', name: 'chicken breast' },
        { id: '2', amount: '1', unit: 'cup', name: 'rice' },
        { id: '3', amount: '1', unit: 'tbsp', name: 'olive oil' },
      ],
      2,
    );

    expect(estimate).toBeDefined();
    expect(estimate?.matchedIngredients).toBe(3);
    expect(estimate?.nutrition.calories).toBeGreaterThan(0);
    expect(estimate?.nutrition.protein).toBeGreaterThan(0);
  });

  it('parses amounts embedded in the ingredient name', () => {
    const estimate = estimateNutritionFromIngredients(
      [{ id: '1', amount: '', unit: '', name: '2 cups milk' }],
      1,
    );
    expect(estimate?.matchedIngredients).toBe(1);
    expect(estimate?.nutrition.calories).toBeGreaterThan(100);
  });

  it('returns undefined when nothing matches', () => {
    expect(
      estimateNutritionFromIngredients([{ id: '1', amount: '1', unit: '', name: 'xyzzy mystery dust' }]),
    ).toBeUndefined();
  });
});

describe('resolveRecipeNutrition', () => {
  it('prefers explicit nutrition over estimates', () => {
    const resolved = resolveRecipeNutrition({
      nutrition: { calories: 500, protein: 40, carbs: 20, fat: 25 },
      ingredients: [{ id: '1', amount: '100', unit: 'g', name: 'chicken breast' }],
      servings: 1,
    });
    expect(resolved).toEqual({
      nutrition: { calories: 500, protein: 40, carbs: 20, fat: 25 },
      estimated: false,
    });
  });

  it('falls back to ingredient estimates', () => {
    const resolved = resolveRecipeNutrition({
      ingredients: [{ id: '1', amount: '100', unit: 'g', name: 'chicken breast' }],
      servings: 1,
    });
    expect(resolved?.estimated).toBe(true);
    expect(resolved?.nutrition.protein).toBeGreaterThan(20);
  });

  it('scales to full recipe totals when multiplied by servings', () => {
    const estimate = estimateNutritionFromIngredients(
      [{ id: '1', amount: '700', unit: 'g', name: 'uncooked chicken breast' }],
      4,
    );
    expect(estimate).toBeDefined();
    // Per serving ≈ (700/100)*22.5 / 4 ≈ 39g; all 4 servings ≈ 157g
    const forAllServings = (estimate?.nutrition.protein ?? 0) * 4;
    expect(forAllServings).toBeGreaterThan(150);
    expect(forAllServings).toBeLessThan(170);
  });
});
