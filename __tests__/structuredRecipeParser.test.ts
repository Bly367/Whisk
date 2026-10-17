import fs from 'node:fs';
import path from 'node:path';

import * as SecureStore from 'expo-secure-store';

import {
  groundParsedRecipe,
  parsedRecipeToDraft,
  suitableTitleFromText,
  type ParsedRecipe,
} from '@/import/parse/structured';
import {
  parseRecipeText,
  type ParseRecipeTextOptions,
} from '@/import/parse/parseRecipeText';
import {
  OPENAI_RECIPE_MODEL,
  parseRecipeWithOpenAI,
} from '@/import/parse/openaiParse';
import {
  OPENAI_API_KEY_STORAGE_KEY,
  clearOpenAIKey,
  readOpenAIKey,
  writeOpenAIKey,
} from '@/import/parse/openaiKey';
const fixture = (name: string) =>
  fs.readFileSync(path.join(__dirname, 'fixtures/social', name), 'utf8');

const recipe = (parser: ParsedRecipe['parser'] = 'heuristic'): ParsedRecipe => ({
  title: 'Flour skillet',
  ingredients: [
    { quantity: '1', unit: 'cup', name: 'flour' },
    { quantity: '1', unit: 'cup', name: 'moon dust' },
  ],
  steps: ['Mix the flour.'],
  parser,
});

const unavailableFoundation = async () => ({ ok: false as const, reason: 'unavailable' as const });
const noKey = async () => null;

it('grounds ingredients to source text and rejects an empty grounded recipe', () => {
  expect(groundParsedRecipe(recipe(), 'Mix one cup of flour in a bowl.')).toEqual(
    expect.objectContaining({
      ingredients: [expect.objectContaining({ name: 'flour' })],
      steps: ['Mix the flour.'],
    }),
  );
  expect(
    groundParsedRecipe(
      { ...recipe(), ingredients: [{ name: 'moon dust' }], steps: [] },
      'Mix one cup of flour in a bowl.',
    ),
  ).toBeNull();
});

it('selects Foundation first, then OpenAI, then the heuristic fallback', async () => {
  const foundation = jest.fn(async () => ({ ok: true as const, recipe: recipe('foundation') }));
  const openAI = jest.fn(async () => ({ ok: true as const, recipe: recipe('openai') }));
  const heuristic = jest.fn(() => recipe('heuristic'));
  const first = await parseRecipeText('1 cup flour. Mix the flour.', {
    foundation,
    openAI,
    readApiKey: async () => 'sk-test',
    heuristic,
  });
  expect(first?.adapterId).toBe('foundation');
  expect(openAI).not.toHaveBeenCalled();
  expect(heuristic).not.toHaveBeenCalled();

  const secondOpenAI = jest.fn(async () => ({ ok: true as const, recipe: recipe('openai') }));
  const second = await parseRecipeText('1 cup flour. Mix the flour.', {
    foundation: unavailableFoundation,
    openAI: secondOpenAI,
    readApiKey: async () => 'sk-test',
    heuristic,
  });
  expect(second?.adapterId).toBe('openai');
  expect(secondOpenAI).toHaveBeenCalledWith('1 cup flour. Mix the flour.', expect.objectContaining({ apiKey: 'sk-test' }));

  const fallback = await parseRecipeText('1 cup flour. Mix the flour.', {
    foundation: unavailableFoundation,
    openAI: async () => ({ ok: false as const, reason: 'network' as const }),
    readApiKey: async () => 'sk-test',
    heuristic,
  });
  expect(fallback?.adapterId).toBe('heuristic');
  expect(heuristic).toHaveBeenCalled();
});

it('parses OpenAI JSON with a strict schema and never exposes the API key on failure', async () => {
  const apiKey = 'sk-test-secret';
  const fetchMock = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    expect(init?.headers).toEqual(
      expect.objectContaining({ Authorization: `Bearer ${apiKey}` }),
    );
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe(OPENAI_RECIPE_MODEL);
    expect(body.response_format.type).toBe('json_schema');
    expect(body.response_format.json_schema.strict).toBe(true);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ title: 'Soup', ingredients: [{ quantity: '1', unit: 'cup', name: 'flour', note: null }], steps: ['Mix flour.'] }) } }],
      }),
    } as Response;
  });
  await expect(parseRecipeWithOpenAI('1 cup flour. Mix flour.', { apiKey, fetch: fetchMock })).resolves.toEqual({
    ok: true,
    recipe: {
      title: 'Soup',
      ingredients: [{ quantity: '1', unit: 'cup', name: 'flour', note: null }],
      steps: ['Mix flour.'],
      parser: 'openai',
    },
  });

  const http = await parseRecipeWithOpenAI('source', {
    apiKey,
    fetch: async () => ({ ok: false, status: 401 }) as Response,
  });
  expect(http).toEqual({ ok: false, reason: 'http' });
  const network = await parseRecipeWithOpenAI('source', {
    apiKey,
    fetch: async () => {
      throw new Error(`network failure ${apiKey}`);
    },
  });
  expect(network).toEqual({ ok: false, reason: 'network' });
  expect(JSON.stringify(network)).not.toContain(apiKey);
});

it('stores the OpenAI key only through SecureStore and supports clear', async () => {
  const secure = SecureStore as typeof SecureStore & {
    __resetSecureStoreMock?: () => void;
  };
  secure.__resetSecureStoreMock?.();
  (SecureStore.setItemAsync as jest.Mock).mockClear();
  (SecureStore.deleteItemAsync as jest.Mock).mockClear();

  await writeOpenAIKey('  sk-local-only  ');
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(OPENAI_API_KEY_STORAGE_KEY, 'sk-local-only');
  expect(await readOpenAIKey()).toBe('sk-local-only');
  await clearOpenAIKey();
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(OPENAI_API_KEY_STORAGE_KEY);
  expect(await readOpenAIKey()).toBeNull();

  const source = fs.readFileSync(path.join(__dirname, '..', 'import', 'parse', 'openaiKey.ts'), 'utf8');
  expect(source).not.toContain('AsyncStorage');
});

it('prefers a suitable caption title over a junk transcript title', async () => {
  const options: ParseRecipeTextOptions = {
    heuristicKind: 'transcript',
    sharedText: 'Smitten Kitchen creamy tomato soup',
    foundation: unavailableFoundation,
    readApiKey: noKey,
    heuristic: () => ({ ...recipe(), title: 'Qualities' }),
  };
  const result = await parseRecipeText('Best Qualities. Add flour.', options);
  expect(result?.title).toBe('Smitten Kitchen creamy tomato soup');
});

it('keeps the tortellini caption useful offline through the heuristic parser', async () => {
  const result = await parseRecipeText(fixture('tiktok-tortellini-contents.txt'), {
    sourceName: 'TikTok',
    heuristicKind: 'social',
    foundation: unavailableFoundation,
    readApiKey: noKey,
    openAI: async () => ({ ok: false as const, reason: 'unavailable' as const }),
  });
  expect(result?.adapterId).toBe('heuristic');
  expect(result?.ingredients.length ?? 0).toBeGreaterThanOrEqual(20);
  expect(result?.title).toBe('Creamy, Spicy Tortellini and Sausage Soup');
});

it('fails safely through unavailable LLM tiers and only accepts grounded model ingredients', async () => {
  const text = fixture('tiktok-tortellini-contents.txt');
  await expect(parseRecipeText(text, {
    sourceName: 'TikTok', heuristicKind: 'social', foundation: unavailableFoundation,
    readApiKey: async () => { throw new Error('keychain'); },
  })).resolves.toEqual(expect.objectContaining({ ingredients: expect.arrayContaining([expect.objectContaining({ name: 'cheese tortellini' })]) }));
  const grounded = await parseRecipeText('1 cup flour\n2 eggs\nMix and bake.', {
    foundation: async () => ({ ok: true as const, recipe: { title: 'Bad', ingredients: [{ name: 'butter' }], steps: ['Mix'], parser: 'foundation' as const } }),
    readApiKey: noKey,
    heuristic: () => ({ title: 'Good', ingredients: [{ name: 'flour' }], steps: ['Mix'], parser: 'heuristic' }),
  });
  expect(grounded?.adapterId).toBe('heuristic');
  expect(grounded?.ingredients).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'flour' })]));
});

it('uses whole-word grounding, accepts ordinary titles, and does not make Gnocchi junk', () => {
  expect(groundParsedRecipe({ title: 'x', ingredients: [{ name: 'egg' }], steps: [], parser: 'foundation' }, 'roast eggplant')).toBeNull();
  expect(groundParsedRecipe({ title: 'x', ingredients: [{ name: 'garlic cloves' }], steps: [], parser: 'foundation' }, '2 cloves garlic, minced')?.ingredients).toHaveLength(1);
  expect(groundParsedRecipe({ title: 'x', ingredients: [{ name: 'tomato' }], steps: [], parser: 'foundation' }, '2 tomatoes')?.ingredients).toHaveLength(1);
  expect(suitableTitleFromText('A Perfect Lemon Cake\n2 cups flour')).toBe('A Perfect Lemon Cake');
  const draft = parsedRecipeToDraft({ title: 'Gnocchi', ingredients: [], steps: [], parser: 'openai' }, { sourceText: '', titleHint: 'Caption Line Title' });
  expect(draft.title).toBe('Gnocchi');
  expect(draft.confidence.title).toBe('medium');
});

it('times out Foundation and exposes one shared import LLM budget', async () => {
  const slow = await parseRecipeText('1 cup flour. Mix.', {
    foundationTimeoutMs: 20,
    foundation: async () => new Promise((resolve) => setTimeout(() => resolve({ ok: true as const, recipe: recipe('foundation') }), 200)),
    readApiKey: noKey,
    heuristic: () => recipe(),
  });
  expect(slow?.adapterId).toBe('heuristic');
  const autoImport = fs.readFileSync(path.join(__dirname, '..', 'import', 'autoImport.ts'), 'utf8');
  expect(autoImport).toMatch(/MAX_LLM_PARSES_PER_IMPORT\s*=\s*2/);
  expect(autoImport).toMatch(/LLM_BUDGET_MS\s*=\s*30_000/);
});
