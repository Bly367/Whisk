import { runAutoImport } from '@/import/autoImport';
import { parseIngredientLine } from '@/import/parse/ingredients';
import { cleanSocialCaption } from '@/import/social/cleanCaption';

const body = (title: string) => `${title}\nIngredients:\n200 g spaghetti\n2 tbsp butter\nInstructions:\n1. Boil the pasta.\n2. Toss with butter.`;

async function auto(caption: string) {
  const commitImportDraft = jest.fn(() => ({ id: 'saved' }));
  const result = await runAutoImport({ url: 'https://www.tiktok.com/@cook/video/1' }, {
    fetchSocialMeta: async () => ({ source: 'tiktok' as const, canonicalUrl: 'https://www.tiktok.com/@cook/video/1', caption, linkedUrls: [] }),
    videoFromUrl: async () => ({ ok: false as const, reason: 'no_video_url' as const }),
    commitImportDraft,
  });
  return result;
}

describe('social caption titles', () => {
  it.each([
    ['5 minute garlic noodles', '5 minute garlic noodles'], ['2 ingredient pancakes', '2 ingredient pancakes'],
    ['Lemon garlic pasta 🍋', 'Lemon garlic pasta'], ['Sesame chicken', 'Sesame chicken'],
    ['Pepper steak stir fry', 'Pepper steak stir fry'], ['Basil pesto pasta', 'Basil pesto pasta'],
    ['Salt and vinegar potatoes', 'Salt and vinegar potatoes'], ['Oil-free granola', 'Oil-free granola'],
    ['One pot chicken and rice 🍗', 'One pot chicken and rice'],
  ])('uses the first caption line as the saved title: %s', async (firstLine, expected) => {
    const caption = body(firstLine);
    const cleaned = cleanSocialCaption(caption, 'tiktok');
    expect(cleaned.title).toBe(expected);
    expect(cleaned.ingredients.map((item) => item.name)).toEqual(['spaghetti', 'butter']);
    const result = await auto(caption);
    if (result.ok) expect(result.draft.title).toBe(expected);
    else throw new Error('expected caption to save');
  });

  it('uses a prose first line and never derives a title from steps', () => {
    const cleaned = cleanSocialCaption('One pot chicken and rice 🍗\n1 lb chicken thighs\n1 cup rice\n2 cups broth\nBrown the chicken in a large pot.\nAdd the rice and broth and simmer for 20 minutes.', 'tiktok');
    expect(cleaned.title).toBe('One pot chicken and rice');
    expect(cleaned.ingredients.map((item) => item.name)).toEqual(['chicken thighs', 'rice', 'broth']);
    expect(cleaned.steps.map((step) => step.text)).toHaveLength(2);
  });

  it('falls back when the first line is a measured ingredient', () => {
    const cleaned = cleanSocialCaption('1 lb ground beef\n1 onion\n2 tbsp soy sauce\n1. Brown the beef.\n2. Add the onion and soy sauce.', 'tiktok');
    expect(cleaned.title).toBe('Recipe from tiktok');
    expect(cleaned.ingredients.map((item) => item.name)).toEqual(['ground beef', 'onion', 'soy sauce']);
    expect(cleaned.steps).toHaveLength(2);
  });

  it('keeps sign-offs and Note or Tip lines out of steps and ingredients', () => {
    const cleaned = cleanSocialCaption('Pasta\nIngredients\n1 cup pasta\nNote: you can add walnuts.\nTip: toast the nuts.\nInstructions\n1. Cook pasta.\nLet me know in the comments if you try it!\nMake sure you save it!', 'tiktok');
    expect(cleaned.steps.map((step) => step.text)).toEqual(['Cook pasta.']);
    expect(cleaned.ingredients.map((item) => item.name)).toEqual(['pasta']);
    expect(cleaned.notes).toMatch(/Note: you can add walnuts/);
    expect(cleaned.notes).toMatch(/Let me know/);
  });

  it('does not corrupt Half and half and strips both square bullet forms', () => {
    const cleaned = cleanSocialCaption('Recipe\nIngredients\nHalf and half, to taste', 'tiktok');
    expect(cleaned.ingredients[0]).toMatchObject({ name: 'Half and half', note: 'to taste' });
    expect(parseIngredientLine('▪ 2 eggs')).toMatchObject({ quantity: '2', name: 'eggs' });
    expect(parseIngredientLine('▪️ 2 eggs')).toMatchObject({ quantity: '2', name: 'eggs' });
  });
});
