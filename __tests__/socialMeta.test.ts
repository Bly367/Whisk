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

it('keeps only the TikTok chain cookie from combined Set-Cookie values', async () => {
  let oembedUrl = '';
  const meta = await fetchSocialMeta('https://www.tiktok.com/@cook/video/1', {
    fetchText: async (url) => {
      oembedUrl = url.includes('oembed') ? url : oembedUrl;
      return url.includes('oembed')
        ? { status: 200, finalUrl: url, text: fixture('tiktok-oembed.json') }
        : { status: 200, finalUrl: url, text: fixture('tiktok-page.html'), setCookie: 'ttwid=a; Path=/; HttpOnly; Secure, tt_csrf_token=b; path=/, tt_chain_token=Z; path=/' };
    },
  });
  expect(meta.videoHeaders?.Cookie).toBe('tt_chain_token=Z');
  expect(oembedUrl).toContain('https://www.tiktok.com/');
});

it('decodes metadata entities, removes a trailing quote, and drops private caption links', async () => {
  const meta = await fetchSocialMeta('https://instagram.com/reel/abc/', {
    fetchText: async () => ({
      status: 200,
      finalUrl: 'https://instagram.com/reel/abc/',
      text: '<meta property="og:description" content="A recipe &#x1f91d; https://192.168.1.1/&quot;." />',
    }),
  });
  expect(meta.caption).toBe('A recipe 🤝 https://192.168.1.1/.');
  expect(meta.caption).not.toMatch(/"$/);
  expect(meta.linkedUrls).toEqual([]);
});

it('marks an Instagram login wall blocked when the embed has no caption', async () => {
  const meta = await fetchSocialMeta('https://instagram.com/reel/abc/', {
    fetchText: async (url) => ({ status: 200, finalUrl: url, text: fixture('ig-login-wall.html') }),
  });
  expect(meta.blocked).toBe('login_wall');
});
