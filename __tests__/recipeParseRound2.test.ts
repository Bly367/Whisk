import { groundParsedRecipe, suitableTitleFromText } from '@/import/parse/structured';
import { parseRecipeText } from '@/import/parse/parseRecipeText';
import { parseRecipeWithOpenAI } from '@/import/parse/openaiParse';

it('keeps basil, accepts normal titles, and rejects quantity-led ingredient lines', () => {
  const recipe = { title: 'T', ingredients: [{ name: 'fresh basil leaves' }], steps: [], parser: 'heuristic' as const };
  expect(groundParsedRecipe(recipe, 'handful basil')?.ingredients).toHaveLength(1);
  expect(suitableTitleFromText('One-pot pasta')).toBe('One-pot pasta');
  expect(suitableTitleFromText('The best pizza you can make')).toBe('The best pizza you can make');
  expect(suitableTitleFromText('a pinch of salt')).toBeNull();
});

it('grounds the specified whole-word cases and safely falls through keychain failures', async () => {
  for (const [name, source] of [['garlic cloves', '2 cloves garlic, minced'], ['fresh basil leaves', 'handful basil'], ['tomato', '2 tomatoes'], ['bay leaves', '2 bay leaves']])
    expect(groundParsedRecipe({ title: 'T', ingredients: [{ name }], steps: [], parser: 'heuristic' }, source)?.ingredients).toHaveLength(1);
  expect(groundParsedRecipe({ title: 'T', ingredients: [{ name: 'egg' }], steps: [], parser: 'heuristic' }, 'roast eggplant')).toBeNull();
  const badJson = await parseRecipeWithOpenAI('x', { apiKey: 'sk-test-SECRETKEY', fetch: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{not json' } }] }) }) as Response });
  expect(badJson).toEqual({ ok: false, reason: 'parse_failed' });
  const fallback = await parseRecipeText('Stir everything together. Bake for twenty minutes. Serve warm.', { heuristicKind: 'transcript', sharedText: 'Lemon cake. Mix 2 cups of flour with 1 cup of sugar. Add 3 eggs.', foundation: async () => { throw new Error('x'); }, readApiKey: async () => { throw new Error('keychain'); } });
  expect(fallback?.ingredients).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'sugar' })]));
});

it('prefers a suitable caption for transcript heuristic titles', async () => {
  const unavailable = async () => ({ ok: false as const, reason: 'unavailable' as const });
  const noKey = async () => null;
  for (const transcript of [
    'These are the best qualities. Add 2 cups of flour. Stir the flour into the butter.',
    'This is the best qualities of a good cook. Add 2 cups of flour. Stir the flour.',
    'This is the best everything. Add 2 cups of flour. Stir the flour.',
  ]) {
    const draft = await parseRecipeText(transcript, { heuristicKind: 'transcript', sharedText: 'Smitten Kitchen tomato soup', foundation: unavailable, readApiKey: noKey });
    expect(draft?.title).toBe('Smitten Kitchen tomato soup');
    expect(draft?.confidence.title).toBe('high');
  }
});
