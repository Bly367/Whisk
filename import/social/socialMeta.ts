import { canonicalizeUrl, detectSource, type DetectedSource } from '@/import/parse/url';
import { fetchText, type FetchTextOptions, type FetchTextResult } from '@/import/net/fetchText';

export type SocialMeta = {
  source: DetectedSource;
  canonicalUrl: string;
  caption?: string;
  author?: string;
  videoUrl?: string;
  videoHeaders?: Record<string, string>;
  linkedUrls: string[];
  blocked?: 'login_wall' | 'http_error';
};
export type SocialMetaDeps = {
  fetchText?: (url: string, options?: FetchTextOptions) => Promise<FetchTextResult>;
};
const decode = (s: string) =>
  s
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#10;|&#xA;/gi, '\n')
    .replace(/\\n/g, '\n')
    .replace(/&amp;/gi, '&')
    .replace(/&#x([\da-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const meta = (html: string, key: string) => {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']*)`, 'i');
  const rev = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${key}["']`,
    'i',
  );
  return decode(html.match(re)?.[1] ?? html.match(rev)?.[1] ?? '');
};
const directHttps = (value: unknown) =>
  typeof value === 'string' && value.startsWith('https://') && !value.includes('/embed/')
    ? value
    : undefined;
function links(text: string, extra?: string) {
  const found = `${text}\n${extra ?? ''}`.match(/https:\/\/[^\s<>"]+/gi) ?? [];
  const seen = new Set<string>();
  return found
    .map((url) => {
      try {
        return canonicalizeUrl(url.replace(/[),.;!?]+$/, ''));
      } catch {
        return '';
      }
    })
    .filter((url) => {
      if (!url || seen.has(url)) return false;
      seen.add(url);
      try {
        return ![
          'instagram.com',
          'tiktok.com',
          'youtube.com',
          'youtu.be',
          'facebook.com',
          'pinterest.com',
        ].some((h) => new URL(url).hostname.endsWith(h));
      } catch {
        return false;
      }
    })
    .slice(0, 3);
}
function rehydration(html: string): any {
  const raw = html.match(
    /<script[^>]+id=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/i,
  )?.[1];
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function fetchSocialMeta(
  inputUrl: string,
  deps: SocialMetaDeps = {},
): Promise<SocialMeta> {
  const get = deps.fetchText ?? fetchText;
  let url = canonicalizeUrl(inputUrl);
  const source = detectSource(url);
  let page: FetchTextResult;
  try {
    page = await get(url);
  } catch {
    return { source, canonicalUrl: url, linkedUrls: [], blocked: 'http_error' };
  }
  url = canonicalizeUrl(page.finalUrl || url);
  const html = page.text;
  let caption = meta(html, 'og:description') || meta(html, 'og:title') || meta(html, 'description');
  if (source === 'instagram' && caption)
    caption = caption
      .replace(/^[\d.,KkMm]+ likes?, [\d.,KkMm]+ comments? - \S+ on [^:]+: \"/i, '')
      .replace(/\"\.?$/, '')
      .trim();
  let videoUrl =
    directHttps(meta(html, 'og:video')) ?? directHttps(meta(html, 'og:video:secure_url'));
  let author: string | undefined;
  let videoHeaders: Record<string, string> | undefined;
  if (
    source === 'instagram' &&
    (!caption ||
      /\/accounts\/login/i.test(page.finalUrl) ||
      /<form[^>]+\/accounts\/login/i.test(html))
  ) {
    try {
      const embed = await get(`${url.replace(/\/$/, '')}/embed/captioned/`);
      const embeddedCaption = meta(embed.text, 'og:description') || meta(embed.text, 'description');
      if (embeddedCaption) caption = embeddedCaption;
    } catch {
      /* fall through */
    }
    if (!caption || /comment RECIPE/i.test(caption))
      return { source, canonicalUrl: url, linkedUrls: [], blocked: 'login_wall' };
  }
  if (source === 'tiktok') {
    try {
      const oembed = await get(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
      const title = JSON.parse(oembed.text).title;
      if (typeof title === 'string') caption = title;
    } catch {
      /* page metadata is enough */
    }
    const item =
      rehydration(html)?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct;
    if (item) {
      if (typeof item.desc === 'string' && item.desc.length > (caption?.length ?? 0))
        caption = item.desc;
      videoUrl = item.video?.playAddr || item.video?.downloadAddr || videoUrl;
      author = item.author?.bioLink?.link;
      const token = page.setCookie?.match(/(?:^|;\s*)tt_chain_token=([^;]+)/)?.[1];
      videoHeaders = {
        Referer: 'https://www.tiktok.com/',
        ...(token ? { Cookie: `tt_chain_token=${token}` } : {}),
      };
    }
  }
  return {
    source,
    canonicalUrl: url,
    caption: caption || undefined,
    author,
    videoUrl,
    videoHeaders,
    linkedUrls: links(caption ?? '', author),
  };
}
