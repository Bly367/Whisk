/**
 * Instagram share matrix: iOS share-extension JSON -> expo-share-intent parsing -> Whisk share
 * parsing -> runAutoImport -> real fetchText/socialMeta/parsers -> SQLite. Only global fetch,
 * the Foundation Models native module, and native transcription are mocked.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseShareIntent as parseNativeShareJson } from 'expo-share-intent/build/utils';

import { createRepositories, getRepositories, setRepositoriesForTests } from '@/data/repositories';
import { createTestDbClient } from '@/data/testing/createTestDb';
import { runAutoImport, type AutoImportResult } from '@/import/autoImport';
import { parseShareIntent, toAutoImportPayload } from '@/import/shareIntent';
import { parseRecipeWithFoundationModels } from '@/modules/whisk-recipe-parse';
import { transcribeVideo } from '@/import/transcribe';

jest.mock('@/modules/whisk-recipe-parse', () => ({
  parseRecipeWithFoundationModels: jest.fn(),
  isFoundationModelsAvailable: jest.fn(() => false),
}));
jest.mock('@/import/transcribe', () => ({ transcribeVideo: jest.fn() }));

const foundation = parseRecipeWithFoundationModels as jest.MockedFunction<typeof parseRecipeWithFoundationModels>;
const transcribe = transcribeVideo as jest.MockedFunction<typeof transcribeVideo>;

const fixture = (name: string) => fs.readFileSync(path.join(__dirname, 'fixtures/social', name), 'utf8');
const crunchwrap = fixture('ig-crunchwrap-oembed-caption.txt');
const embedCaptionDiv = fixture('ig-embed-caption-div.html');
const embedEscapedJson = fixture('ig-embed-escaped-json.html');
const POST_ID = 'DfUyjFYBRnX';
const SHARED_URL = `https://www.instagram.com/reel/${POST_ID}/?srtk=MTE1aHFwbHk1aWs5cg==`;
const LOGIN_URL = `https://www.instagram.com/accounts/login/?next=%2Freel%2F${POST_ID}%2F`;
const HONEST_UA = 'Whisk/1.0 (recipe importer)';

type Reply = { status?: number; body?: string; url?: string; contentType?: string; throws?: boolean };
type Routes = { page: Reply; oembed?: Reply; embed?: Reply; sites?: Record<string, Reply> };
type FetchCall = { url: string; init: { headers?: Record<string, string>; credentials?: string; redirect?: string } };

let calls: FetchCall[] = [];

function installFetch(routes: Routes) {
  calls = [];
  global.fetch = jest.fn(async (input: string, init: FetchCall['init'] = {}) => {
    const url = String(input);
    calls.push({ url, init });
    const parsed = new URL(url);
    let reply: Reply | undefined;
    if (parsed.pathname.startsWith('/api/v1/oembed')) {
      const target = parsed.searchParams.get('url') ?? '';
      // Instagram's oEmbed only resolves www post permalinks.
      reply = /^https:\/\/www\.instagram\.com\/(?:p|reel|tv)\/[\w-]+\/$/.test(target)
        ? routes.oembed
        : { status: 404, body: '{"message":"No Media Match","status":"fail"}', contentType: 'application/json' };
    } else if (parsed.pathname.includes('/embed/captioned')) reply = routes.embed;
    else if (parsed.hostname.endsWith('instagram.com')) reply = routes.page;
    else reply = routes.sites?.[url];
    if (!reply || reply.throws) throw new TypeError('Network request failed');
    const headers: Record<string, string> = { 'content-type': reply.contentType ?? 'text/html; charset=utf-8' };
    return {
      status: reply.status ?? 200,
      url: reply.url ?? url,
      headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
      text: async () => reply!.body ?? '',
    };
  }) as unknown as typeof fetch;
}

const htmlEncode = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '&#10;')
    .replace(/[\u{1F000}-\u{1FAFF}]/gu, (char) => `&#x${char.codePointAt(0)!.toString(16)};`);
const ogPage = (caption: string) =>
  `<!DOCTYPE html><html><head><meta property="og:title" content="Arsenio Eats on Instagram" />` +
  `<meta property="og:description" content="194K likes, 312 comments - arsenioeats on November 10, 2026: &quot;${htmlEncode(caption)}&quot;. " /></head><body></body></html>`;
const jsShell =
  '<!DOCTYPE html><html><head><meta property="og:type" content="article" /><meta property="og:site_name" content="Instagram" />' +
  `<meta property="og:url" content="https://www.instagram.com/arsenioeats/reel/${POST_ID}/" /></head><body><script>window.__bbox={}</script></body></html>`;
const loginPage =
  '<!DOCTYPE html><html><head><meta name="description" content="Create an account or log in to Instagram - Share what you&#039;re into with the people who get you." /></head>' +
  '<body><form method="post" action="/accounts/login/ajax/"></form></body></html>';
// Instagram's oEmbed escapes non-ASCII as \uXXXX on the wire.
const asciiJson = (value: unknown) =>
  JSON.stringify(value).replace(/[\u007f-\uffff]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
const oembedOk = (caption: string): Reply => ({
  body: asciiJson({ version: '1.0', title: caption, author_name: 'arsenioeats', provider_name: 'Instagram', type: 'rich' }),
  contentType: 'application/json; charset=utf-8',
});
const deviceLike = (caption = crunchwrap): Routes => ({ page: { body: jsShell }, oembed: oembedOk(caption) });

const weburlShare = (url: string) => ({ weburls: [{ url, meta: '{}' }], type: 'weburl' });
const textShare = (text: string) => ({ text, type: 'text' });

async function shareFromInstagram(nativeJson: object) {
  const intent = parseNativeShareJson(JSON.stringify(nativeJson), {});
  const parsed = parseShareIntent(intent);
  if (!parsed) throw new Error('share intent rejected');
  const payload = toAutoImportPayload(parsed);
  const stages: string[] = [];
  const result = await runAutoImport(payload, {}, (stage) => stages.push(stage));
  const saved = result.ok ? getRepositories().recipes.getById(result.recipe.id) : null;
  return { payload, result, saved, stages };
}

function expectSavedCrunchwrap(outcome: { result: AutoImportResult; saved: ReturnType<ReturnType<typeof getRepositories>['recipes']['getById']>; stages: string[] }) {
  expect(outcome.result).toEqual(expect.objectContaining({ ok: true, source: 'caption' }));
  expect(outcome.saved?.title).toMatch(/Crunchwrap Supreme/);
  expect(outcome.saved?.ingredients.length).toBeGreaterThanOrEqual(10);
  expect(outcome.saved?.instructions.length).toBeGreaterThanOrEqual(3);
  expect(outcome.saved?.ingredients.map((item) => item.name)).toEqual(expect.arrayContaining(['ground beef']));
  expect(transcribe).not.toHaveBeenCalled();
  expect(outcome.stages).not.toContain('transcribing');
}

const oembedParams = () =>
  calls.filter((call) => call.url.includes('/api/v1/oembed')).map((call) => new URL(call.url).searchParams.get('url'));

beforeEach(() => {
  setRepositoriesForTests(createRepositories(createTestDbClient()));
  foundation.mockResolvedValue({ ok: false, reason: 'unavailable' });
  jest.spyOn(console, 'debug').mockImplementation(() => {});
});
afterEach(() => {
  setRepositoriesForTests(null);
  jest.useRealTimers();
});

describe('iOS share-sheet payload shapes from Instagram', () => {
  it.each([
    ['igsh', `https://www.instagram.com/reel/${POST_ID}/?igsh=MWQ1ZGUxMzBkMA==`, 'reel'],
    ['srtk', SHARED_URL, 'reel'],
    ['utm_source', `https://www.instagram.com/reel/${POST_ID}/?utm_source=ig_web_copy_link`, 'reel'],
    ['/reels/', `https://www.instagram.com/reels/${POST_ID}/`, 'reel'],
    ['/p/', `https://www.instagram.com/p/${POST_ID}/`, 'p'],
    ['/tv/', `https://www.instagram.com/tv/${POST_ID}/`, 'tv'],
    ['no trailing slash', `https://www.instagram.com/reel/${POST_ID}`, 'reel'],
    ['no www', `https://instagram.com/reel/${POST_ID}/`, 'reel'],
    ['m.instagram.com', `https://m.instagram.com/reel/${POST_ID}/?igsh=abc`, 'reel'],
    ['instagr.am short link', `https://instagr.am/reel/${POST_ID}/`, 'reel'],
    ['instagr.am /p/', `https://instagr.am/p/${POST_ID}`, 'p'],
    ['username-prefixed permalink', `https://www.instagram.com/arsenioeats/reel/${POST_ID}/`, 'reel'],
  ])('public.url (%s) saves the caption recipe', async (_label, url, kind) => {
    installFetch(deviceLike());
    const outcome = await shareFromInstagram(weburlShare(url));
    expectSavedCrunchwrap(outcome);
    expect(oembedParams()).toEqual([`https://www.instagram.com/${kind}/${POST_ID}/`]);
  });

  it('public.plain-text holding only the URL saves the recipe', async () => {
    installFetch(deviceLike());
    expectSavedCrunchwrap(await shareFromInstagram(textShare(SHARED_URL)));
  });

  it('public.plain-text with caption-ish text plus the URL saves the recipe', async () => {
    installFetch(deviceLike());
    const outcome = await shareFromInstagram(
      textShare(`Crunchwrap Supreme 🌯🔥 Homemade, extra spicy, and crunchier than the drive-thru… more\n${SHARED_URL}`),
    );
    expect(outcome.payload.url).toBe(SHARED_URL);
    expectSavedCrunchwrap(outcome);
  });

  it('an NSURL-ish string (angle brackets, padding) still yields the reel URL', async () => {
    installFetch(deviceLike());
    const outcome = await shareFromInstagram(textShare(`  <${SHARED_URL}>\n`));
    expect(outcome.payload.url).toBe(SHARED_URL);
    expectSavedCrunchwrap(outcome);
  });

  it('a text item that lost the URL (URL + text attachment pair) fails with a share-shape code', async () => {
    installFetch(deviceLike());
    const outcome = await shareFromInstagram(textShare('Check out this reel by arsenioeats'));
    expect(outcome.result.ok).toBe(false);
    expect(calls).toHaveLength(0);
    if (!outcome.result.ok) expect(outcome.result.code).toBe('text: share=text url=none');
  });
});

describe('responses an iPhone can get from Instagram', () => {
  const share = () => shareFromInstagram(weburlShare(SHARED_URL));

  it('200 page with the full caption in og:description (likes prefix, entities)', async () => {
    installFetch({ page: { body: ogPage(crunchwrap) }, oembed: { status: 400, body: '{"status":"fail"}', contentType: 'application/json' } });
    const outcome = await share();
    expectSavedCrunchwrap(outcome);
    expect(outcome.saved?.title).not.toMatch(/&#|&quot;|&amp;|likes/);
  });

  it('200 JS shell without og meta falls through to oEmbed', async () => {
    installFetch(deviceLike());
    expectSavedCrunchwrap(await share());
  });

  it('a followed redirect to accounts/login?next= still queries oEmbed for the reel', async () => {
    installFetch({ page: { url: LOGIN_URL, body: loginPage }, oembed: oembedOk(crunchwrap) });
    expectSavedCrunchwrap(await share());
    expect(oembedParams()).toEqual([`https://www.instagram.com/reel/${POST_ID}/`]);
    expect(calls.some((call) => call.url.includes('/accounts/login/embed'))).toBe(false);
  });

  it('an unfollowed 302 to login with an empty body still queries oEmbed', async () => {
    installFetch({ page: { status: 302, body: '' }, oembed: oembedOk(crunchwrap) });
    expectSavedCrunchwrap(await share());
  });

  it('429 on the reel page still uses oEmbed', async () => {
    installFetch({ page: { status: 429, body: 'Please wait a few minutes before you try again.' }, oembed: oembedOk(crunchwrap) });
    expectSavedCrunchwrap(await share());
  });

  it('a thrown network error on the reel page still uses oEmbed', async () => {
    installFetch({ page: { throws: true }, oembed: oembedOk(crunchwrap) });
    expectSavedCrunchwrap(await share());
  });

  it('a truncated og:description ("...") prefers the full oEmbed caption', async () => {
    installFetch({ page: { body: ogPage(`${crunchwrap.slice(0, 140)}...`) }, oembed: oembedOk(crunchwrap) });
    expectSavedCrunchwrap(await share());
  });

  it('a "... more" og:description with oEmbed down reads the embed Caption div', async () => {
    installFetch({ page: { body: ogPage(`${crunchwrap.slice(0, 140)}… more`) }, oembed: { throws: true }, embed: { body: embedCaptionDiv } });
    expectSavedCrunchwrap(await share());
  });

  it.each([
    ['oEmbed 400 JSON', { status: 400, body: '{"message":"Invalid URL","status":"fail"}', contentType: 'application/json' }],
    ['oEmbed 401', { status: 401, body: '{"message":"login_required","status":"fail"}', contentType: 'application/json' }],
    ['oEmbed 200 HTML login page', { body: loginPage }],
  ])('%s falls back to the embed Caption div', async (_label, oembed) => {
    installFetch({ page: { url: LOGIN_URL, body: loginPage }, oembed, embed: { body: embedCaptionDiv } });
    const outcome = await share();
    expectSavedCrunchwrap(outcome);
    expect(outcome.saved?.ingredients.map((item) => item.name).join(' ')).not.toMatch(/arsenioeats/);
  });

  it('oEmbed 404 falls back to the caption inside escaped JSON in an embed script', async () => {
    installFetch({ page: { body: jsShell }, oembed: { status: 404, body: '<html>Not found</html>' }, embed: { body: embedEscapedJson } });
    expectSavedCrunchwrap(await share());
  });

  it('when page, oEmbed and embed all fail it returns the Photos hint and a diagnostic code', async () => {
    installFetch({ page: { url: LOGIN_URL, body: loginPage }, oembed: { status: 400, body: '{"status":"fail"}', contentType: 'application/json' }, embed: { body: '<html><body></body></html>' } });
    const outcome = await share();
    expect(outcome.result).toEqual(expect.objectContaining({ ok: false, hints: ['ig_save_reel'] }));
    if (!outcome.result.ok) {
      expect(outcome.result.code).toBe('ig: share=url page=login_wall oembed=http_400 embed=no_caption caption=none parse=none');
      expect(outcome.result.code).not.toMatch(/https?:|instagram\.com|srtk|Crunchwrap/i);
    }
    expect(transcribe).not.toHaveBeenCalled();
  });

  it('a preview (non-__DEV__) build still gets the failure code, without the caption it failed to parse', async () => {
    const globals = globalThis as { __DEV__?: boolean };
    const dev = globals.__DEV__;
    globals.__DEV__ = false;
    try {
      installFetch({ page: { body: jsShell }, oembed: { body: JSON.stringify({ title: 'Crunchwrap night! Recipe soon 🌯 #tacobell', author_name: 'chef' }), contentType: 'application/json' } });
      const outcome = await share();
      expect(outcome.result.ok).toBe(false);
      if (!outcome.result.ok) {
        expect(outcome.result.code).toBe('ig: share=url page=no_meta oembed=ok embed=skip caption=oembed parse=none');
        expect(outcome.result.code).not.toMatch(/https?:|instagram\.com|srtk|Crunchwrap|chef|tacobell/i);
      }
    } finally {
      globals.__DEV__ = dev;
    }
  });

  it('JS shell, oEmbed 404 and an empty embed fail with the matching code', async () => {
    installFetch({ page: { body: jsShell }, oembed: { status: 404, body: '' }, embed: { status: 200, body: '' } });
    const outcome = await share();
    expect(outcome.result.ok).toBe(false);
    if (!outcome.result.ok)
      expect(outcome.result.code).toBe('ig: share=url page=no_meta oembed=http_404 embed=no_caption caption=none parse=none');
  });

  it('sends the honest UA without cookies on every request', async () => {
    installFetch({ page: { url: LOGIN_URL, body: loginPage }, oembed: { status: 400, body: '' }, embed: { body: embedCaptionDiv } });
    await share();
    expect(calls.length).toBeGreaterThanOrEqual(3);
    for (const call of calls) {
      expect(call.init.headers?.['User-Agent']).toBe(HONEST_UA);
      expect(call.init.credentials).toBe('omit');
    }
  });
});

describe('caption shapes', () => {
  const shareCaption = (caption: string, extra: Partial<Routes> = {}) => {
    installFetch({ ...deviceLike(caption), ...extra });
    return shareFromInstagram(weburlShare(SHARED_URL));
  };

  it('the real crunchwrap caption', async () => {
    const outcome = await shareCaption(crunchwrap);
    expectSavedCrunchwrap(outcome);
    expect(outcome.saved?.ingredients.find((item) => item.name === 'ground beef')).toEqual(
      expect.objectContaining({ quantity: '450', unit: 'g' }),
    );
  });

  it('upper-case BEEF / ASSEMBLY / INSTRUCTIONS headers', async () => {
    const caption = crunchwrap.replace(/^Beef$/m, 'BEEF').replace(/^Assembly$/m, 'ASSEMBLY').replace(/^Instructions$/m, 'INSTRUCTIONS');
    expectSavedCrunchwrap(await shareCaption(caption));
  });

  it('emoji bullets on ingredient lines', async () => {
    const caption = crunchwrap.replace(/^(450g|½|1 pack|1 tsp|4 large|4 small|4 tostadas)/gm, '🔸 $1');
    expectSavedCrunchwrap(await shareCaption(caption));
  });

  it('numbered steps on a single line', async () => {
    const [head] = crunchwrap.split(/\nInstructions\n/);
    const caption = `${head}\nInstructions\n1. Cook the beef with the onion until browned. 2. Chop the lettuce, tomato, and jalapeño. 3. Fold the large tortilla over the filling. 4. Crisp it in an oiled pan for 2–3 minutes per side.`;
    const outcome = await shareCaption(caption);
    expectSavedCrunchwrap(outcome);
    expect(outcome.saved?.instructions.length).toBe(4);
  });

  it('ingredients only saves with the Photos note', async () => {
    const [head] = crunchwrap.split(/\nInstructions\n/);
    const outcome = await shareCaption(head);
    expect(outcome.result).toEqual(expect.objectContaining({ ok: true, source: 'caption', lowConfidence: true }));
    expect(outcome.saved?.ingredients.length).toBeGreaterThanOrEqual(5);
    expect(outcome.saved?.instructions).toHaveLength(0);
    expect(outcome.saved?.notes).toMatch(/share it from Photos to Whisk/);
    expect(transcribe).not.toHaveBeenCalled();
  });

  it('a caption with only a recipe link follows the link', async () => {
    const site = 'https://arsenioeats.example/crunchwrap-supreme';
    const recipeHtml = `<html><head><script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'Recipe', name: 'Crunchwrap Supreme',
      recipeIngredient: ['450 g ground beef', '4 large tortillas', '4 tostadas', '1 cup sour cream'],
      recipeInstructions: [{ '@type': 'HowToStep', text: 'Brown the beef.' }, { '@type': 'HowToStep', text: 'Assemble and fold.' }, { '@type': 'HowToStep', text: 'Crisp in a pan.' }],
    })}</script></head></html>`;
    const outcome = await shareCaption(`Crunchwrap Supreme 🌯🔥 Full recipe: ${site}`, { sites: { [site]: { body: recipeHtml } } });
    expect(outcome.result).toEqual(expect.objectContaining({ ok: true, source: 'web' }));
    expect(outcome.saved?.ingredients.length).toBe(4);
    expect(outcome.saved?.instructions.length).toBe(3);
    expect(transcribe).not.toHaveBeenCalled();
  });

  it('a hashtag-heavy caption', async () => {
    const outcome = await shareCaption(`${crunchwrap}\n\n#crunchwrap #tacobell #fakeaway #mexicanfood #recipe #easyrecipes #foodtok #reels`);
    expectSavedCrunchwrap(outcome);
    expect(outcome.saved?.ingredients.map((item) => item.name).join(' ')).not.toMatch(/#/);
  });
});

describe('parser tiers with no OpenAI key', () => {
  const share = () => {
    installFetch(deviceLike());
    return shareFromInstagram(weburlShare(SHARED_URL));
  };

  it('Foundation unavailable: heuristic saves', async () => {
    foundation.mockResolvedValue({ ok: false, reason: 'unavailable' });
    expectSavedCrunchwrap(await share());
  });

  it('Foundation throws: heuristic saves', async () => {
    foundation.mockRejectedValue(new Error('native crash'));
    expectSavedCrunchwrap(await share());
  });

  it('Foundation times out: heuristic saves', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    foundation.mockImplementation(() => new Promise(() => {}));
    const pending = share();
    await jest.advanceTimersByTimeAsync(31_000);
    expectSavedCrunchwrap(await pending);
  });

  it('Foundation returns a rich draft without quantities: the quantified heuristic draft still saves', async () => {
    foundation.mockResolvedValue({
      ok: true,
      recipe: {
        title: 'Crunchwrap Supreme',
        ingredients: ['ground beef', 'onion', 'Taco Bell seasoning', 'cayenne', 'large tortillas', 'small tortillas', 'tostadas', 'cheddar', 'mozzarella', 'sour cream', 'lettuce', 'tomato', 'jalapeño']
          .map((name) => ({ name })),
        steps: ['Cook the beef with the onion until browned.', 'Add the Taco Bell seasoning and cayenne.', 'Chop the lettuce, tomato, and jalapeño.', 'Fold the large tortilla into the center.', 'Crisp up for 2–3 minutes per side.'],
        parser: 'foundation',
      },
    });
    const outcome = await share();
    expectSavedCrunchwrap(outcome);
    expect(outcome.saved?.ingredients.filter((item) => item.quantity).length).toBeGreaterThanOrEqual(5);
  });

  it('Foundation returns a quantified draft: it is saved', async () => {
    foundation.mockResolvedValue({
      ok: true,
      recipe: {
        title: 'Crunchwrap Supreme',
        ingredients: [
          { name: 'ground beef', quantity: '450', unit: 'g' }, { name: 'onion', quantity: '½' }, { name: 'Taco Bell seasoning', quantity: '1', unit: 'pack' },
          { name: 'cayenne', quantity: '1', unit: 'tsp' }, { name: 'large tortillas', quantity: '4' }, { name: 'small tortillas', quantity: '4' },
          { name: 'tostadas', quantity: '4' }, { name: 'sour cream' }, { name: 'lettuce' }, { name: 'tomato' }, { name: 'jalapeño' },
        ],
        steps: ['Cook the beef with the onion until browned.', 'Chop the lettuce, tomato, and jalapeño.', 'Fold and crisp in an oiled pan.'],
        parser: 'foundation',
      },
    });
    const outcome = await share();
    expectSavedCrunchwrap(outcome);
  });

  it('Foundation returns a thin names-only draft: heuristic wins', async () => {
    foundation.mockResolvedValue({
      ok: true,
      recipe: { title: 'Crunchwrap Supreme', ingredients: [{ name: 'ground beef' }, { name: 'tortillas' }, { name: 'Assembly' }], steps: [], parser: 'foundation' },
    });
    const outcome = await share();
    expectSavedCrunchwrap(outcome);
    expect(outcome.saved?.ingredients.map((item) => item.name)).not.toContain('Assembly');
  });
});
