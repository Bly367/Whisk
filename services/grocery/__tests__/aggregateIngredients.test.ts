import { describe, expect, it } from 'vitest';
import { aggregateIngredients } from '../aggregateIngredients';

describe('aggregateIngredients', () => {
  it('merges duplicate ingredient names', () => {
    const items = aggregateIngredients([
      {
        recipeId: 'a',
        ingredients: [
          { id: '1', amount: '2', unit: 'tbsp', name: 'Honey' },
          { id: '2', amount: '1', unit: 'clove', name: 'Garlic' },
        ],
      },
      {
        recipeId: 'b',
        ingredients: [{ id: '3', amount: '1', unit: 'tbsp', name: 'Honey' }],
      },
    ]);

    expect(items).toHaveLength(2);
    const honey = items.find((item) => item.name === 'Honey');
    expect(honey?.amount).toBe('3');
    expect(honey?.unit).toBe('tbsp');
    expect(honey?.recipeIds).toEqual(expect.arrayContaining(['a', 'b']));
  });

  it('scales servings and converts compatible units', () => {
    const items = aggregateIngredients([
      {
        recipeId: 'a',
        factor: 2,
        ingredients: [{ id: '1', amount: '1', unit: 'cup', name: 'Milk' }],
      },
      {
        recipeId: 'b',
        ingredients: [{ id: '2', amount: '8', unit: 'tbsp', name: 'Milk' }],
      },
    ]);

    expect(items[0]).toMatchObject({ name: 'Milk', amount: '2.5', unit: 'cup' });
  });

  it('preserves incompatible or nonnumeric quantities', () => {
    const items = aggregateIngredients([
      {
        recipeId: 'a',
        ingredients: [{ id: '1', amount: '1', unit: 'cup', name: 'Tomatoes' }],
      },
      {
        recipeId: 'b',
        ingredients: [{ id: '2', amount: '2', unit: '', name: 'Tomatoes' }],
      },
    ]);

    expect(items[0].amount).toBe('1 cup + 2');
    expect(items[0].unit).toBe('');
  });
});
