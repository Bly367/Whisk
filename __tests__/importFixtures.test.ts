import fs from 'node:fs';
import path from 'node:path';
import { createWebsiteAdapter } from '@/import/adapters/websiteAdapter';
import { draftFromPastedText } from '@/import/parse/pasteText';

const readFixture = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/import', name), 'utf8')) as {
    source: string;
    caption?: string;
    htmlSnippet?: string;
    url: string;
    expect: { titleFragment: string; minIngredients: number; minInstructions: number };
  };

it.each(['website-allrecipes.json', 'website-bbc-good-food.json'])(
  'website fixture %s still extracts a recipe',
  async (name) => {
    const fixture = readFixture(name);
    const result = await createWebsiteAdapter(async () => fixture.htmlSnippet ?? '').import({ url: fixture.url });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.title).toContain(fixture.expect.titleFragment);
      expect(result.draft.ingredients.length).toBeGreaterThanOrEqual(fixture.expect.minIngredients);
      expect(result.draft.instructions.length).toBeGreaterThanOrEqual(fixture.expect.minInstructions);
    }
  },
);

it.each([
  'instagram-reel.json',
  'tiktok-video.json',
  'youtube-short.json',
  'facebook-reel.json',
  'pinterest-pin.json',
])('social caption fixture %s still drafts a recipe', (name) => {
  const fixture = readFixture(name);
  const draft = draftFromPastedText({
    text: fixture.caption ?? '',
    sourceUrl: fixture.url,
    adapterId: 'share-sheet',
    sourceName: fixture.source,
  });
  expect(draft).not.toBeNull();
  expect(draft?.title).toContain(fixture.expect.titleFragment);
  expect(draft?.title.toLowerCase()).not.toMatch(/^(ingredients?|instructions?|directions?|steps?)$/);
  expect(draft?.ingredients.length).toBeGreaterThanOrEqual(fixture.expect.minIngredients);
  expect(draft?.instructions.length).toBeGreaterThanOrEqual(fixture.expect.minInstructions);
});

it('keeps the ingredients-only warning when no steps are present', () => {
  const draft = draftFromPastedText({
    text: 'Simple sauce\n\nIngredients:\n- 1 cup tomatoes\n- 1 tsp salt\n\nDirections:',
    adapterId: 'share-sheet',
  });
  expect(draft?.ingredients.length).toBeGreaterThan(0);
  expect(draft?.warnings.some((warning) => warning.code === 'missing_instructions')).toBe(true);
});
