import fs from 'node:fs';
import path from 'node:path';

import { commitAutoImportDraft, ImportCommitError } from '@/import/commit';
import { diagnosticsText, runAutoImport, subtitleText } from '@/import/autoImport';
import { fetchSocialMeta } from '@/import/social/socialMeta';
import { videoFromUrl } from '@/import/social/videoFromUrl';
import type { TranscribeVideoError } from '@/import/transcribe';

const fixture = (name: string) => fs.readFileSync(path.join(__dirname, 'fixtures/social', name), 'utf8');
const tortellini = fixture('tiktok-tortellini-contents.txt');
const mtUrl = 'https://v16m-webapp.tiktokcdn-us.com/fixture-mt/?a=1988';
const videoUrl = 'https://v16-webapp-prime.us.tiktok.com/video/tos/useast5/fixture/?a=1988';
const mtVtt = `WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nCook your Italian sausage\n\n00:00:01.000 --> 00:00:02.000\nAdd in your tomato paste\n\n00:00:02.000 --> 00:00:03.000\nPour in your cream\n\n00:00:03.000 --> 00:00:04.000\nAdd chicken broth and cooked sausage\n\n00:00:04.000 --> 00:00:05.000\nStir well\n\n00:00:05.000 --> 00:00:06.000\nSimmer gently\n\n00:00:06.000 --> 00:00:07.000\nAdd tortellini\n\n00:00:07.000 --> 00:00:08.000\nServe hot`;
const page = (tracks: unknown, cookie = true) => {
  const item = { desc: tortellini, contents: [{ desc: tortellini }], video: { playAddr: videoUrl, ...(tracks === undefined ? {} : { subtitleInfos: tracks }) } };
  const html = `<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify({ __DEFAULT_SCOPE__: { 'webapp.video-detail': { itemInfo: { itemStruct: item } } } })}</script>`;
  return async (url: string) => url === mtUrl ? { status: 200, finalUrl: url, text: mtVtt } : { status: 200, finalUrl: 'https://www.tiktok.com/@cook/video/1', text: html, ...(cookie ? { setCookie: 'tt_chain_token=abc==; path=/' } : {}) };
};
const draft = (ingredients: number) => ({ id: 'd', title: 'Soup', sourceKind: 'share_sheet' as const, sourceUrl: null, sourceName: null, imageUri: null, notes: null, servings: null, prepMinutes: null, cookMinutes: null, ingredients: Array.from({ length: ingredients }, (_, position) => ({ name: `item ${position}`, quantity: '1', unit: 'cup', position })), instructions: [], confidence: { title: 'medium' as const, ingredients: 'medium' as const, instructions: 'unknown' as const }, warnings: [], sourceEvidence: '', adapterId: 'test', createdAt: '2026-01-01T00:00:00.000Z' });

it('uses an English MT subtitle while ASR wins and ignores non-English tracks', async () => {
  const tracks = [{ Format: 'webvtt', LanguageCodeName: 'eng-US', Source: 'MT', Url: mtUrl }];
  const meta = await fetchSocialMeta('https://www.tiktok.com/@cook/video/1', { fetchText: page(tracks) });
  expect(meta).toEqual(expect.objectContaining({ transcriptUrl: mtUrl, transcriptSource: 'MT' }));
  const asr = await fetchSocialMeta('https://www.tiktok.com/@cook/video/1', { fetchText: page([{ ...tracks[0], Source: 'MT' }, { ...tracks[0], Source: 'ASR', Url: 'https://v16m-webapp.tiktokcdn-us.com/asr' }]) });
  expect(asr.transcriptSource).toBe('ASR');
  const spanish = await fetchSocialMeta('https://www.tiktok.com/@cook/video/1', { fetchText: page([{ ...tracks[0], LanguageCodeName: 'spa-ES' }]) });
  expect(spanish.transcriptUrl).toBeUndefined();
});

it('merges MT subtitle steps into the tortellini caption without downloading', async () => {
  const fetchText = page([{ Format: 'webvtt', LanguageCodeName: 'eng-US', Source: 'MT', Url: mtUrl }]);
  const download = jest.fn();
  const result = await runAutoImport({ url: 'https://www.tiktok.com/@cook/video/1' }, { fetchSocialMeta: (url) => fetchSocialMeta(url, { fetchText }), fetchText, videoFromUrl: download, commitImportDraft: jest.fn(() => ({ id: 'saved' })) });
  expect(result).toEqual(expect.objectContaining({ ok: true, source: 'caption+audio' }));
  if (result.ok) { expect(result.draft.title).toBe('Creamy, Spicy Tortellini and Sausage Soup'); expect(result.draft.ingredients).toHaveLength(25); expect(result.draft.instructions.length).toBeGreaterThanOrEqual(8); expect(result.draft.instructions.map((s) => s.text)).toEqual(expect.arrayContaining(['Cook your Italian sausage.', 'Add in your tomato paste.', 'Pour in your cream.'])); }
  expect(download).not.toHaveBeenCalled();
});

it('keeps punctuated ASR subtitle text unchanged', () => {
  expect(subtitleText(`WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.000\nToday we're making dinner,\n\n2\n00:00:01.000 --> 00:00:02.000\nbeef bulgogi.\n\n3\n00:00:02.000 --> 00:00:03.000\nAdd the beef.`)).toBe("Today we're making dinner, beef bulgogi. Add the beef.");
  expect(subtitleText('WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nAdd my onions.')).toBe('Add my onions.');
});

it('records 403 download diagnostics without leaking the TikTok cookie and keeps the caption', async () => {
  for (const cookie of [false, true]) {
    const fetchText = page(undefined, cookie); const commit = jest.fn(() => ({ id: 'saved' }));
    const result = await runAutoImport({ url: 'https://www.tiktok.com/@cook/video/1' }, { fetchSocialMeta: (url) => fetchSocialMeta(url, { fetchText }), videoFromUrl: async () => ({ ok: false as const, reason: 'http_403' as const, detail: 'Unable to download file: response has status 403' }), commitImportDraft: commit });
    expect(result).toEqual(expect.objectContaining({ ok: true, source: 'caption', lowConfidence: true }));
    expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'subtitle:no_track', detail: 'none' }), expect.objectContaining({ code: 'video:http_403' })]));
    expect(JSON.stringify(result)).not.toContain('abc=='); expect(commit).toHaveBeenCalledWith(expect.anything(), { allowIngredientsOnly: true });
  }
});

it('records failed native transcription error codes', async () => {
  const errors: TranscribeVideoError[] = [
    { code: 'audio_extraction_failed', message: 'x', details: { code: 'file_not_found', message: 'x' } },
    { code: 'transcription_failed', message: 'x', details: { code: 'model_not_downloaded', message: 'x' } },
  ];
  for (const error of errors) {
    const result = await runAutoImport({ url: 'https://instagram.com/reel/1' }, { fetchSocialMeta: async () => ({ source: 'instagram', canonicalUrl: 'https://instagram.com/reel/1', linkedUrls: [], videoUrl: 'https://cdninstagram.com/a.mp4' }), videoFromUrl: async () => ({ ok: true as const, uri: '/a', cleanup: async () => {} }), transcribeVideo: async () => ({ ok: false as const, error }) });
    expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: `transcribe:${error.code}:${error.details?.code ?? ''}` })]));
  }
});

it('still fails for a too-thin ingredients-only caption after a download failure', async () => {
  const result = await runAutoImport({ url: 'https://instagram.com/reel/1' }, { fetchSocialMeta: async () => ({ source: 'instagram', canonicalUrl: 'https://instagram.com/reel/1', caption: 'Ingredients:\n1 cup flour\n1 cup milk\n1 egg', linkedUrls: [], videoUrl: 'https://cdninstagram.com/a.mp4' }), videoFromUrl: async () => ({ ok: false as const, reason: 'http_403' as const }) });
  expect(result).toEqual(expect.objectContaining({ ok: false })); expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'caption:not_saveable' }), expect.objectContaining({ code: 'video:http_403' })]));
});

it('sanitizes native video details and blocks unallowlisted HTTPS hosts', async () => {
  await expect(videoFromUrl({ videoUrl: 'https://v16.tiktokcdn.com/a.mp4' }, { includeDetail: true, downloadFile: async () => { throw new Error('Unable to download file: response has status 403 https://v16-webapp-prime.us.tiktok.com/x?sig=1'); } })).resolves.toEqual(expect.objectContaining({ ok: false, reason: 'http_403', detail: expect.not.stringContaining('https://') }));
  await expect(videoFromUrl({ videoUrl: 'https://evil.example.com/a.mp4' })).resolves.toEqual({ ok: false, reason: 'host_blocked' });
});

it('allows a qualified ingredients-only auto-import only with its explicit gate', () => {
  const create = jest.fn(() => ({ id: 'saved' }));
  expect(() => commitAutoImportDraft(draft(5), { create })).toThrow(ImportCommitError);
  expect(() => commitAutoImportDraft(draft(5), { create, allowIngredientsOnly: true })).not.toThrow();
  expect(() => commitAutoImportDraft(draft(4), { create, allowIngredientsOnly: true })).toThrow(expect.objectContaining({ code: 'empty_recipe' }));
});

it('formats diagnostics only in development', () => {
  const input = [{ stage: 'downloading_video' as const, code: 'video:http_403', detail: 'host=h cookie=no setCookieSeen=no' }];
  expect(diagnosticsText(input, true)).toBe('video:http_403 (host=h cookie=no setCookieSeen=no)');
  expect(diagnosticsText(input, false)).toBeNull(); expect(diagnosticsText([], true)).toBeNull();
});
