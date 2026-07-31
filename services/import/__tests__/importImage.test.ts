import { afterEach, describe, expect, it, vi } from 'vitest';

const nativeFile = vi.hoisted(() => ({
  exists: true,
  size: 75,
  base64: vi.fn<() => Promise<string>>(),
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

vi.mock('expo-file-system', () => ({
  File: class {
    exists = nativeFile.exists;
    size = nativeFile.size;
    base64 = nativeFile.base64;
  },
}));

vi.mock('../authenticatedRequest', () => ({
  createAuthenticatedImportHeaders: vi.fn().mockResolvedValue({
    apikey: 'test-key',
    Authorization: 'Bearer test-token',
    'Content-Type': 'application/json',
  }),
}));

import {
  encodeImageToBase64,
  importRecipeFromImage,
  MAX_IMAGE_BASE64_LENGTH,
  MAX_IMAGE_BYTES,
} from '../importImage';
import { RecipeImportError } from '../importRecipe';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.EXPO_PUBLIC_IMPORT_IMAGE_API_URL;
  nativeFile.exists = true;
  nativeFile.size = 75;
  nativeFile.base64.mockReset();
});

describe('photo encoding', () => {
  it('uses Expo FileSystem on native platforms', async () => {
    const createFile = vi.fn(() => ({
      exists: true,
      size: 75,
      base64: vi.fn().mockResolvedValue('a'.repeat(100)),
    }));
    const webFetch = vi.fn();

    await expect(
      encodeImageToBase64('file:///recipe.jpg', {
        platform: 'ios',
        createFile,
        fetch: webFetch,
      }),
    ).resolves.toBe('a'.repeat(100));

    expect(createFile).toHaveBeenCalledWith('file:///recipe.jpg');
    expect(webFetch).not.toHaveBeenCalled();
  });

  it('uses a Blob array buffer on web', async () => {
    const arrayBuffer = new Uint8Array(75).buffer;
    const webFetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue({
        size: 75,
        arrayBuffer: vi.fn().mockResolvedValue(arrayBuffer),
      }),
    });
    vi.stubGlobal('btoa', vi.fn(() => 'b'.repeat(100)));

    await expect(
      encodeImageToBase64('blob:https://whisk.test/photo', {
        platform: 'web',
        fetch: webFetch,
      }),
    ).resolves.toBe('b'.repeat(100));
  });

  it('rejects oversized native files before reading them', async () => {
    const base64 = vi.fn();

    await expect(
      encodeImageToBase64('file:///large.jpg', {
        platform: 'android',
        createFile: () => ({
          exists: true,
          size: MAX_IMAGE_BYTES + 1,
          base64,
        }),
      }),
    ).rejects.toMatchObject({
      code: 'needs_input',
      message: expect.stringContaining('smaller than 4.5 MB'),
    } satisfies Partial<RecipeImportError>);

    expect(base64).not.toHaveBeenCalled();
  });

  it('rejects encoded payloads above the Edge Function limit', async () => {
    await expect(
      encodeImageToBase64('file:///large.jpg', {
        platform: 'android',
        createFile: () => ({
          exists: true,
          size: MAX_IMAGE_BYTES,
          base64: vi.fn().mockResolvedValue('a'.repeat(MAX_IMAGE_BASE64_LENGTH + 1)),
        }),
      }),
    ).rejects.toMatchObject({
      code: 'needs_input',
      message: expect.stringContaining('too large'),
    } satisfies Partial<RecipeImportError>);
  });

  it('maps file read failures to an actionable import error', async () => {
    await expect(
      encodeImageToBase64('file:///missing.jpg', {
        platform: 'ios',
        createFile: () => ({
          exists: false,
          size: 0,
          base64: vi.fn(),
        }),
      }),
    ).rejects.toMatchObject({
      code: 'needs_input',
      message: expect.stringContaining('Choose it again'),
    } satisfies Partial<RecipeImportError>);
  });
});

describe('photo import validation', () => {
  it('rejects non-image MIME types before encoding or sending', async () => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);

    await expect(
      importRecipeFromImage('file:///recipe.txt', 'text/plain'),
    ).rejects.toMatchObject({
      code: 'unsupported',
      message: expect.stringContaining('not a supported photo'),
    } satisfies Partial<RecipeImportError>);

    expect(request).not.toHaveBeenCalled();
  });

  it('maps an oversized Edge Function response to a helpful error', async () => {
    process.env.EXPO_PUBLIC_IMPORT_IMAGE_API_URL = 'https://example.test/import-image';
    nativeFile.base64.mockResolvedValue('a'.repeat(100));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Request is too large.' }), {
          status: 413,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    await expect(
      importRecipeFromImage('file:///recipe.jpg', 'IMAGE/JPEG'),
    ).rejects.toMatchObject({
      code: 'needs_input',
      message: expect.stringContaining('smaller than 4.5 MB'),
    } satisfies Partial<RecipeImportError>);
  });
});
