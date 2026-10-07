import fs from 'node:fs';
import path from 'node:path';
import { fetchSocialMeta } from '@/import/social/socialMeta';

const fixture = (name: string) =>
  fs.readFileSync(path.join(__dirname, 'fixtures/social', name), 'utf8');

const bulgogiPage = () => {
  const contents = fixture('tiktok-bulgogi-contents.txt').split('\n').map((desc) => ({ desc, textExtra: [] }));
  const flattened = contents.map((item) => item.desc).join(' ');
  return `<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify({ __DEFAULT_SCOPE__: { 'webapp.video-detail': { statusCode: 0, itemInfo: { itemStruct: { id: '7682480880035712270', desc: flattened, contents, author: { uniqueId: 'alissanguyen_' }, video: { playAddr: 'https://v16-webapp-prime.us.tiktok.com/video/tos/useast5/fixture/?a=1988', subtitleInfos: [{ LanguageCodeName: 'eng-US', Format: 'webvtt', Source: 'ASR', Url: 'https://v16m-webapp.tiktokcdn-us.com/fixture-subs/?a=1988' }] } } } } } })}</script>`;
};

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
  expect(meta.caption).toBe('Try this!');
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
        : { status: 200, finalUrl: url, text: '<html></html>', setCookie: 'ttwid=a; Path=/; HttpOnly; Secure, tt_csrf_token=b; path=/, tt_chain_token=Z; path=/' };
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

it('uses TikTok contents lines and exposes the ASR subtitle track', async () => {
  const meta = await fetchSocialMeta('https://www.tiktok.com/t/ZTyUnvJyg/', {
    fetchText: async (url) => url.includes('oembed')
      ? { status: 200, finalUrl: url, text: JSON.stringify({ title: fixture('tiktok-bulgogi-contents.txt').replace(/\n/g, ' ') }) }
      : { status: 200, finalUrl: 'https://www.tiktok.com/@alissanguyen_/video/7682480880035712270?_r=1', text: bulgogiPage(), setCookie: 'tt_chain_token=abc; path=/; secure; httponly' },
  });
  expect(meta.caption).toContain('\nINGREDIENTS\n');
  expect(meta.caption).toContain('\n1 lb ground beef\n');
  expect(meta.transcriptUrl).toContain('tiktokcdn-us.com');
});
