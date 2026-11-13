import { canonicalizeUrl, detectSource, type DetectedSource } from '@/import/parse/url';
import { fetchText, type FetchTextOptions, type FetchTextResult } from '@/import/net/fetchText';
import { isPublicHttpsUrl } from '@/import/net/publicUrl';

export type SocialMeta = {
  source: DetectedSource;
  canonicalUrl: string;
  caption?: string;
  author?: string;
  videoUrl?: string;
  transcriptUrl?: string;
  transcriptSource?: string;
  subtitleSummary?: string;
  setCookieSeen?: boolean;
  videoHeaders?: Record<string, string>;
  linkedUrls: string[];
  blocked?: 'login_wall' | 'http_error';
  trace?: InstagramTrace;
};
/** Fixed-vocabulary step outcomes; never holds URLs or caption text. */
export type InstagramTrace = { page: string; oembed: string; embed: string; caption: 'oembed' | 'page' | 'embed' | 'none' };
export type SocialMetaDeps = {
  fetchText?: (url: string, options?: FetchTextOptions) => Promise<FetchTextResult>;
};
const decode = (s: string) =>
  s
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#10;|&#xA;/gi, '\n')
    .replace(/&amp;/gi, '&')
    .replace(/&#x([\da-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
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
        const candidate = url.replace(/[),.;!?]+$/, '');
        return isPublicHttpsUrl(candidate) ? canonicalizeUrl(candidate) : '';
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

function isGenericInstagramText(text: string): boolean {
  return /^(?:instagram|login • instagram|create an account or log in to instagram\b.*|.{1,80} on instagram)$/is.test(text.trim());
}
function isTruncatedCaption(text: string): boolean {
  return /(?:\.\.\.|…)\s*(?:more)?\s*\.?$/i.test(text.trim());
}
function embedCaption(html: string): { caption: string; via: 'div' | 'json' | 'meta' } | null {
  const div = html.match(/<div class="Caption">([\s\S]*?)(?:<div class="CaptionComments"|<\/div>)/i)?.[1];
  if (div) {
    const text = decode(
      div
        .replace(/<a class="CaptionUsername"[\s\S]*?<\/a>/i, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ''),
    ).trim();
    if (text) return { caption: text, via: 'div' };
  }
  const at = html.indexOf('edge_media_to_caption');
  if (at >= 0) {
    let window = html.slice(at, at + 20_000);
    // Embed pages nest the media JSON inside a JS string, adding one level of escaping.
    if (html.slice(at - 2, at) === '\\"') window = window.replace(/\\(["\\/])/g, '$1');
    const raw = window.match(/^edge_media_to_caption":\{"edges":\[\{"node":\{"text":"((?:[^"\\]|\\.)*)"/)?.[1];
    if (raw) {
      try {
        const text = String(JSON.parse(`"${raw}"`)).trim();
        if (text) return { caption: text, via: 'json' };
      } catch {
        /* fall through to meta */
      }
    }
  }
  const metaCaption = meta(html, 'og:description') || meta(html, 'description');
  return metaCaption ? { caption: metaCaption, via: 'meta' } : null;
}

function instagramOEmbedParamUrl(canonicalReelUrl: string): string {
  const reel = new URL(canonicalReelUrl);
  reel.hostname = 'www.instagram.com';
  if (!reel.pathname.endsWith('/')) reel.pathname += '/';
  return reel.toString();
}

export async function fetchSocialMeta(
  inputUrl: string,
  deps: SocialMetaDeps = {},
): Promise<SocialMeta> {
  const get = deps.fetchText ?? fetchText;
  const requested = canonicalizeUrl(inputUrl);
  let url = requested;
  const source = detectSource(url);
  let page: FetchTextResult;
  let pageFailed = false;
  try {
    page = await get(url);
  } catch {
    if (source !== 'instagram')
      return { source, canonicalUrl: url, linkedUrls: [], blocked: 'http_error' };
    page = { status: 0, finalUrl: url, text: '' };
    pageFailed = true;
  }
  const landed = canonicalizeUrl(page.finalUrl || url);
  if (!(source === 'instagram' && /\/accounts\/login/i.test(landed))) url = landed;
  const html = page.text;
  let caption = meta(html, 'og:description') || meta(html, 'og:title') || meta(html, 'description');
  if (source === 'instagram' && caption)
    caption = caption
      .replace(/^[\d.,KkMm]+ likes?, [\d.,KkMm]+ comments? - \S+ on [^:]+: \"/i, '')
      .trim()
      .replace(/\"(?=\.?$)/, '')
      .trim();
  let videoUrl =
    directHttps(meta(html, 'og:video')) ?? directHttps(meta(html, 'og:video:secure_url'));
  let transcriptUrl: string | undefined;
  let transcriptSource: string | undefined;
  let subtitleSummary: string | undefined;
  let author: string | undefined;
  let videoHeaders: Record<string, string> | undefined;
  let trace: InstagramTrace | undefined;
  if (source === 'instagram') {
    const loginWall =
      /\/accounts\/login/i.test(landed) || /<form[^>]+\/accounts\/login/i.test(html);
    const pageCaption = loginWall || isGenericInstagramText(caption) ? '' : caption;
    trace = {
      page: pageFailed
        ? 'error'
        : loginWall
          ? 'login_wall'
          : page.status < 200 || page.status >= 300
            ? `http_${page.status}`
            : !pageCaption
              ? 'no_meta'
              : isTruncatedCaption(pageCaption)
                ? 'truncated'
                : 'ok',
      oembed: 'skip',
      embed: 'skip',
      caption: 'none',
    };
    caption = '';
    // The page meta is often missing or truncated; oEmbed carries the full caption with newlines.
    try {
      const oembed = await get(
        `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(instagramOEmbedParamUrl(url))}`,
        { headers: { Accept: 'application/json' } },
      );
      let data: { title?: unknown; author_name?: unknown } | null = null;
      try {
        data = JSON.parse(oembed.text);
      } catch {
        data = null;
      }
      if (oembed.status < 200 || oembed.status >= 300) trace.oembed = `http_${oembed.status}`;
      else if (!data) trace.oembed = 'not_json';
      else if (typeof data.title !== 'string' || !data.title.trim()) trace.oembed = 'no_title';
      else {
        trace.oembed = 'ok';
        caption = data.title;
        trace.caption = 'oembed';
        if (typeof data.author_name === 'string' && data.author_name.trim()) author = data.author_name;
      }
    } catch {
      trace.oembed = 'error';
    }
    if (!caption && pageCaption && !isTruncatedCaption(pageCaption)) {
      caption = pageCaption;
      trace.caption = 'page';
    }
    if (!caption) {
      try {
        const embed = await get(`${url.replace(/\/$/, '')}/embed/captioned/`);
        const found = embedCaption(embed.text);
        if (found) {
          caption = found.caption;
          trace.embed = `ok_${found.via}`;
          trace.caption = 'embed';
        } else trace.embed = embed.status < 200 || embed.status >= 300 ? `http_${embed.status}` : 'no_caption';
      } catch {
        trace.embed = 'error';
      }
    }
    if (!caption && pageCaption) {
      caption = pageCaption;
      trace.caption = 'page';
    }
    if (!caption) return { source, canonicalUrl: url, linkedUrls: [], blocked: 'login_wall', trace };
  }
  if (source === 'tiktok') {
    const item =
      rehydration(html)?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct;
    if (item) {
      const contents = Array.isArray(item.contents) ? item.contents : [];
      caption = contents.length > 1
        ? contents.map((entry: { desc?: string }) => entry.desc ?? '').join('\n')
        : typeof item.desc === 'string' ? item.desc : caption;
      videoUrl = item.video?.playAddr || item.video?.downloadAddr || videoUrl;
      const subtitles = Array.isArray(item.video?.subtitleInfos) ? item.video.subtitleInfos : [];
      subtitleSummary = subtitles.length
        ? subtitles.map((entry: { Source?: string; LanguageCodeName?: string; Format?: string }) => `${entry.Source ?? ''}:${entry.LanguageCodeName ?? ''}:${entry.Format ?? ''}`).join(', ')
        : 'none';
      const english = subtitles.filter((entry: { Format?: string; LanguageCodeName?: string; Url?: string }) =>
        entry.Format === 'webvtt' && entry.LanguageCodeName?.toLowerCase().startsWith('eng') && typeof entry.Url === 'string');
      const subtitle = english.find((entry: { Source?: string }) => entry.Source === 'ASR') ?? english[0];
      transcriptUrl = subtitle?.Url;
      transcriptSource = subtitle?.Source;
      author = item.author?.bioLink?.link;
    }
    if (!item) {
    try {
      const target = new URL(url);
      const oembed = await get(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(`https://www.tiktok.com${target.pathname}`)}`,
      );
      const title = JSON.parse(oembed.text).title;
      if (typeof title === 'string') caption = title;
    } catch {
      /* page metadata is enough */
    }
    }
    const token = page.setCookie?.match(/(?:^|[,;]\s*)tt_chain_token=([^;,\s]+)/)?.[1];
    videoHeaders = {
      Referer: 'https://www.tiktok.com/',
      ...(token ? { Cookie: `tt_chain_token=${token}` } : {}),
    };
  }
  return {
    source,
    canonicalUrl: url,
    caption: caption || undefined,
    author,
    videoUrl,
    transcriptUrl,
    transcriptSource,
    subtitleSummary,
    ...(source === 'tiktok' ? { setCookieSeen: Boolean(page.setCookie) } : {}),
    videoHeaders,
    linkedUrls: links(caption ?? '', author),
    ...(trace ? { trace } : {}),
  };
}
