import fs from 'node:fs';
import path from 'node:path';

import type { RecipeCreateInput, RecipeWithIngredients } from '@/data/contracts';
import { commitAutoImportDraft, ImportCommitError } from '@/import/commit';
import { diagnosticsText, runAutoImport, subtitleText } from '@/import/autoImport';
import type { ImportDraft } from '@/import/types';
import { fetchSocialMeta } from '@/import/social/socialMeta';
import { videoFromUrl } from '@/import/social/videoFromUrl';
import type { TranscribeVideoError } from '@/import/transcribe';

const fixture = (name: string) =>
  fs.readFileSync(path.join(__dirname, 'fixtures/social', name), 'utf8');
const tortellini = fixture('tiktok-tortellini-contents.txt');
const mtUrl = 'https://v16m-webapp.tiktokcdn-us.com/fixture-mt/?a=1988';
const videoUrl = 'https://v16-webapp-prime.us.tiktok.com/video/tos/useast5/fixture/?a=1988';
const mtVtt = `WEBVTT

1
00:00:00.000 --> 00:00:02.000
Cook your Italian sausage.

2
00:00:02.000 --> 00:00:04.000
Add in your tomato paste.

3
00:00:04.000 --> 00:00:06.000
Pour in your cream.

4
00:00:06.000 --> 00:00:08.000
Add chicken broth and cooked sausage.

5
00:00:08.000 --> 00:00:10.000
Stir in the dried herbs.

6
00:00:10.000 --> 00:00:12.000
Bring the soup to a gentle simmer.

7
00:00:12.000 --> 00:00:14.000
Add in the tortellini and cook until tender.

8
00:00:14.000 --> 00:00:16.000
Fold in the spinach.

9
00:00:16.000 --> 00:00:18.000
Finish with Parmesan and lemon.

10
00:00:18.000 --> 00:00:20.000
Serve warm.`;
const page = (tracks: unknown, cookie = true) => {
  const item = {
    desc: tortellini,
    contents: [{ desc: tortellini }],
    video: {
      playAddr: videoUrl,
      ...(tracks === undefined ? {} : { subtitleInfos: tracks }),
    },
  };
  const html = `<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify({ __DEFAULT_SCOPE__: { 'webapp.video-detail': { itemInfo: { itemStruct: item } } } })}</script>`;
  return async (url: string) =>
    url === mtUrl
      ? { status: 200, finalUrl: url, text: mtVtt }
      : {
          status: 200,
          finalUrl: 'https://www.tiktok.com/@cook/video/1',
          text: html,
          ...(cookie ? { setCookie: 'tt_chain_token=abc==; path=/' } : {}),
        };
};
const draft = (ingredients: number): ImportDraft => ({
  id: 'd',
  title: 'Soup',
  sourceKind: 'share_sheet',
  sourceUrl: null,
  sourceName: null,
  imageUri: null,
  notes: null,
  servings: null,
  prepMinutes: null,
  cookMinutes: null,
  ingredients: Array.from({ length: ingredients }, (_, position) => ({
    name: `item ${position}`,
    quantity: '1',
    unit: 'cup',
    position,
  })),
  instructions: [],
  confidence: { title: 'medium', ingredients: 'medium', instructions: 'unknown' },
  warnings: [],
  sourceEvidence: '',
  adapterId: 'test',
  createdAt: '2026-01-01T00:00:00.000Z',
});
const savedRecipe = (title = 'Saved'): RecipeWithIngredients => ({
  id: 'saved',
  title,
  notes: null,
  sourceUrl: null,
  sourceName: null,
  imageUri: null,
  servings: null,
  prepMinutes: null,
  cookMinutes: null,
  rating: null,
  instructions: [],
  status: 'published',
  isFavorite: false,
  cookedAt: null,
  deletedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  localRevision: 0,
  syncStatus: 'synced_local',
  householdId: null,
  remoteId: null,
  ingredients: [],
  tagIds: [],
});

it('uses English MT, prefers ASR, and ignores non-English subtitle tracks', async () => {
  const tracks = [{ Format: 'webvtt', LanguageCodeName: 'eng-US', Source: 'MT', Url: mtUrl }];
  const meta = await fetchSocialMeta('https://www.tiktok.com/@cook/video/1', {
    fetchText: page(tracks),
  });
  expect(meta).toEqual(expect.objectContaining({ transcriptUrl: mtUrl, transcriptSource: 'MT' }));

  const asr = await fetchSocialMeta('https://www.tiktok.com/@cook/video/1', {
    fetchText: page([
      { ...tracks[0], Source: 'MT' },
      { ...tracks[0], Source: 'ASR', Url: 'https://v16m-webapp.tiktokcdn-us.com/asr' },
    ]),
  });
  expect(asr).toEqual(
    expect.objectContaining({
      transcriptUrl: 'https://v16m-webapp.tiktokcdn-us.com/asr',
      transcriptSource: 'ASR',
    }),
  );

  const spanish = await fetchSocialMeta('https://www.tiktok.com/@cook/video/1', {
    fetchText: page([{ ...tracks[0], LanguageCodeName: 'spa-ES' }]),
  });
  expect(spanish.transcriptUrl).toBeUndefined();
  expect(spanish.transcriptSource).toBeUndefined();
});

it('merges the tortellini caption with MT steps without downloading the video', async () => {
  const stages: string[] = [];
  const download = jest.fn();
  const fetchText = page([
    { Format: 'webvtt', LanguageCodeName: 'eng-US', Source: 'MT', Url: mtUrl },
  ]);
  const result = await runAutoImport(
    { url: 'https://www.tiktok.com/@cook/video/1' },
    {
      fetchSocialMeta: (url) => fetchSocialMeta(url, { fetchText }),
      fetchText,
      videoFromUrl: download,
      commitImportDraft: jest.fn(() => ({ id: 'saved' })),
    },
    (stage) => stages.push(stage),
  );

  expect(result).toEqual(expect.objectContaining({ ok: true, source: 'caption+audio' }));
  if (result.ok) {
    expect(result.draft.title).toBe('Creamy, Spicy Tortellini and Sausage Soup');
    expect(result.draft.ingredients).toHaveLength(25);
    expect(result.draft.ingredients[0]).toEqual(
      expect.objectContaining({ quantity: '1', unit: 'tbsp', name: 'butter' }),
    );
    expect(result.draft.ingredients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'garlic',
          quantity: expect.stringMatching(/^6[–-]8$/),
          unit: 'cloves',
        }),
      ]),
    );
    const steps = result.draft.instructions.map((step) => step.text);
    expect(steps.length).toBeGreaterThanOrEqual(8);
    expect(steps).toEqual(
      expect.arrayContaining([
        'Cook your Italian sausage.',
        'Add in your tomato paste.',
        'Pour in your cream.',
      ]),
    );
    expect(steps).toEqual(
      expect.arrayContaining([expect.stringContaining('chicken broth and cooked sausage')]),
    );
    expect(steps).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^\s*(?:\d|[½¼¾⅛⅜⅝⅞])/)]),
    );
    expect(steps.every((step) => !/\b(?:your|the|a|an|and|or|with|of|in|into|to|some|my)$/i.test(step))).toBe(true);
  }
  expect(stages).toContain('reading_transcript');
  expect(stages).not.toContain('downloading_video');
  expect(download).not.toHaveBeenCalled();
});

it('preserves punctuated subtitle text and joins the ASR-style four-cue track', () => {
  expect(
    subtitleText(`WEBVTT

1
00:00:00.000 --> 00:00:01.000
Today we're making dinner,

2
00:00:01.000 --> 00:00:02.000
beef bulgogi.

3
00:00:02.000 --> 00:00:03.000
Add the beef.`),
  ).toBe("Today we're making dinner, beef bulgogi. Add the beef.");
  expect(
    subtitleText(`WEBVTT

00:00:00.000 --> 00:00:01.000
Add my onions.

00:00:01.000 --> 00:00:02.000
Add in our ground beef.

00:00:02.000 --> 00:00:03.000
Stir it.

00:00:03.000 --> 00:00:04.000
Serve it over rice.`),
  ).toBe('Add my onions. Add in our ground beef. Stir it. Serve it over rice.');
});

it('records 403 diagnostics, saves the T3 caption, and keeps secrets out of output', async () => {
  for (const cookie of [false, true]) {
    const committed = { draft: null as ImportDraft | null };
    const commit = jest.fn((nextDraft: ImportDraft) => {
      committed.draft = { ...nextDraft, sourceUrl: null };
      return { id: 'saved' };
    });
    const videoDownload = jest.fn(async () => ({
      ok: false as const,
      reason: 'http_403' as const,
      detail: 'Unable to download file: response has status 403',
    }));
    const result = await runAutoImport(
      { url: 'https://www.tiktok.com/@cook/video/1' },
      {
        fetchSocialMeta: (url) => fetchSocialMeta(url, { fetchText: page(undefined, cookie) }),
        videoFromUrl: videoDownload,
        commitImportDraft: commit,
      },
    );

    expect(result).toEqual(expect.objectContaining({ ok: true, source: 'caption', lowConfidence: true }));
    if (!result.ok) continue;
    expect(result.draft.ingredients).toHaveLength(25);
    expect(result.draft.instructions).toHaveLength(0);
    expect(result.draft.notes).toContain("Steps weren't in the caption.");
    expect(commit).toHaveBeenCalledWith(expect.anything(), { allowIngredientsOnly: true });
    expect(videoDownload).toHaveBeenCalled();

    const videoDiagnostic = result.diagnostics.find(({ code }) => code === 'video:http_403');
    expect(videoDiagnostic).toEqual(
      expect.objectContaining({
        stage: 'downloading_video',
        code: 'video:http_403',
        detail: cookie
          ? expect.stringMatching(/^host=v16-webapp-prime\.us\.tiktok\.com cookie=yes setCookieSeen=yes/)
          : 'host=v16-webapp-prime.us.tiktok.com cookie=no setCookieSeen=no Unable to download file: response has status 403',
      }),
    );
    expect(JSON.stringify(result.diagnostics)).not.toContain('abc==');
    expect(JSON.stringify(result.diagnostics)).not.toContain('tt_chain_token');
    expect(JSON.stringify(committed.draft)).not.toContain('tt_chain_token');
    expect(JSON.stringify(committed.draft)).not.toContain('a=1988');
    expect(committed.draft?.sourceUrl).toBeNull();
  }
});

it('records native transcription error codes and a successful no-draft diagnostic', async () => {
  const errors: TranscribeVideoError[] = [
    {
      code: 'audio_extraction_failed',
      message: 'x',
      details: { code: 'file_not_found', message: 'x' },
    },
    {
      code: 'transcription_failed',
      message: 'x',
      details: { code: 'model_not_downloaded', message: 'x' },
    },
  ];
  for (const error of errors) {
    const result = await runAutoImport(
      { url: 'https://instagram.com/reel/1' },
      {
        fetchSocialMeta: async () => ({
          source: 'instagram',
          canonicalUrl: 'https://instagram.com/reel/1',
          linkedUrls: [],
          videoUrl: 'https://cdninstagram.com/a.mp4',
        }),
        videoFromUrl: async () => ({ ok: true as const, uri: '/a', cleanup: async () => {} }),
        transcribeVideo: async () => ({ ok: false as const, error }),
      },
    );
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: `transcribe:${error.code}:${error.details?.code}` }),
      ]),
    );
  }

  const noDraft = await runAutoImport(
    { url: 'https://instagram.com/reel/1' },
    {
      fetchSocialMeta: async () => ({
        source: 'instagram',
        canonicalUrl: 'https://instagram.com/reel/1',
        linkedUrls: [],
        videoUrl: 'https://cdninstagram.com/a.mp4',
      }),
      videoFromUrl: async () => ({ ok: true as const, uri: '/a', cleanup: async () => {} }),
      transcribeVideo: async () => ({
        ok: true as const,
        transcript: '',
        metadata: { text: '', durationMs: 1, segments: [] },
      }),
    },
  );
  expect(noDraft).toEqual(expect.objectContaining({ ok: false }));
  expect(noDraft.diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ stage: 'transcribing', code: 'transcribe:no_draft' }),
    ]),
  );
});

it('still fails for a too-thin ingredients-only caption after a download failure', async () => {
  const commit = jest.fn(() => ({ id: 'unexpected' }));
  const result = await runAutoImport(
    { url: 'https://instagram.com/reel/1' },
    {
      fetchSocialMeta: async () => ({
        source: 'instagram',
        canonicalUrl: 'https://instagram.com/reel/1',
        caption: 'Ingredients:\n1 cup flour\n1 cup milk\n1 egg',
        linkedUrls: [],
        videoUrl: 'https://cdninstagram.com/a.mp4',
      }),
      videoFromUrl: async () => ({ ok: false as const, reason: 'http_403' as const }),
      commitImportDraft: commit,
    },
  );
  expect(result).toEqual(
    expect.objectContaining({ ok: false, reason: "Couldn't find a recipe in this post" }),
  );
  expect(result.diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: 'caption:not_saveable' }),
      expect.objectContaining({ code: 'video:http_403' }),
    ]),
  );
  expect(commit).not.toHaveBeenCalled();
});

it('sanitizes native video details, strips bare host paths, and blocks unallowlisted hosts', async () => {
  const sanitized = await videoFromUrl(
    { videoUrl: 'https://v16.tiktokcdn.com/a.mp4' },
    {
      includeDetail: true,
      createDirectory: async () => {},
      downloadFile: async () => {
        throw new Error('Unable to download file: response has status 403 https://v16-webapp-prime.us.tiktok.com/x?sig=1');
      },
    },
  );
  expect(sanitized).toEqual(expect.objectContaining({ ok: false, reason: 'http_403' }));
  if (!sanitized.ok) expect(sanitized.detail).not.toMatch(/https?:\/\/|\?sig=/);

  const schemeless = await videoFromUrl(
    { videoUrl: 'https://v16.tiktokcdn.com/a.mp4' },
    {
      includeDetail: true,
      createDirectory: async () => {},
      downloadFile: async () => {
        throw new Error('Unable to download file: response has status 403 v16.tiktokcdn.com/c0eadf/video?sig=1');
      },
    },
  );
  expect(schemeless).toEqual(expect.objectContaining({ ok: false, reason: 'http_403' }));
  if (!schemeless.ok) expect(schemeless.detail).not.toContain('v16.tiktokcdn.com/c0eadf/video');

  const blockedDownload = jest.fn(async () => {
    throw new Error('should not download');
  });
  await expect(
    videoFromUrl(
      { videoUrl: 'https://evil.example.com/a.mp4' },
      { downloadFile: blockedDownload },
    ),
  ).resolves.toEqual({ ok: false, reason: 'host_blocked' });
  expect(blockedDownload).not.toHaveBeenCalled();
});

it('allows a qualified ingredients-only auto-import only with its explicit gate', () => {
  const create = jest.fn((input: RecipeCreateInput): RecipeWithIngredients => savedRecipe(input.title));
  expect(() => commitAutoImportDraft(draft(5), { create })).toThrow(ImportCommitError);
  expect(() => commitAutoImportDraft(draft(5), { create, allowIngredientsOnly: true })).not.toThrow();
  expect(() => commitAutoImportDraft(draft(4), { create, allowIngredientsOnly: true })).toThrow(
    expect.objectContaining({ code: 'empty_recipe' }),
  );
});

it('formats diagnostics only in development and renders them as caption text', () => {
  const input = [{ stage: 'downloading_video' as const, code: 'video:http_403', detail: 'host=h cookie=no setCookieSeen=no' }];
  expect(diagnosticsText(input, true)).toBe('video:http_403 (host=h cookie=no setCookieSeen=no)');
  expect(diagnosticsText(input, false)).toBeNull();
  expect(diagnosticsText([], true)).toBeNull();

  const shareSource = fs.readFileSync(path.join(__dirname, '..', 'app', 'import', 'share.tsx'), 'utf8');
  expect(shareSource).toMatch(
    /<Text testID="share-import-diagnostics" variant="caption" tone="secondary">/,
  );
});
