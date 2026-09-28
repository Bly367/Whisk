import fs from 'node:fs';
import path from 'node:path';

import { runAutoImport } from '@/import/autoImport';
import { parseIngredientLine } from '@/import/parse/ingredients';
import { draftFromPastedText } from '@/import/parse/pasteText';
import { cleanSocialCaption } from '@/import/social/cleanCaption';
import { ingredientsForCookStep } from '@/features/cook/cookIngredients';

const auto = async (caption: string) => {
  const commitImportDraft = jest.fn(() => ({ id: 'saved' }));
  const result = await runAutoImport({ url: 'https://www.tiktok.com/@cook/video/1' }, {
    fetchSocialMeta: async () => ({ source: 'tiktok' as const, canonicalUrl: 'https://www.tiktok.com/@cook/video/1', caption, linkedUrls: [] }),
    videoFromUrl: async () => ({ ok: false as const, reason: 'no_video_url' as const }),
    commitImportDraft,
  });
  return { result, commitImportDraft };
};

describe('caption cleanup round five', () => {
  it('keeps unquantified ingredients in an Ingredients section and saves them', async () => {
    const caption = 'Chicken tinga tacos\nIngredients:\n1 lb chicken thighs\nCilantro, for garnish\n2 limes\nFlaky sea salt\n1 tbsp butter\nCooking spray\n8 corn tortillas\nInstructions:\n1. Cook the chicken.\n2. Fill the tortillas.';
    const cleaned = cleanSocialCaption(caption, 'TikTok');
    expect(cleaned.ingredients).toHaveLength(7);
    expect(cleaned.ingredients.map((item) => item.name)).toEqual(expect.arrayContaining(['Cilantro', 'Flaky sea salt', 'Cooking spray']));
    expect(cleaned.ingredients.every((item) => item.groupName == null)).toBe(true);
    const { result } = await auto(caption);
    expect(result).toEqual(expect.objectContaining({ ok: true }));
    if (result.ok) expect(result.draft.ingredients).toHaveLength(7);
  });

  it('recognizes generic group headers while retaining unquantified group ingredients', () => {
    const glaze = cleanSocialCaption('Sticky honey chicken\n\nFor the glaze\n3 tbsp honey\n2 tbsp soy sauce\nButter, for the pan\nParsley, to serve\n\nInstructions\n1. Sear the chicken until golden.\n2. Add the glaze and reduce for 3 minutes.', 'TikTok');
    expect(glaze.ingredients).toHaveLength(4);
    expect(glaze.ingredients.every((item) => item.groupName === 'For the glaze')).toBe(true);
    const tacos = cleanSocialCaption('Breakfast tacos\nTacos:\n4 tortillas\n4 eggs\nToppings:\nAvocado\nSalsa\nCilantro\nInstructions\n1. Scramble the eggs and fill the tortillas.', 'TikTok');
    expect(tacos.ingredients.filter((item) => item.groupName === 'Tacos')).toHaveLength(2);
    expect(tacos.ingredients.filter((item) => item.groupName === 'Toppings')).toHaveLength(3);
    expect(tacos.ingredients.map((item) => item.name)).not.toContain('Toppings:');
  });

  it('handles emoji section headers and emoji bullets without lone surrogates', () => {
    const cleaned = cleanSocialCaption('Chili oil noodles 🌶️\n🛒 Ingredients\n• 2 bundles noodles\n• 2 tbsp chili crisp\n• 1 tbsp soy sauce\n👩‍🍳 Method\n1️⃣ Boil noodles.\n2️⃣ Toss with chili crisp and soy.', 'TikTok');
    expect(cleaned.ingredients).toHaveLength(3);
    expect(cleaned.ingredients.every((item) => item.groupName == null)).toBe(true);
    expect(cleaned.steps).toHaveLength(2);
    expect(JSON.stringify(cleaned)).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
    expect(parseIngredientLine('👩‍🍳 Method').name).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
    expect(parseIngredientLine('🔸 2 eggs')).toMatchObject({ quantity: '2', name: 'eggs' });
  });

  it('turns unnumbered cooking prose into steps and saves it', async () => {
    const caption = 'Garlic butter shrimp\n1 lb shrimp\n3 tbsp butter\n4 cloves garlic\nMelt the butter in a large pan over medium heat.\nAdd the garlic and shrimp and cook for 2 minutes per side.\nFinish with lemon and parsley.';
    const cleaned = cleanSocialCaption(caption, 'TikTok');
    expect(cleaned.ingredients).toHaveLength(3);
    expect(cleaned.steps.map((step) => step.text)).toEqual(['Melt the butter in a large pan over medium heat.', 'Add the garlic and shrimp and cook for 2 minutes per side.', 'Finish with lemon and parsley.']);
    expect(cleaned.notes).toBe('');
    const { result } = await auto(caption);
    if (result.ok) expect(result.draft.instructions).toHaveLength(3);
    else throw new Error('expected social caption to save');
  });

  it.each(['Follow me for more easy recipes!', 'Follow @cookwithme for more', 'Save this recipe for later!', 'Save for later 📌', 'Share this with someone who needs dinner ideas', 'Turn on notifications for more', 'Comment "SOUP" for the recipe', 'Recipe on my blog'])('drops social CTA variants: %s', async (cta) => {
    const caption = `Soup\nIngredients\n1 cup stock\n2 carrots\nInstructions\n1. Simmer the stock.\n2. Serve the soup.\n${cta}`;
    const cleaned = cleanSocialCaption(caption, 'TikTok');
    expect(`${cleaned.title}\n${cleaned.text}\n${cleaned.ingredients.map((item) => item.name).join('\n')}`).not.toContain(cta);
    const { result } = await auto(caption);
    if (result.ok) expect(result.draft.instructions).toHaveLength(2);
    else throw new Error('expected social caption to save');
  });

  it('preserves parenthetical and preparation ingredient notes', () => {
    const cleaned = cleanSocialCaption('Recipe\nIngredients\nLemon zest or a squeeze of lemon juice (optional, for brightness)\n1 onion, sliced\n2 stalks celery, finely diced (about ½ cup)\nFresh basil, for garnish', 'TikTok');
    expect(cleaned.ingredients).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Lemon zest or a squeeze of lemon juice', note: 'optional, for brightness' }),
      expect.objectContaining({ name: 'onion', note: 'sliced' }),
      expect.objectContaining({ name: 'celery', note: 'finely diced (about ½ cup)' }),
      expect.objectContaining({ name: 'basil', note: 'for garnish' }),
    ]));
  });

  it('keeps Sub labels and joins auto-import notes on separate lines', async () => {
    const caption = fs.readFileSync(path.join(__dirname, 'fixtures/social/tiktok-bulgogi-contents.txt'), 'utf8');
    const { result } = await auto(caption);
    if (result.ok) expect(result.draft.notes).toMatch(/Sub: 1 tbsp water[^\n]*\nImported automatically/);
    else throw new Error('expected bulgogi to save');
  });

  it('does not fetch plain HTTP subtitles and emits the website share stage order', async () => {
    const fetched = jest.fn();
    await runAutoImport({ url: 'https://www.tiktok.com/@cook/video/1' }, {
      fetchSocialMeta: async () => ({ source: 'tiktok' as const, canonicalUrl: 'https://www.tiktok.com/@cook/video/1', linkedUrls: [], transcriptUrl: 'http://v16.tiktokcdn.com/subs.vtt' }),
      fetchText: fetched,
      videoFromUrl: async () => ({ ok: false as const, reason: 'no_video_url' as const }),
    });
    expect(fetched).not.toHaveBeenCalled();
    const stages: string[] = [];
    const result = await runAutoImport({ url: 'https://recipes.example.test/pasta' }, { websiteImport: async () => ({ ok: true as const, draft: { id: 'd', sourceKind: 'share_sheet' as const, sourceUrl: null, sourceName: null, imageUri: null, title: 'Pasta', notes: null, servings: null, prepMinutes: null, cookMinutes: null, ingredients: [{ name: 'pasta', quantity: '1', unit: 'cup' }, { name: 'oil', quantity: '1', unit: 'tbsp' }, { name: 'salt', quantity: '1', unit: 'tsp' }], instructions: [{ id: 's', position: 0, text: 'Cook pasta.' }], confidence: { title: 'high', ingredients: 'high', instructions: 'high' }, warnings: [], sourceEvidence: '', adapterId: 'test', createdAt: '' } }), commitImportDraft: () => ({ id: 'web' }) }, (stage) => stages.push(stage));
    expect(result.ok).toBe(true);
    expect(stages).toEqual(['receiving', 'following_link', 'saving', 'saved']);
  });

  it('matches -es plurals in cook ingredients', () => {
    expect(ingredientsForCookStep([{ name: 'tomatoes' }, { name: 'potatoes' }], 'Add the tomato and potato.').map((item) => item.name)).toEqual(['tomatoes', 'potatoes']);
  });

  it('keeps the non-social paste parser literal output', () => {
    const draft = draftFromPastedText({ text: 'Garlic pasta\nIngredients:\n2 cups pasta\n1 tbsp oil\n2 large eggs\nInstructions:\nBoil the pasta.', adapterId: 'test' });
    expect(draft?.ingredients.map(({ quantity, unit, name }) => [quantity, unit, name])).toEqual([
      ['2', 'cups', 'pasta'], ['1', 'tbsp', 'oil'], ['2', null, 'large eggs'],
    ]);
    expect(draft?.instructions.map((step) => step.text)).toEqual(['Boil the pasta.']);
  });

  it('does not fetch social metadata for a local-file share', async () => {
    const fetchSocialMeta = jest.fn();
    await runAutoImport({ videoPath: '/cache/video.mp4' }, {
      fetchSocialMeta,
      transcribeVideo: async () => ({ ok: false as const, error: { code: 'transcription_failed' as const, message: 'fixture' } }),
    });
    expect(fetchSocialMeta).not.toHaveBeenCalled();
  });
});
