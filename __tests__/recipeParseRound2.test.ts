import { groundParsedRecipe, suitableTitleFromText } from '@/import/parse/structured';
import { parseRecipeText } from '@/import/parse/parseRecipeText';

it('keeps basil, accepts normal titles, and rejects quantity-led ingredient lines', () => {
  const recipe = { title: 'T', ingredients: [{ name: 'fresh basil leaves' }], steps: [], parser: 'heuristic' as const };
  expect(groundParsedRecipe(recipe, 'handful basil')?.ingredients).toHaveLength(1);
  expect(suitableTitleFromText('One-pot pasta')).toBe('One-pot pasta');
  expect(suitableTitleFromText('The best pizza you can make')).toBe('The best pizza you can make');
  expect(suitableTitleFromText('a pinch of salt')).toBeNull();
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
