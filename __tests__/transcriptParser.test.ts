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

it('understands going-to speech and discourse before imperatives', () => {
  const text = "I'm going to add my onions. Then we're going to add in our ground beef. Now I am going to stir it. Finally, I will serve it over rice.";
  const draft = draftFromTranscript({ text });
    expect(draft?.instructions.map((step) => step.text)).toEqual(
    expect.arrayContaining(['Add my onions.', 'Add in our ground beef.', 'Stir it.', 'Serve it over rice.']),
  );
});

it.each([
  "I want to chop the herbs.",
  "Let's mix the sauce.",
  "We need to pour it in.",
  "After one minute, we're going to add the garlic.",
  "I just stir everything together.",
])('accepts a new speech lead-in: %s', (text) => {
  expect(draftFromTranscript({ text })?.instructions.length).toBeGreaterThan(0);
});

it('parses the Whisper bulgogi transcript into useful steps', () => {
  const draft = draftFromTranscript({ text: fs.readFileSync(path.join(__dirname, 'fixtures/social/tiktok-bulgogi-whisper-tiny-en.txt'), 'utf8') });
  expect(draft?.instructions.length).toBeGreaterThanOrEqual(4);
  expect(draft?.instructions.map((step) => step.text.toLowerCase())).toEqual(
    expect.arrayContaining([
      expect.stringContaining('add my onions'),
      expect.stringContaining('add in our ground beef'),
      expect.stringContaining('stir it'),
      expect.stringContaining('serve my bologue'),
    ]),
  );
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
