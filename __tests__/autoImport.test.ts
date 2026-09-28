import { runAutoImport } from '@/import/autoImport';
import fs from 'node:fs';
import path from 'node:path';
import { fetchSocialMeta } from '@/import/social/socialMeta';

const socialFixture = (name: string) => fs.readFileSync(path.join(__dirname, 'fixtures/social', name), 'utf8');
const bulgogiHtml = (caption = socialFixture('tiktok-bulgogi-contents.txt')) => {
  const contents = caption.split('\n').map((desc) => ({ desc, textExtra: [] }));
  const item = { id: '7682480880035712270', desc: contents.map((entry) => entry.desc).join(' '), contents, author: { uniqueId: 'alissanguyen_' }, video: { playAddr: 'https://v16-webapp-prime.us.tiktok.com/video/fixture.mp4', subtitleInfos: [{ LanguageCodeName: 'eng-US', Format: 'webvtt', Source: 'ASR', Url: 'https://v16m-webapp.tiktokcdn-us.com/fixture-subs/?a=1988' }] } };
  return `<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify({ __DEFAULT_SCOPE__: { 'webapp.video-detail': { itemInfo: { itemStruct: item } } } })}</script>`;
};
const bulgogiDeps = (caption = socialFixture('tiktok-bulgogi-contents.txt'), subtitle = '') => {
  const calls: string[] = [];
  return { calls, fetchText: async (url: string) => { calls.push(url); if (url.includes('oembed')) return { status: 200, finalUrl: url, text: JSON.stringify({ title: caption.replace(/\n/g, ' ') }) }; if (url.includes('fixture-subs')) return { status: 200, finalUrl: url, text: subtitle }; return { status: 200, finalUrl: 'https://www.tiktok.com/@alissanguyen_/video/7682480880035712270', text: bulgogiHtml(caption), setCookie: 'tt_chain_token=abc; path=/' }; } };
};

it('saves a passing caption before following its links', async () => {
  const stages: string[] = [];
  const websiteImport = jest.fn();
  const commit = jest.fn(() => ({ id: 'r1' }));
  const result = await runAutoImport(
    { url: 'https://instagram.com/reel/1' },
    {
      fetchSocialMeta: async () => ({
        source: 'instagram',
        canonicalUrl: 'https://instagram.com/reel/1',
        caption: 'Ingredients:\n1 cup flour\n2 eggs\n1 tsp salt\nDirections:\nMix.\nBake.',
        linkedUrls: ['https://recipes.test/a'],
      }),
      websiteImport,
      commitImportDraft: commit,
    },
    (stage) => stages.push(stage),
  );
  expect(result).toEqual(expect.objectContaining({ ok: true, source: 'caption' }));
  expect(websiteImport).not.toHaveBeenCalled();
  expect(stages).toEqual(['receiving', 'fetching_caption', 'saving', 'saved']);
});

it.each(['fetchSocialMeta', 'websiteImport', 'videoFromUrl', 'transcribeVideo'] as const)(
  'does not reject when %s throws',
  async (dependency) => {
    const deps: any = {
      fetchSocialMeta: async () => ({
        source: 'instagram',
        canonicalUrl: 'https://instagram.com/reel/1',
        linkedUrls: [],
      }),
    };
    if (dependency === 'fetchSocialMeta')
      deps.fetchSocialMeta = async () => {
        throw new Error('boom');
      };
    if (dependency === 'websiteImport') {
      deps.fetchSocialMeta = async () => ({
        source: 'instagram',
        canonicalUrl: 'https://instagram.com/reel/1',
        linkedUrls: ['https://recipes.test/a'],
      });
      deps.websiteImport = async () => {
        throw new Error('boom');
      };
    }
    if (dependency === 'videoFromUrl') {
      deps.fetchSocialMeta = async () => ({
        source: 'instagram',
        canonicalUrl: 'https://instagram.com/reel/1',
        linkedUrls: [],
        videoUrl: 'https://cdninstagram.com/a.mp4',
      });
      deps.videoFromUrl = async () => {
        throw new Error('boom');
      };
    }
    if (dependency === 'transcribeVideo') {
      deps.fetchSocialMeta = async () => ({
        source: 'instagram',
        canonicalUrl: 'https://instagram.com/reel/1',
        linkedUrls: [],
        videoUrl: 'https://cdninstagram.com/a.mp4',
      });
      deps.videoFromUrl = async () => ({ ok: true, uri: '/cache/a.mp4', cleanup: async () => {} });
      deps.transcribeVideo = async () => {
        throw new Error('boom');
      };
    }
    await expect(runAutoImport({ url: 'https://instagram.com/reel/1' }, deps)).resolves.toEqual(
      expect.objectContaining({ ok: false }),
    );
  },
);

it('imports TikTok contents with real social metadata before audio', async () => {
  const fixture = bulgogiDeps();
  const download = jest.fn();
  const transcribe = jest.fn();
  const result = await runAutoImport(
    { url: 'https://www.tiktok.com/t/ZTyUnvJyg/' },
    {
      fetchSocialMeta: (url) => fetchSocialMeta(url, { fetchText: fixture.fetchText }),
      videoFromUrl: download,
      transcribeVideo: transcribe,
      commitImportDraft: jest.fn(() => ({ id: 'bulgogi' })),
    },
  );
  expect(result).toEqual(expect.objectContaining({ ok: true, source: 'caption' }));
  if (result.ok) {
    expect(result.draft.title).toMatch(/ground beef bulgogi/i);
    expect(result.draft.ingredients.length).toBeGreaterThanOrEqual(12);
    expect(result.draft.instructions.length).toBeGreaterThanOrEqual(6);
    expect(result.draft.instructions.every((step) => !/^\d+[.)]\s/.test(step.text))).toBe(true);
  }
  expect(download).not.toHaveBeenCalled();
  expect(transcribe).not.toHaveBeenCalled();
});

it('saves a thin audio draft with the transcript and low confidence', async () => {
  const result = await runAutoImport(
    { url: 'https://www.tiktok.com/t/ZTyUnvJyg/' },
    {
      fetchSocialMeta: (url) => fetchSocialMeta(url, { fetchText: async (request) => request.includes('oembed') ? { status: 200, finalUrl: request, text: '{"title":""}' } : { status: 200, finalUrl: request, text: bulgogiHtml(''), setCookie: 'tt_chain_token=abc' } }),
      videoFromUrl: async () => ({ ok: true, uri: '/cache/video.mp4', cleanup: async () => {} }),
      transcribeVideo: async () => ({ ok: true, transcript: socialFixture('tiktok-bulgogi-whisper-tiny-en.txt'), metadata: { text: socialFixture('tiktok-bulgogi-whisper-tiny-en.txt'), durationMs: 1, segments: [] } }),
      commitImportDraft: jest.fn(() => ({ id: 'thin-audio' })),
    },
  );
  expect(result).toEqual(expect.objectContaining({ ok: true, source: 'audio', lowConfidence: true }));
  if (result.ok) expect(result.draft.notes).toMatch(/^Transcript:/);
});

it('reads TikTok ASR subtitles before downloading video', async () => {
  const fixture = bulgogiDeps('', 'WEBVTT\n\n00:00:00.000 --> 00:00:02.520\nAdd my onions.\n\n00:00:02.520 --> 00:00:05.000\nAdd in our ground beef.\n\n00:00:05.000 --> 00:00:07.000\nStir it.\n\n00:00:07.000 --> 00:00:09.000\nServe it over rice.');
  const download = jest.fn();
  const result = await runAutoImport({ url: 'https://www.tiktok.com/t/ZTyUnvJyg/' }, { fetchSocialMeta: (url) => fetchSocialMeta(url, { fetchText: fixture.fetchText }), fetchText: fixture.fetchText, videoFromUrl: download, commitImportDraft: jest.fn(() => ({ id: 'vtt' })) });
  expect(result).toEqual(expect.objectContaining({ ok: true, source: 'audio' }));
  expect(download).not.toHaveBeenCalled();
  expect(fixture.calls.some((url) => url.includes('fixture-subs'))).toBe(true);
});
