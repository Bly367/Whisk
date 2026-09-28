import { draftFromTranscript } from '@/import/parse/transcript';
import fs from 'node:fs';
import path from 'node:path';

const fixture = (name: string) =>
  fs.readFileSync(path.join(__dirname, 'fixtures/transcripts', name), 'utf8');

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

it.each(['tuscan.txt', 'noodles.txt', 'cookies.txt'])('parses voice-over fixture %s', (name) => {
  const draft = draftFromTranscript({ text: fixture(name), sourceName: 'TikTok' });
  expect(draft?.ingredients.length).toBeGreaterThanOrEqual(3);
  expect(draft?.instructions.length).toBeGreaterThanOrEqual(2);
});

describe('unseen voice-over transcripts', () => {
  it('extracts shakshuka ingredients without kitchen or timing junk', () => {
    const draft = draftFromTranscript({ text: fixture('shakshuka.txt') });
    expect(draft).not.toBeNull();
    expect(draft?.ingredients.length).toBeGreaterThanOrEqual(6);
    expect(draft?.instructions.length).toBeGreaterThanOrEqual(4);
    expect(draft?.ingredients.map((item) => [item.name, item.quantity])).toEqual(
      expect.arrayContaining([
        ['olive oil', null],
        ['onion', '1'],
        ['bell pepper', '1'],
        ['garlic', '3'],
        ['cumin', '1'],
        ['smoked paprika', '1'],
        ['crushed tomatoes', '28'],
        ['eggs', '4'],
      ]),
    );
    expect(draft?.ingredients.map((item) => item.name)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/minutes?|degrees|pan|bowl|sheet|tray|lid|oven|^of\s/i)]),
    );
  });

  it('extracts salmon sauce quantities and avoids process nouns', () => {
    const draft = draftFromTranscript({ text: fixture('salmon.txt') });
    expect(draft).not.toBeNull();
    expect(draft?.ingredients.length).toBeGreaterThanOrEqual(6);
    expect(draft?.instructions.length).toBeGreaterThanOrEqual(4);
    expect(draft?.ingredients.map((item) => [item.name, item.quantity])).toEqual(
      expect.arrayContaining([
        ['soy sauce', '0.25'],
        ['honey', '2'],
        ['rice vinegar', '1'],
        ['ginger', '1'],
        ['garlic', '1'],
        ['salmon fillets', '2'],
      ]),
    );
    expect(draft?.ingredients.map((item) => item.name)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/minutes?|degrees|pan|bowl|sheet|tray|lid|oven|^of\s/i)]),
    );
  });
});
