import fs from 'node:fs';
import path from 'node:path';

import { runAutoImport, type AutoImportDeps } from '@/import/autoImport';
import { fetchSocialMeta } from '@/import/social/socialMeta';
import type { ImportDraft } from '@/import/types';

const fixture = (name: string) => fs.readFileSync(path.join(__dirname, 'fixtures/social', name), 'utf8');
const reelUrl = 'https://www.instagram.com/reel/FIXTURE123/';
const localVideo = 'file:///private/var/mobile/Containers/Shared/AppGroup/shared/reel.mp4';
const transcript =
  "Today we're making lemon garlic chicken orzo. First, sear the chicken in butter until golden. " +
  'Then add the garlic and the orzo and toast it for one minute. ' +
  'Pour in the chicken broth and simmer for 12 minutes. Finish with lemon juice and serve.';

const instagramPages = (pages: { reel: string; embed?: string }) => {
  const calls: string[] = [];
  const fetchText = async (url: string) => {
    calls.push(url);
    const text = url.includes('/embed/captioned/') ? (pages.embed ?? '') : pages.reel;
    return { status: 200, finalUrl: url, text };
  };
  return { calls, fetchSocialMeta: (url: string) => fetchSocialMeta(url, { fetchText }) };
};

const transcribed = () =>
  jest.fn(async () => ({
    ok: true as const,
    transcript,
    metadata: { text: transcript, durationMs: 1, segments: [] },
  }));

const deps = (overrides: AutoImportDeps): AutoImportDeps => ({
  videoFromUrl: jest.fn(async () => {
    throw new Error('Instagram CDN video must not be downloaded');
  }),
  websiteImport: jest.fn(async () => ({ ok: false as const })),
  commitImportDraft: jest.fn((_draft: ImportDraft) => ({ id: 'saved' })),
  ...overrides,
});

describe('Instagram Reel share with an attached video', () => {
  it('saves a passing Reel caption without transcribing the attached video', async () => {
    const pages = instagramPages({ reel: fixture('ig-reel-recipe-caption.html') });
    const fetchMeta = jest.fn(pages.fetchSocialMeta);
    const transcribeVideo = transcribed();
    const stages: string[] = [];
    const options = deps({ fetchSocialMeta: fetchMeta, transcribeVideo });

    const result = await runAutoImport(
      { url: reelUrl, videoPath: localVideo, sourceName: reelUrl },
      options,
      (stage) => stages.push(stage),
    );

    expect(fetchMeta).toHaveBeenCalledWith(reelUrl);
    expect(result).toEqual(expect.objectContaining({ ok: true, source: 'caption', lowConfidence: false }));
    if (result.ok) {
      expect(result.draft.title).toBe('Lemon Garlic Chicken Orzo');
      expect(result.draft.ingredients.length).toBeGreaterThanOrEqual(6);
      expect(result.draft.instructions.length).toBeGreaterThanOrEqual(4);
      expect(result.draft.sourceName).toBe('instagram');
    }
    expect(transcribeVideo).not.toHaveBeenCalled();
    expect(options.videoFromUrl).not.toHaveBeenCalled();
    expect(pages.calls.some((url) => url.includes('/embed/captioned/'))).toBe(false);
    expect(stages).toEqual(['receiving', 'fetching_caption', 'saving', 'saved']);
  });

  it('transcribes the local video and merges it with an ingredients-only caption', async () => {
    const pages = instagramPages({ reel: fixture('ig-reel-ingredients-only.html') });
    const transcribeVideo = transcribed();
    const options = deps({ fetchSocialMeta: pages.fetchSocialMeta, transcribeVideo });

    const result = await runAutoImport({ url: reelUrl, videoPath: localVideo, sourceName: reelUrl }, options);

    expect(transcribeVideo).toHaveBeenCalledWith(localVideo, expect.anything());
    expect(options.videoFromUrl).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ ok: true, source: 'caption+audio' }));
    if (result.ok) {
      expect(result.draft.title).toBe('Lemon Garlic Chicken Orzo');
      expect(result.draft.ingredients.map((item) => item.name)).toEqual(
        expect.arrayContaining(['chicken thighs', 'orzo', 'chicken broth']),
      );
      expect(result.draft.instructions.length).toBeGreaterThanOrEqual(2);
      expect(result.draft.instructions.map((step) => step.text).join(' ')).toMatch(/simmer/i);
      expect(result.draft.sourceName).toBe('instagram');
    }
  });

  it('transcribes the local video when the Reel caption is missing behind a login wall', async () => {
    const pages = instagramPages({ reel: fixture('ig-login-wall.html'), embed: '<html></html>' });
    const transcribeVideo = transcribed();
    const options = deps({ fetchSocialMeta: pages.fetchSocialMeta, transcribeVideo });

    const result = await runAutoImport({ url: reelUrl, videoPath: localVideo, sourceName: reelUrl }, options);

    expect(pages.calls).toEqual([reelUrl, `${reelUrl}embed/captioned/`]);
    expect(transcribeVideo).toHaveBeenCalledWith(localVideo, expect.anything());
    expect(options.videoFromUrl).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ ok: true, source: 'audio', lowConfidence: true }));
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'meta:blocked:login_wall' })]),
    );
    expect(result.diagnostics).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'video:no_video_url' })]),
    );
  });

  it('transcribes the local video when the caption has no recipe and fails without a CDN download', async () => {
    const pages = instagramPages({ reel: fixture('ig-empty-caption.html') });
    const transcribeVideo = jest.fn(async () => ({
      ok: false as const,
      error: { code: 'transcription_failed' as const, message: 'fixture' },
    }));
    const options = deps({ fetchSocialMeta: pages.fetchSocialMeta, transcribeVideo });

    const result = await runAutoImport({ url: reelUrl, videoPath: localVideo, sourceName: reelUrl }, options);

    expect(pages.calls).toEqual([reelUrl]);
    expect(transcribeVideo).toHaveBeenCalledWith(localVideo, expect.anything());
    expect(options.videoFromUrl).not.toHaveBeenCalled();
    expect(options.commitImportDraft).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ ok: false, reason: "Couldn't find a recipe in this post" }));
    // The video was already shared, so "save the Reel and share it from Photos" would not help.
    expect(result.hints).toBeUndefined();
  });

  it('treats a bare instagram.com Reel URL the same way', async () => {
    const pages = instagramPages({ reel: fixture('ig-reel-recipe-caption.html') });
    const transcribeVideo = jest.fn(async () => {
      throw new Error('should not transcribe');
    });

    const result = await runAutoImport(
      { url: 'https://instagram.com/reel/FIXTURE123', videoPath: localVideo },
      deps({ fetchSocialMeta: pages.fetchSocialMeta, transcribeVideo }),
    );

    expect(result).toEqual(expect.objectContaining({ ok: true, source: 'caption' }));
    expect(transcribeVideo).not.toHaveBeenCalled();
  });
});

describe('non-Instagram shares keep their current local-video behavior', () => {
  it('does not fetch TikTok metadata when a TikTok share includes a video file', async () => {
    const fetchMeta = jest.fn();
    const transcribeVideo = transcribed();

    const result = await runAutoImport(
      { url: 'https://www.tiktok.com/@cook/video/1', videoPath: localVideo, sourceName: 'https://www.tiktok.com/@cook/video/1' },
      deps({ fetchSocialMeta: fetchMeta, transcribeVideo }),
    );

    expect(fetchMeta).not.toHaveBeenCalled();
    expect(transcribeVideo).toHaveBeenCalledWith(localVideo, expect.anything());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.draft.sourceName).toBe('https://www.tiktok.com/@cook/video/1');
  });

  it('does not fetch metadata for a Photos-only video share', async () => {
    const fetchMeta = jest.fn();
    const transcribeVideo = transcribed();

    const result = await runAutoImport(
      { videoPath: localVideo, sourceName: 'Photos' },
      deps({ fetchSocialMeta: fetchMeta, transcribeVideo }),
    );

    expect(fetchMeta).not.toHaveBeenCalled();
    expect(transcribeVideo).toHaveBeenCalledWith(localVideo, expect.anything());
    expect(result).toEqual(expect.objectContaining({ ok: true, source: 'audio' }));
    if (result.ok) expect(result.draft.sourceName).toBe('Photos');
  });

  it('keeps the save-the-Reel hint for an Instagram URL-only share with no caption or video', async () => {
    const pages = instagramPages({ reel: fixture('ig-empty-caption.html') });
    const transcribeVideo = jest.fn();

    const result = await runAutoImport({ url: reelUrl }, deps({ fetchSocialMeta: pages.fetchSocialMeta, transcribeVideo }));

    expect(result).toEqual(expect.objectContaining({ ok: false, hints: ['ig_save_reel'] }));
    expect(transcribeVideo).not.toHaveBeenCalled();
  });
});
