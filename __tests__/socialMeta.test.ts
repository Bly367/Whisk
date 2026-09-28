import fs from 'node:fs';
import path from 'node:path';
import { fetchSocialMeta } from '@/import/social/socialMeta';

const fixture = (name: string) =>
  fs.readFileSync(path.join(__dirname, 'fixtures/social', name), 'utf8');

it('extracts and decodes an Instagram caption without crawler headers', async () => {
  const headers: HeadersInit[] = [];
  const meta = await fetchSocialMeta('https://instagram.com/reel/abc/', {
    fetchText: async (_url, options) => {
      headers.push(options?.headers ?? {});
      return {
        status: 200,
        finalUrl: 'https://instagram.com/reel/abc/',
        text: fixture('ig-caption.html'),
      };
    },
  });
  expect(meta.caption).toContain('Garlic butter pasta\n\n2 cups spaghetti');
  expect(JSON.stringify(headers).toLowerCase()).not.toContain('googlebot');
});

it('parses TikTok metadata, cookie, video, and linked URLs safely', async () => {
  const meta = await fetchSocialMeta('https://www.tiktok.com/@cook/video/1', {
    fetchText: async (url) =>
      url.includes('oembed')
        ? { status: 200, finalUrl: url, text: fixture('tiktok-oembed.json') }
        : {
            status: 200,
            finalUrl: url,
            text: fixture('tiktok-page-biolink.html'),
            setCookie: 'tt_chain_token=abc; Path=/',
          },
  });
  expect(meta.caption).toContain('Garlic butter pasta recipe');
  expect(meta.videoUrl).toContain('tiktokcdn');
  expect(meta.videoHeaders).toEqual({
    Referer: 'https://www.tiktok.com/',
    Cookie: 'tt_chain_token=abc',
  });
  expect(meta.linkedUrls).toEqual(['https://recipes.test/pasta']);
});
