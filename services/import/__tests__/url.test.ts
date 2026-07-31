import { describe, expect, it } from 'vitest';
import { canonicalizeUrl, detectSource, extractUrl } from '../url';

describe('shared URL normalization', () => {
  it('extracts a URL from social share text', () => {
    expect(
      extractUrl('Watch this reel https://www.instagram.com/reel/ABC123/?igsh=tracking'),
    ).toBe('https://www.instagram.com/reel/ABC123/?igsh=tracking');
  });

  it('removes tracking and normalizes Instagram hosts', () => {
    expect(
      canonicalizeUrl('https://www.instagram.com/reel/ABC123/?igsh=abc&utm_source=test'),
    ).toBe('https://instagram.com/reel/ABC123/');
  });

  it('detects supported social sources', () => {
    expect(detectSource('https://vm.tiktok.com/abc/')).toBe('tiktok');
    expect(detectSource('https://fb.watch/abc/')).toBe('facebook');
    expect(detectSource('https://example.com/recipe')).toBe('url');
  });

  it('rejects non-http protocols', () => {
    expect(() => canonicalizeUrl('file:///etc/passwd')).toThrow();
  });
});
