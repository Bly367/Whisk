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
      caption: 'Amazing recipe here: Try it out!',
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

  it('should collapse multiple whitespace after URL removal', () => {
    const intent: ShareIntent = {
      text: 'Recipe here:  https://example.com/recipe  Try it!',
      webUrl: 'https://example.com/recipe',
      files: null,
      meta: undefined,
      type: 'weburl',
    };

    const result = parseShareIntent(intent);
    expect(result).toEqual({
      url: 'https://example.com/recipe',
      text: 'Recipe here:  https://example.com/recipe  Try it!',
      caption: 'Recipe here: Try it!',
    });
  });

  it('should preserve newlines but collapse inline whitespace after URL removal', () => {
    const intent: ShareIntent = {
      text: 'Amazing\t\trecipe\n\nhttps://example.com/recipe\n\nTry\t\t\tit!',
      webUrl: 'https://example.com/recipe',
      files: null,
      meta: undefined,
      type: 'weburl',
    };

    const result = parseShareIntent(intent);
    // Should preserve newlines but collapse tabs/spaces within lines
    expect(result?.caption).toBe('Amazing recipe\n\nTry it!');
  });

  it('should handle URL extraction with whitespace collapse', () => {
    const intent: ShareIntent = {
      text: 'Recipe:   https://example.com/recipe   Steps here',
      webUrl: null,
      files: null,
      meta: undefined,
      type: 'text',
    };

    const result = parseShareIntent(intent);
    expect(result?.url).toBe('https://example.com/recipe');
    expect(result?.caption).toBe('Recipe: Steps here');
  });

  it('should reject javascript: URLs', () => {
    const intent: ShareIntent = {
      text: 'javascript:alert("xss")',
      webUrl: 'javascript:alert("xss")',
      files: null,
      meta: undefined,
      type: 'weburl',
    };

    const result = parseShareIntent(intent);
    expect(result).toBeNull();
  });

  it('should reject file: URLs', () => {
    const intent: ShareIntent = {
      text: 'file:///etc/passwd',
      webUrl: 'file:///etc/passwd',
      files: null,
      meta: undefined,
      type: 'weburl',
    };

    const result = parseShareIntent(intent);
    expect(result).toBeNull();
  });

  it('should reject data: URLs', () => {
    const intent: ShareIntent = {
      text: 'data:text/html,<script>alert("xss")</script>',
      webUrl: 'data:text/html,<script>alert("xss")</script>',
      files: null,
      meta: undefined,
      type: 'weburl',
    };

    const result = parseShareIntent(intent);
    expect(result).toBeNull();
  });

  it('should reject vbscript: URLs', () => {
    const intent: ShareIntent = {
      text: 'vbscript:msgbox("xss")',
      webUrl: 'vbscript:msgbox("xss")',
      files: null,
      meta: undefined,
      type: 'weburl',
    };

    const result = parseShareIntent(intent);
    expect(result).toBeNull();
  });

  it('should allow http: and https: URLs', () => {
    const httpIntent: ShareIntent = {
      text: 'http://example.com/recipe',
      webUrl: 'http://example.com/recipe',
      files: null,
      meta: undefined,
      type: 'weburl',
    };

    const httpsIntent: ShareIntent = {
      text: 'https://example.com/recipe',
      webUrl: 'https://example.com/recipe',
      files: null,
      meta: undefined,
      type: 'weburl',
    };

    expect(parseShareIntent(httpIntent)).not.toBeNull();
    expect(parseShareIntent(httpsIntent)).not.toBeNull();
  });

  it('should reject URLs with mixed case hostile schemes', () => {
    const intent: ShareIntent = {
      text: 'JaVaScRiPt:alert("xss")',
      webUrl: 'JaVaScRiPt:alert("xss")',
      files: null,
      meta: undefined,
      type: 'weburl',
    };

    const result = parseShareIntent(intent);
    expect(result).toBeNull();
  });

  it('should preserve multiline Instagram-style caption with ingredients', () => {
    const intent: ShareIntent = {
      text: '🍝 Best Pasta Recipe!\n\nIngredients:\n- 1 lb pasta\n- 2 cups sauce\n- Fresh basil\n\nSteps:\n1. Boil water\n2. Cook pasta\n3. Add sauce\n\nhttps://www.instagram.com/p/ABC123/',
      webUrl: 'https://www.instagram.com/p/ABC123/',
      files: null,
      meta: undefined,
      type: 'weburl',
    };

    const result = parseShareIntent(intent);
    expect(result?.url).toBe('https://www.instagram.com/p/ABC123/');
    expect(result?.caption).toContain('🍝 Best Pasta Recipe!');
    expect(result?.caption).toContain('Ingredients:\n- 1 lb pasta');
    expect(result?.caption).toContain('Steps:\n1. Boil water');
    // Verify newlines are preserved
    const lines = result?.caption?.split('\n') || [];
    expect(lines.length).toBeGreaterThan(5);
  });

  it('should preserve multiline TikTok-style caption with steps', () => {
    const intent: ShareIntent = {
      text: 'Quick breakfast hack 🥞\n\nMix:\nFlour\nEggs\nMilk\n\nCook 3 min each side\n\nEnjoy! ❤️\n\nhttps://www.tiktok.com/@chef/video/123',
      webUrl: 'https://www.tiktok.com/@chef/video/123',
      files: null,
      meta: undefined,
      type: 'weburl',
    };

    const result = parseShareIntent(intent);
    expect(result?.caption).toContain('Quick breakfast hack');
    expect(result?.caption).toContain('Mix:\nFlour\nEggs\nMilk');
    expect(result?.caption).not.toContain('https://www.tiktok.com');
  });

  it('should trim leading/trailing whitespace but preserve internal newlines', () => {
    const intent: ShareIntent = {
      text: '\n\n  Recipe title\n\nStep 1\nStep 2\n\nhttps://example.com/recipe\n\n  ',
      webUrl: 'https://example.com/recipe',
      files: null,
      meta: undefined,
      type: 'weburl',
    };

    const result = parseShareIntent(intent);
    expect(result?.caption).toBe('Recipe title\n\nStep 1\nStep 2');
    // No leading or trailing whitespace
    expect(result?.caption?.startsWith(' ')).toBe(false);
    expect(result?.caption?.endsWith(' ')).toBe(false);
  });

  it('should collapse multiple spaces within a line but keep newlines', () => {
    const intent: ShareIntent = {
      text: 'Title    with    spaces\n\nLine 2  here\n\nhttps://example.com',
      webUrl: 'https://example.com',
      files: null,
      meta: undefined,
      type: 'weburl',
    };

    const result = parseShareIntent(intent);
    expect(result?.caption).toBe('Title with spaces\n\nLine 2 here');
  });

  it('should handle URL-only social share without inventing caption', () => {
    // Instagram often only provides URL, no caption
    const intent: ShareIntent = {
      text: 'https://www.instagram.com/p/ABC123/',
      webUrl: 'https://www.instagram.com/p/ABC123/',
      files: null,
      meta: undefined,
      type: 'weburl',
    };

    const result = parseShareIntent(intent);
    expect(result?.url).toBe('https://www.instagram.com/p/ABC123/');
    expect(result?.caption).toBeUndefined();
    expect(result?.text).toBe('https://www.instagram.com/p/ABC123/');
  });

  it('should preserve very long caption without truncation in parser', () => {
    const longCaption = 'Recipe intro\n\n' + 
      'Ingredients:\n' +
      Array(50).fill('- Ingredient item with description\n').join('') +
      '\nSteps:\n' +
      Array(30).fill('1. Step with detailed instructions here\n').join('');
    
    const intent: ShareIntent = {
      text: longCaption + '\nhttps://example.com/recipe',
      webUrl: 'https://example.com/recipe',
      files: null,
      meta: undefined,
      type: 'weburl',
    };

    const result = parseShareIntent(intent);
    // Parser should not truncate - handler will use store instead of query params
    expect(result?.caption).toContain('Recipe intro');
    expect(result?.caption?.length).toBeGreaterThan(1000);
    expect(result?.caption).toContain('Ingredient item');
    expect(result?.caption).toContain('detailed instructions');
  });

  it('should handle video file share with URL', () => {
    const intent: ShareIntent = {
      text: 'https://www.instagram.com/p/ABC123/',
      webUrl: 'https://www.instagram.com/p/ABC123/',
      files: [
        {
          path: 'file:///var/mobile/Containers/Data/Application/video.mp4',
          mimeType: 'video/mp4',
          fileName: 'video.mp4',
          size: 1024000,
          width: null,
          height: null,
          duration: null,
        },
      ],
      meta: undefined,
      type: 'media',
    };

    const result = parseShareIntent(intent);
    expect(result).toEqual({
      url: 'https://www.instagram.com/p/ABC123/',
      text: 'https://www.instagram.com/p/ABC123/',
      caption: undefined,
      videoPath: 'file:///var/mobile/Containers/Data/Application/video.mp4',
      mimeType: 'video/mp4',
    });
  });

  it('should handle video file share without URL', () => {
    const intent: ShareIntent = {
      text: null,
      webUrl: null,
      files: [
        {
          path: '/data/user/0/app.whisk.mobile/files/shared_video.mp4',
          mimeType: 'video/mp4',
          fileName: 'shared_video.mp4',
          size: 2048000,
          width: null,
          height: null,
          duration: null,
        },
      ],
      meta: undefined,
      type: 'media',
    };

    const result = parseShareIntent(intent);
    expect(result).toEqual({
      videoPath: '/data/user/0/app.whisk.mobile/files/shared_video.mp4',
      mimeType: 'video/mp4',
    });
  });

  it('should handle image file share', () => {
    const intent: ShareIntent = {
      text: null,
      webUrl: null,
      files: [
        {
          path: 'file:///var/mobile/Containers/Data/Application/photo.jpg',
          mimeType: 'image/jpeg',
          fileName: 'photo.jpg',
          size: 512000,
          width: null,
          height: null,
          duration: null,
        },
      ],
      meta: undefined,
      type: 'media',
    };

    const result = parseShareIntent(intent);
    expect(result).toEqual({
      imagePath: 'file:///var/mobile/Containers/Data/Application/photo.jpg',
      mimeType: 'image/jpeg',
    });
  });

  it('should prioritize first video file when multiple files shared', () => {
    const intent: ShareIntent = {
      text: null,
      webUrl: null,
      files: [
        {
          path: '/data/video1.mp4',
          mimeType: 'video/mp4',
          fileName: 'video1.mp4',
          size: 1024000,
          width: null,
          height: null,
          duration: null,
        },
        {
          path: '/data/video2.mp4',
          mimeType: 'video/mp4',
          fileName: 'video2.mp4',
          size: 2048000,
          width: null,
          height: null,
          duration: null,
        },
      ],
      meta: undefined,
      type: 'media',
    };

    const result = parseShareIntent(intent);
    expect(result).toEqual({
      videoPath: '/data/video1.mp4',
      mimeType: 'video/mp4',
    });
  });

  it('should ignore non-video/image files', () => {
    const intent: ShareIntent = {
      text: 'Some text content',
      webUrl: null,
      files: [
        {
          path: '/data/document.pdf',
          mimeType: 'application/pdf',
          fileName: 'document.pdf',
          size: 102400,
          width: null,
          height: null,
          duration: null,
        },
      ],
      meta: undefined,
      type: 'media',
    };

    const result = parseShareIntent(intent);
    expect(result).toEqual({
      text: 'Some text content',
      caption: 'Some text content',
    });
  });
});
