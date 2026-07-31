import { RecipeSource } from '../../types/recipe';

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

export function extractUrl(input: string): string | null {
  const match = input.match(URL_PATTERN);
  if (!match) return null;
  return match[0].replace(/[),.;!?]+$/, '');
}

export function canonicalizeUrl(input: string): string {
  const extracted = extractUrl(input) ?? input.trim();
  const url = new URL(extracted);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Only public HTTP or HTTPS links can be imported.');
  }

  url.hash = '';
  TRACKING_PARAMS.forEach((param) => url.searchParams.delete(param));
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');

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

export function detectSource(input: string): RecipeSource {
  const hostname = new URL(canonicalizeUrl(input)).hostname;
  if (hostname === 'instagram.com' || hostname.endsWith('.instagram.com')) return 'instagram';
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
  return 'url';
}

export function isSocialSource(source: RecipeSource): boolean {
  return source === 'instagram' || source === 'tiktok' || source === 'facebook';
}
