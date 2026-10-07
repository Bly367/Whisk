import { ingredientsForCookStep } from '@/features/cook/cookIngredients';

const ingredients = [
  { id: '1', name: 'onions' },
  { id: '2', name: 'garlic' },
  { id: '3', name: 'soy sauce' },
];

it('matches named ingredients in the current cook step', () => {
  expect(ingredientsForCookStep(ingredients, 'Cook the onion and garlic.').map((item) => item.name)).toEqual(['onions', 'garlic']);
});

it('falls back to all ingredients when none are mentioned', () => {
  expect(ingredientsForCookStep(ingredients, 'Serve immediately.')).toEqual(ingredients);
});

it('matches singular and plural forms without a generic sauce false positive', () => {
  expect(ingredientsForCookStep(ingredients, 'Add the onion to the pan.').map((item) => item.name)).toEqual(['onions']);
  expect(ingredientsForCookStep(ingredients, 'Make the sauce.')).toEqual(ingredients);
});
