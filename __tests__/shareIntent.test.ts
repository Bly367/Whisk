import { parseShareIntent } from '@/import/shareIntent';
import type { ShareIntent } from 'expo-share-intent';

describe('parseShareIntent', () => {
  it('should return null for null input', () => {
    expect(parseShareIntent(null)).toBeNull();
  });

  it('should return null for empty share intent', () => {
    const emptyIntent: ShareIntent = {
      text: null,
      webUrl: null,
      files: null,
      meta: undefined,
      type: null,
    };
    expect(parseShareIntent(emptyIntent)).toBeNull();
  });

  it('should parse URL-only share (webUrl field)', () => {
    const intent: ShareIntent = {
      text: null,
      webUrl: 'https://example.com/recipe',
      files: null,
      meta: undefined,
      type: 'weburl',
    };

    const result = parseShareIntent(intent);
    expect(result).toEqual({
      url: 'https://example.com/recipe',
      text: '',
      caption: undefined,
    });
  });

  it('should parse URL with caption from webUrl field', () => {
    const intent: ShareIntent = {
      text: 'Check out this amazing recipe! https://example.com/recipe',
      webUrl: 'https://example.com/recipe',
      files: null,
      meta: undefined,
      type: 'weburl',
    };

    const result = parseShareIntent(intent);
    expect(result).toEqual({
      url: 'https://example.com/recipe',
      text: 'Check out this amazing recipe! https://example.com/recipe',
      caption: 'Check out this amazing recipe!',
    });
  });

  it('should extract URL from text when webUrl is not provided', () => {
    const intent: ShareIntent = {
      text: 'Amazing recipe here: https://example.com/recipe Try it out!',
      webUrl: null,
      files: null,
      meta: undefined,
      type: 'text',
    };

    const result = parseShareIntent(intent);
    expect(result).toEqual({
      url: 'https://example.com/recipe',
      text: 'Amazing recipe here: https://example.com/recipe Try it out!',
      caption: 'Amazing recipe here:  Try it out!',
    });
  });

  it('should handle text-only share without URL', () => {
    const intent: ShareIntent = {
      text: 'Mix flour and eggs together, bake at 350F',
      webUrl: null,
      files: null,
      meta: undefined,
      type: 'text',
    };

    const result = parseShareIntent(intent);
    expect(result).toEqual({
      text: 'Mix flour and eggs together, bake at 350F',
      caption: 'Mix flour and eggs together, bake at 350F',
    });
  });

  it('should handle Instagram share URL pattern', () => {
    const intent: ShareIntent = {
      text: 'Amazing pasta recipe! https://www.instagram.com/p/ABC123/',
      webUrl: 'https://www.instagram.com/p/ABC123/',
      files: null,
      meta: undefined,
      type: 'weburl',
    };

    const result = parseShareIntent(intent);
    expect(result).toEqual({
      url: 'https://www.instagram.com/p/ABC123/',
      text: 'Amazing pasta recipe! https://www.instagram.com/p/ABC123/',
      caption: 'Amazing pasta recipe!',
    });
  });

  it('should handle TikTok share URL pattern', () => {
    const intent: ShareIntent = {
      text: 'https://www.tiktok.com/@user/video/123456789',
      webUrl: 'https://www.tiktok.com/@user/video/123456789',
      files: null,
      meta: undefined,
      type: 'weburl',
    };

    const result = parseShareIntent(intent);
    expect(result).toEqual({
      url: 'https://www.tiktok.com/@user/video/123456789',
      text: 'https://www.tiktok.com/@user/video/123456789',
      caption: undefined,
    });
  });

  it('should handle YouTube share URL pattern', () => {
    const intent: ShareIntent = {
      text: 'Check this out: https://youtu.be/dQw4w9WgXcQ',
      webUrl: 'https://youtu.be/dQw4w9WgXcQ',
      files: null,
      meta: undefined,
      type: 'weburl',
    };

    const result = parseShareIntent(intent);
    expect(result).toEqual({
      url: 'https://youtu.be/dQw4w9WgXcQ',
      text: 'Check this out: https://youtu.be/dQw4w9WgXcQ',
      caption: 'Check this out:',
    });
  });

  it('should handle browser share with URL only', () => {
    const intent: ShareIntent = {
      text: 'https://www.allrecipes.com/recipe/12345/chocolate-cake/',
      webUrl: 'https://www.allrecipes.com/recipe/12345/chocolate-cake/',
      files: null,
      meta: undefined,
      type: 'weburl',
    };

    const result = parseShareIntent(intent);
    expect(result).toEqual({
      url: 'https://www.allrecipes.com/recipe/12345/chocolate-cake/',
      text: 'https://www.allrecipes.com/recipe/12345/chocolate-cake/',
      caption: undefined,
    });
  });

  it('should trim whitespace from caption', () => {
    const intent: ShareIntent = {
      text: '  Great recipe!  https://example.com/recipe  ',
      webUrl: 'https://example.com/recipe',
      files: null,
      meta: undefined,
      type: 'weburl',
    };

    const result = parseShareIntent(intent);
    expect(result).toEqual({
      url: 'https://example.com/recipe',
      text: 'Great recipe!  https://example.com/recipe',
      caption: 'Great recipe!',
    });
  });

  it('should handle caption identical to URL', () => {
    const intent: ShareIntent = {
      text: 'https://example.com/recipe',
      webUrl: 'https://example.com/recipe',
      files: null,
      meta: undefined,
      type: 'weburl',
    };

    const result = parseShareIntent(intent);
    expect(result).toEqual({
      url: 'https://example.com/recipe',
      text: 'https://example.com/recipe',
      caption: undefined,
    });
  });

  it('should handle multi-line caption with URL', () => {
    const intent: ShareIntent = {
      text: 'Best chocolate cake recipe!\n\nIngredients: flour, sugar, cocoa\n\nhttps://example.com/recipe',
      webUrl: 'https://example.com/recipe',
      files: null,
      meta: undefined,
      type: 'weburl',
    };

    const result = parseShareIntent(intent);
    expect(result?.url).toBe('https://example.com/recipe');
    expect(result?.caption).toContain('Best chocolate cake recipe');
    expect(result?.caption).toContain('Ingredients');
  });
});
