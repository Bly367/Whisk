import { groundParsedRecipe, suitableTitleFromText } from '@/import/parse/structured';

it('keeps basil, accepts normal titles, and rejects quantity-led ingredient lines', () => {
  const recipe = { title: 'T', ingredients: [{ name: 'fresh basil leaves' }], steps: [], parser: 'heuristic' as const };
  expect(groundParsedRecipe(recipe, 'handful basil')?.ingredients).toHaveLength(1);
  expect(suitableTitleFromText('One-pot pasta')).toBe('One-pot pasta');
  expect(suitableTitleFromText('The best pizza you can make')).toBe('The best pizza you can make');
  expect(suitableTitleFromText('a pinch of salt')).toBeNull();
});
