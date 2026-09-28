import { draftFromTranscript } from '@/import/parse/transcript';

it('parses a one-paragraph voice-over into ingredients, steps, and a title', () => {
  const draft = draftFromTranscript({
    text: "I'm making garlic butter pasta. You'll need 200 grams spaghetti, two tablespoons butter, three cloves garlic, and a quarter cup parmesan. Boil the pasta. Melt the butter. Toss everything together.",
    sourceName: 'TikTok',
  });
  expect(draft?.title).toBe('Garlic butter pasta');
  expect(draft?.ingredients.map((item) => item.name)).toEqual(
    expect.arrayContaining(['spaghetti', 'butter', 'garlic', 'parmesan']),
  );
  expect(draft?.instructions.map((step) => step.text)).toEqual(
    expect.arrayContaining(['Boil the pasta.', 'Melt the butter.', 'Toss everything together.']),
  );
});

it('returns null for filler-only speech', () => {
  expect(draftFromTranscript({ text: 'Hey guys, follow for more, comment RECIPE!' })).toBeNull();
});
