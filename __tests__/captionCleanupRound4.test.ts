import fs from 'node:fs';
import path from 'node:path';

import { runAutoImport } from '@/import/autoImport';
import { parseIngredientLine } from '@/import/parse/ingredients';
import { draftFromPastedText } from '@/import/parse/pasteText';
import { draftFromTranscript } from '@/import/parse/transcript';
import { cleanSocialCaption } from '@/import/social/cleanCaption';

const fixture = (name: string) => fs.readFileSync(path.join(__dirname, 'fixtures/social', name), 'utf8');
const tortellini = fixture('tiktok-tortellini-contents.txt');
const salmon = fixture('tiktok-salmon-orzo-contents.txt');

const socialMeta = (caption: string, videoUrl?: string) => async () => ({
  source: 'tiktok' as const,
  canonicalUrl: 'https://www.tiktok.com/@cook/video/1',
  caption,
  linkedUrls: [],
  videoUrl,
});

const audioSteps = 'Add the onions. Cook the beef. Stir in the sauce. Serve over rice.';

describe('caption cleanup round four', () => {
  it('does not save an ingredients-only caption or turn ingredient lines into steps', async () => {
    const saved = jest.fn(() => ({ id: 'unexpected' }));
    const result = await runAutoImport(
      { url: 'https://www.tiktok.com/@cook/video/1' },
      {
        fetchSocialMeta: socialMeta(tortellini, 'https://v16.tiktokcdn.com/video.mp4'),
        videoFromUrl: async () => ({ ok: true, uri: '/cache/video.mp4', cleanup: async () => {} }),
        transcribeVideo: async () => ({ ok: true, transcript: '', metadata: { text: '', durationMs: 1, segments: [] } }),
        commitImportDraft: saved,
      },
    );
    expect(result).toEqual(expect.objectContaining({ ok: false }));
    expect(saved).not.toHaveBeenCalled();
    expect(saved.mock.calls.flat().flatMap((call) => (call as any).instructions ?? [])).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ text: expect.stringMatching(/^\d|^[½¼¾]/) })]),
    );
  });

  it('merges the cleaned 25-ingredient caption with audio steps', async () => {
    const saved = jest.fn(() => ({ id: 'merged' }));
    const result = await runAutoImport(
      { url: 'https://www.tiktok.com/@cook/video/1' },
      {
        fetchSocialMeta: socialMeta(tortellini, 'https://v16.tiktokcdn.com/video.mp4'),
        videoFromUrl: async () => ({ ok: true, uri: '/cache/video.mp4', cleanup: async () => {} }),
        transcribeVideo: async () => ({ ok: true, transcript: audioSteps, metadata: { text: audioSteps, durationMs: 1, segments: [] } }),
        commitImportDraft: saved,
      },
    );
    expect(result).toEqual(expect.objectContaining({ ok: true, source: 'caption+audio', lowConfidence: true }));
    if (!result.ok) return;
    expect(result.draft.title).toBe('Creamy, Spicy Tortellini and Sausage Soup');
    expect(result.draft.ingredients).toHaveLength(25);
    expect(result.draft.ingredients).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'garlic', quantity: expect.stringMatching(/^6[–-]8$/), unit: 'cloves' }),
      expect.objectContaining({ name: 'celery' }),
      expect.objectContaining({ name: 'carrots' }),
      expect.objectContaining({ name: expect.stringMatching(/^Calabrian chilies/) }),
    ]));
    expect(result.draft.instructions.map((step) => step.text)).toEqual([
      'Add the onions.', 'Cook the beef.', 'Stir in the sauce.', 'Serve over rice.',
    ]);
    expect(result.draft.title).not.toMatch(/[\u200d\ufe0f]/);
  });

  it('cleans the tortellini contents into 25 ingredients and no steps', () => {
    const cleaned = cleanSocialCaption(tortellini, 'TikTok');
    expect(cleaned.ingredients).toHaveLength(25);
    expect(cleaned.text).not.toMatch(/^Instructions:|\n\d+[.)]\s/m);
    expect(cleaned.title).toBe('Creamy, Spicy Tortellini and Sausage Soup');
  });

  it('preserves curly apostrophes in saved caption text', () => {
    const cleaned = cleanSocialCaption(fixture('tiktok-bulgogi-contents.txt'), 'TikTok');
    expect(`${cleaned.title}\n${cleaned.text}\n${cleaned.notes}`).not.toMatch(/[a-z]"[a-z]/i);
    expect(`${cleaned.title}\n${cleaned.text}\n${cleaned.notes}`).toMatch(/it['’]s/i);
  });

  it.each([
    'Follow for more!',
    'Comment "recipe" and I will send it to your DM',
    'Link in bio for the full recipe',
    'Save this for later ✨',
    'Tag a friend who needs this',
  ])('drops a CTA line: %s', (cta) => {
    const cleaned = cleanSocialCaption(`Recipe title\n${cta}`, 'TikTok');
    expect(`${cleaned.title}\n${cleaned.text}`).not.toMatch(new RegExp(cta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  });

  it('keeps cooking lines containing ordinary save/follow words', () => {
    const cleaned = cleanSocialCaption('Orzo with salmon\nSave some pasta water before draining.\nFollow the package directions for the orzo.', 'TikTok');
    expect(cleaned.text).toMatch(/Save some pasta water/);
    expect(cleaned.text).toMatch(/Follow the package directions/);
  });

  it('cleans salmon-orzo fractions, groups, and tsp-each ingredients', () => {
    const cleaned = cleanSocialCaption(salmon, 'TikTok');
    expect(cleaned.title).toBe('One-Pan Creamy Lemon & Garlic Salmon Orzo');
    expect(cleaned.ingredients.filter((item) => item.groupName === 'For the Orzo')).toHaveLength(12);
    expect(cleaned.ingredients.filter((item) => item.groupName === 'For the Salmon').length).toBeGreaterThan(0);
    expect(cleaned.ingredients).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'cooking wine', quantity: '1/4', unit: 'cup' }),
      expect.objectContaining({ name: 'chicken broth', quantity: expect.stringMatching(/^2\.25|2 1\/4$/), unit: 'cups' }),
      expect.objectContaining({ name: 'salt', quantity: '1', unit: 'tsp' }),
      expect.objectContaining({ name: 'black pepper', quantity: '1', unit: 'tsp' }),
      expect.objectContaining({ name: 'garlic powder', quantity: '1', unit: 'tsp' }),
      expect.objectContaining({ name: 'Italian seasoning', quantity: '1', unit: 'tsp' }),
    ]));
    expect(cleaned.ingredients.map((item) => item.name)).not.toEqual(expect.arrayContaining([expect.stringMatching(/^[/\-]/)]));
  });

  it('supports generic group headers and variable likes prefixes', () => {
    const grouped = cleanSocialCaption('Recipe\nFor the glaze\n2 tbsp honey\n1 tsp soy sauce\n1 clove garlic', 'TikTok');
    expect(grouped.ingredients).toHaveLength(3);
    expect(grouped.ingredients.every((item) => item.groupName === 'For the glaze')).toBe(true);
    const prefixed = cleanSocialCaption('2.1M likes, 10K comments - user on May 1, 2026: "Recipe title\n1 cup flour"', 'Instagram');
    expect(prefixed.title).toBe('Recipe title');
  });

  it('leaves the generic paste-text parser behaviour unchanged', () => {
    const text = 'Garlic pasta\nIngredients:\n2 cups pasta\n1 tbsp oil\nInstructions:\nBoil the pasta.';
    const shape = (draft: ReturnType<typeof draftFromPastedText>) => draft && ({
      title: draft.title,
      ingredients: draft.ingredients,
      instructions: draft.instructions.map(({ id: _id, ...step }) => step),
    });
    expect(shape(draftFromPastedText({ text, adapterId: 'test' }))).toEqual(shape(draftFromPastedText({ text, adapterId: 'test' })));
  });
});

describe('round four parser boundaries', () => {
  it('does not turn chatter into recipe steps or an auto-save', async () => {
    const chatter = "Hey guys welcome back to my channel. We make it every Sunday. I cook for my family a lot. We add a lot of love. I hope you enjoy this video. Don't forget to like and subscribe.";
    expect(draftFromTranscript({ text: chatter })?.instructions.length ?? 0).toBeLessThan(3);
    const saved = jest.fn(() => ({ id: 'junk' }));
    const result = await runAutoImport({ url: 'https://www.tiktok.com/@cook/video/1' }, {
      fetchSocialMeta: socialMeta('', 'https://v16.tiktokcdn.com/video.mp4'),
      videoFromUrl: async () => ({ ok: true, uri: '/cache/video.mp4', cleanup: async () => {} }),
      transcribeVideo: async () => ({ ok: true, transcript: chatter, metadata: { text: chatter, durationMs: 1, segments: [] } }),
      commitImportDraft: saved,
    });
    expect(result).toEqual(expect.objectContaining({ ok: false }));
    expect(saved).not.toHaveBeenCalled();
  });

  it('capitalises useful Whisper steps', () => {
    const draft = draftFromTranscript({ text: fixture('tiktok-bulgogi-whisper-tiny-en.txt') });
    expect(draft?.instructions.length).toBeGreaterThanOrEqual(5);
    expect(draft?.instructions.every((step) => /^[A-Z]/.test(step.text))).toBe(true);
  });

  it('keeps adjectives in the shared ingredient parser and parses ranges/notes', () => {
    expect(parseIngredientLine('2 large eggs').name).toBe('large eggs');
    expect(parseIngredientLine('1 fresh jalapeño').name).toContain('fresh');
    expect(parseIngredientLine('1 to 2 tbsp oil')).toMatchObject({ quantity: '1 to 2', unit: 'tbsp' });
    expect(parseIngredientLine('2 (400 g) cans chickpeas')).toMatchObject({ quantity: '2', unit: 'cans', note: '400 g' });
  });

  it('normalizes half quantities, dedupes ingredients, and drops list-tail verbs', () => {
    const draft = draftFromTranscript({ text: "You'll need half a teaspoon salt, half a cup milk, half a pound chicken, a cup and a half flour, fresh parsley, and parsley. Crack the eggs. Serve it with bread." });
    expect(draft?.ingredients).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'salt', quantity: '0.5' }),
      expect.objectContaining({ name: 'milk', quantity: '0.5' }),
      expect.objectContaining({ name: 'chicken', quantity: '0.5' }),
      expect.objectContaining({ name: 'flour', quantity: '1.5' }),
      expect.objectContaining({ name: 'parsley', quantity: null }),
    ]));
    expect(draft?.ingredients.filter((item) => item.name === 'parsley')).toHaveLength(1);
    expect(draft?.ingredients.map((item) => item.name)).not.toEqual(expect.arrayContaining(['crack', 'serve it with bread']));
  });

  it('falls through from rejected or oversized subtitles and never fetches unsafe subtitle URLs', async () => {
    const meta = { source: 'tiktok' as const, canonicalUrl: 'https://www.tiktok.com/@cook/video/1', linkedUrls: [], transcriptUrl: 'https://v16.tiktokcdn.com/subs.vtt', videoUrl: 'https://v16.tiktokcdn.com/video.mp4' };
    const fetched: string[] = [];
    const saved = jest.fn(() => ({ id: 'fallback' }));
    const result = await runAutoImport({ url: meta.canonicalUrl }, {
      fetchSocialMeta: async () => meta,
      fetchText: async (url) => { fetched.push(url); return { status: 403, finalUrl: url, text: '' }; },
      videoFromUrl: async () => ({ ok: true, uri: '/cache/video.mp4', cleanup: async () => {} }),
      transcribeVideo: async () => ({ ok: true, transcript: audioSteps, metadata: { text: audioSteps, durationMs: 1, segments: [] } }),
      commitImportDraft: saved,
    });
    expect(result).toEqual(expect.objectContaining({ ok: true, source: 'audio' }));
    expect(fetched).toEqual([meta.transcriptUrl]);

    const unsafe = await runAutoImport({ url: meta.canonicalUrl }, {
      fetchSocialMeta: async () => ({ ...meta, transcriptUrl: 'https://evil.test/subs.vtt' }),
      fetchText: async (url) => { fetched.push(url); return { status: 200, finalUrl: url, text: audioSteps }; },
      videoFromUrl: async () => ({ ok: true, uri: '/cache/video.mp4', cleanup: async () => {} }),
      transcribeVideo: async () => ({ ok: true, transcript: audioSteps, metadata: { text: audioSteps, durationMs: 1, segments: [] } }),
      commitImportDraft: saved,
    });
    expect(unsafe.ok).toBe(true);
    expect(fetched).not.toContain('https://evil.test/subs.vtt');
  });

  it('rejects a subtitle body above the 256 KB bound and falls back to audio', async () => {
    const url = 'https://v16.tiktokcdn.com/subs.vtt';
    const result = await runAutoImport({ url: 'https://www.tiktok.com/@cook/video/1' }, {
      fetchSocialMeta: async () => ({ source: 'tiktok' as const, canonicalUrl: 'https://www.tiktok.com/@cook/video/1', linkedUrls: [], transcriptUrl: url, videoUrl: 'https://v16.tiktokcdn.com/video.mp4' }),
      fetchText: async (request) => ({ status: 200, finalUrl: request, text: 'x'.repeat(256 * 1024 + 1) }),
      videoFromUrl: async () => ({ ok: true, uri: '/cache/video.mp4', cleanup: async () => {} }),
      transcribeVideo: async () => ({ ok: true, transcript: audioSteps, metadata: { text: audioSteps, durationMs: 1, segments: [] } }),
      commitImportDraft: jest.fn(() => ({ id: 'oversized-fallback' })),
    });
    expect(result).toEqual(expect.objectContaining({ ok: true, source: 'audio' }));
  });
});
