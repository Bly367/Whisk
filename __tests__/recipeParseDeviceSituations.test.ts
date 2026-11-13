import fs from 'node:fs';
import path from 'node:path';

import { parseRecipeText } from '@/import/parse/parseRecipeText';
import { FOUNDATION_TIMEOUT_MS } from '@/import/parse/parseRecipeText';
import { parseRecipeWithOpenAI } from '@/import/parse/openaiParse';
import type { ParsedRecipe } from '@/import/parse/structured';

const fixture = (name: string) =>
  fs.readFileSync(path.join(__dirname, 'fixtures/social', name), 'utf8');

const unavailableFoundation = async () => ({ ok: false as const, reason: 'unavailable' as const });
const noKey = async () => null;

const SECRET_KEY = 'sk-device-test-SECRET';

function quantifiedIngredients(draft: { ingredients: { quantity?: string | null; unit?: string | null; name: string }[] }) {
  return draft.ingredients.filter((item) => item.name.trim().length >= 2 && (item.quantity || item.unit));
}

const thinFoundationRecipe = (title = 'Soup'): ParsedRecipe => ({
  title,
  ingredients: [{ name: 'flour' }, { name: 'sugar' }, { name: 'eggs' }],
  steps: ['Mix everything.', 'Bake.'],
  parser: 'foundation',
});

it('uses heuristic when Foundation is unavailable and there is no OpenAI key', async () => {
  const text = fixture('tiktok-tortellini-contents.txt');
  const draft = await parseRecipeText(text, {
    sourceName: 'TikTok',
    heuristicKind: 'social',
    foundation: unavailableFoundation,
    readApiKey: noKey,
  });
  expect(draft?.adapterId).toBe('heuristic');
  expect(draft?.ingredients.length ?? 0).toBeGreaterThanOrEqual(10);
  expect(quantifiedIngredients(draft!).length).toBeGreaterThanOrEqual(5);
});

it('falls through to heuristic when Foundation throws', async () => {
  const foundation = jest.fn(async () => {
    throw new Error('FoundationModels crash');
  });
  const draft = await parseRecipeText('2 cups flour\n1 cup sugar\nMix and bake 25 minutes.', {
    foundation,
    readApiKey: noKey,
  });
  expect(draft?.adapterId).toBe('heuristic');
  expect(quantifiedIngredients(draft!).length).toBeGreaterThanOrEqual(1);
  expect(draft?.ingredients.length).toBeGreaterThan(0);
});

it('stops waiting after the 12s Foundation timeout and returns heuristic', async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  const foundation = jest.fn(() => new Promise<{ ok: true; recipe: ParsedRecipe }>(() => {}));
  const pending = parseRecipeText('1 cup flour. Mix well.', {
    foundation,
    readApiKey: noKey,
    heuristic: () => ({
      title: 'Flour',
      ingredients: [{ quantity: '1', unit: 'cup', name: 'flour' }],
      steps: ['Mix well.'],
      parser: 'heuristic',
    }),
  });
  await jest.advanceTimersByTimeAsync(FOUNDATION_TIMEOUT_MS);
  const draft = await pending;
  jest.useRealTimers();
  expect(draft?.adapterId).toBe('heuristic');
  expect(foundation).toHaveBeenCalledTimes(1);
});

it('prefers quantified heuristic over a thin Foundation draft on a social caption', async () => {
  const text = fixture('tiktok-tortellini-contents.txt');
  const draft = await parseRecipeText(text, {
    sourceName: 'TikTok',
    heuristicKind: 'social',
    foundation: async () => ({ ok: true as const, recipe: thinFoundationRecipe('Tortellini') }),
    readApiKey: noKey,
  });
  expect(draft?.adapterId).toBe('heuristic');
  expect(quantifiedIngredients(draft!).length).toBeGreaterThanOrEqual(5);
  expect(draft?.ingredients.map((item) => item.name)).not.toEqual(['flour', 'sugar', 'eggs']);
});

it('prefers quantified heuristic over a thin Foundation draft on a transcript plus caption', async () => {
  const transcript = 'Stir everything together. Bake for twenty minutes. Serve warm.';
  const sharedText = 'Lemon cake. Mix 2 cups of flour with 1 cup of sugar. Add 3 eggs.';
  const draft = await parseRecipeText(transcript, {
    heuristicKind: 'transcript',
    sharedText,
    foundation: async () => ({ ok: true as const, recipe: thinFoundationRecipe('Qualities') }),
    readApiKey: noKey,
  });
  expect(draft?.adapterId).toBe('heuristic');
  expect(quantifiedIngredients(draft!).length).toBeGreaterThanOrEqual(1);
  expect(draft?.ingredients).toEqual(expect.arrayContaining([expect.objectContaining({ name: expect.stringMatching(/sugar|flour/i) })]));
});

it('rejects ungrounded Foundation ingredients and keeps heuristic output', async () => {
  const source = '1 cup flour\n2 eggs\nMix and bake.';
  const draft = await parseRecipeText(source, {
    foundation: async () => ({
      ok: true as const,
      recipe: {
        title: 'Bad',
        ingredients: [{ name: 'butter' }, { name: 'vanilla extract' }],
        steps: ['Mix'],
        parser: 'foundation',
      },
    }),
    readApiKey: noKey,
    heuristic: () => ({
      title: 'Good',
      ingredients: [{ quantity: '1', unit: 'cup', name: 'flour' }, { quantity: '2', name: 'eggs' }],
      steps: ['Mix and bake.'],
      parser: 'heuristic',
    }),
  });
  expect(draft?.adapterId).toBe('heuristic');
  expect(draft?.ingredients.map((item) => item.name)).not.toContain('butter');
  expect(draft?.ingredients.map((item) => item.name)).not.toContain('vanilla extract');
});

describe('OpenAI tier fallbacks with key present', () => {
  const baseText = '1 cup flour\n2 eggs\nMix and bake 20 minutes.';
  const openAIOpts = {
    foundation: unavailableFoundation,
    readApiKey: async () => SECRET_KEY,
  };
  const assertHeuristicFallback = (draft: Awaited<ReturnType<typeof parseRecipeText>>) => {
    expect(draft?.adapterId).toBe('heuristic');
    expect(draft?.ingredients.length).toBeGreaterThan(0);
    expect(JSON.stringify(draft)).not.toContain(SECRET_KEY);
  };

  it.each([
    ['401', async () => ({ ok: false, status: 401 }) as Response],
    ['429', async () => ({ ok: false, status: 429 }) as Response],
  ])('HTTP %s falls back to heuristic without exposing the key', async (_label, fetchImpl) => {
    const fetchMock = jest.fn(fetchImpl);
    const draft = await parseRecipeText(baseText, {
      ...openAIOpts,
      openAI: (text, opts) => parseRecipeWithOpenAI(text, { ...opts, fetch: fetchMock }),
    });
    assertHeuristicFallback(draft);
  });

  it('network errors and malformed JSON fall back cleanly', async () => {
    const networkDraft = await parseRecipeText(baseText, {
      ...openAIOpts,
      openAI: (text, opts) =>
        parseRecipeWithOpenAI(text, {
          ...opts,
          fetch: async () => {
            throw new Error(`socket reset ${SECRET_KEY}`);
          },
        }),
    });
    assertHeuristicFallback(networkDraft);

    const badJsonDraft = await parseRecipeText(baseText, {
      ...openAIOpts,
      openAI: (text, opts) =>
        parseRecipeWithOpenAI(text, {
          ...opts,
          fetch: async () =>
            ({
              ok: true,
              status: 200,
              json: async () => ({ choices: [{ message: { content: '{not json' } }] }),
            }) as Response,
        }),
    });
    assertHeuristicFallback(badJsonDraft);
  });

  it('aborts a hung OpenAI request and falls back to heuristic', async () => {
    const draft = await parseRecipeText(baseText, {
      ...openAIOpts,
      openAI: (text, opts) =>
        parseRecipeWithOpenAI(text, {
          ...opts,
          timeoutMs: 5,
          fetch: (_input, init) => {
            const signal = init?.signal;
            return new Promise<Response>((_resolve, reject) => {
              signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
            });
          },
        }),
    });
    assertHeuristicFallback(draft);
  });
});

it('skips LLM parsing on the third attempt in the same import budget', async () => {
  const budget = { remaining: 2, deadline: undefined as number | undefined };
  const foundation = jest.fn(unavailableFoundation);
  const openAI = jest.fn(async () => ({ ok: false as const, reason: 'network' as const }));
  const opts = {
    budget,
    foundation,
    openAI,
    readApiKey: async () => SECRET_KEY,
    heuristic: () => ({
      title: 'T',
      ingredients: [{ quantity: '1', unit: 'cup', name: 'flour' }],
      steps: ['Mix'],
      parser: 'heuristic' as const,
    }),
  };
  await parseRecipeText('1 cup flour.', opts);
  await parseRecipeText('2 eggs.', opts);
  const third = await parseRecipeText('3 tbsp butter.', opts);
  expect(foundation).toHaveBeenCalledTimes(2);
  expect(openAI).toHaveBeenCalledTimes(2);
  expect(third?.adapterId).toBe('heuristic');
  expect(budget.remaining).toBe(0);
});

it('handles emoji-heavy captions and empty whitespace-only input', async () => {
  const emojiCaption = `🍜 Ramen rapide 🇯🇵\n\n1 tbsp huile de sésame 🫒\n2 gousses ail émincées\n200 g nouilles\nMélanger et servir chaud 🔥`;
  const social = await parseRecipeText(emojiCaption, {
    sourceName: 'TikTok',
    heuristicKind: 'social',
    foundation: unavailableFoundation,
    readApiKey: noKey,
  });
  expect(social?.adapterId).toBe('heuristic');
  expect(social?.ingredients.length).toBeGreaterThan(0);
  expect(quantifiedIngredients(social!).length).toBeGreaterThanOrEqual(2);

  expect(await parseRecipeText('', { foundation: unavailableFoundation, readApiKey: noKey })).toBeNull();
  expect(await parseRecipeText('   \n\t  ', { foundation: unavailableFoundation, readApiKey: noKey })).toBeNull();
});
