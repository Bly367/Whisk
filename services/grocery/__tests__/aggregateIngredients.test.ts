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
    expect(honey?.amount).toContain('2');
    expect(honey?.recipeIds).toEqual(expect.arrayContaining(['a', 'b']));
  });
});
