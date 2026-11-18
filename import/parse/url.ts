const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;

const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'igsh',
  'fbclid',
  'ttclid',
];

export type DetectedSource =
  'website' | 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'pinterest';

export function extractUrl(input: string): string | null {
  const match = input.match(URL_PATTERN);
  if (!match) return null;
  return match[0].replace(/[),.;!?]+$/, '');
}

export function canonicalizeUrl(input: string): string {
  const extracted = extractUrl(input) ?? input.trim();
  let url: URL;
  try {
    url = new URL(extracted);
  } catch {
    throw new Error('Only public HTTP or HTTPS links can be imported.');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Only public HTTP or HTTPS links can be imported.');
  }

  url.hash = '';
  TRACKING_PARAMS.forEach((param) => url.searchParams.delete(param));
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  if (['instagr.am', 'm.instagram.com'].includes(url.hostname)) url.hostname = 'instagram.com';
  if (url.hostname === 'instagram.com') {
    const post = url.pathname.match(/^\/(?:[\w.]+\/)?(reels?|p|tv)\/([\w-]+)\/?$/i);
    if (post) url.pathname = `/${post[1].toLowerCase() === 'reels' ? 'reel' : post[1].toLowerCase()}/${post[2]}/`;
  }

  if (
    url.hostname === 'instagram.com' ||
    url.hostname.endsWith('.instagram.com') ||
    url.hostname === 'facebook.com' ||
    url.hostname.endsWith('.facebook.com')
  ) {
    url.search = '';
  }

  return url.toString();
}

export function detectSource(input: string): DetectedSource {
  const hostname = new URL(canonicalizeUrl(input)).hostname;

  if (hostname === 'instagram.com' || hostname.endsWith('.instagram.com')) {
    return 'instagram';
  }
  if (
    hostname === 'tiktok.com' ||
    hostname.endsWith('.tiktok.com') ||
    hostname === 'vm.tiktok.com' ||
    hostname === 'vt.tiktok.com'
  ) {
    return 'tiktok';
  }
  if (
    hostname === 'facebook.com' ||
    hostname.endsWith('.facebook.com') ||
    hostname === 'fb.watch'
  ) {
    return 'facebook';
  }
  if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com') || hostname === 'youtu.be') {
    return 'youtube';
  }
  if (hostname === 'pinterest.com' || hostname.endsWith('.pinterest.com')) {
    return 'pinterest';
  }
  return 'website';
}

export function isSocialSource(source: DetectedSource): boolean {
  return source !== 'website';
}
