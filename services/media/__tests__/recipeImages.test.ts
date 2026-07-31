import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/supabase', () => ({ supabase: null }));
vi.mock('../../import/authenticatedRequest', () => ({
  createAuthenticatedImportHeaders: vi.fn(),
}));
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
vi.mock('expo-file-system', () => ({
  UploadType: { BINARY_CONTENT: 0 },
  File: class {
    exists = false;
    type = '';
    arrayBuffer = vi.fn();
  },
}));

import {
  clearRecipeImageUrlCache,
  persistRecipeImage,
  RecipeImageStorage,
  removeRecipeImage,
  resolveRecipeImageUrl,
  validateRecipeImagePath,
} from '../recipeImages';

type CreateFile = NonNullable<
  NonNullable<Parameters<typeof persistRecipeImage>[3]>['createFile']
>;
type CreateUploadTask = NonNullable<ReturnType<CreateFile>['createUploadTask']>;

function createStorage(): RecipeImageStorage {
  return {
    upload: vi.fn().mockResolvedValue({ error: null }),
    createSignedUrl: vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://signed.example/image' },
      error: null,
    }),
    remove: vi.fn().mockResolvedValue({ error: null }),
  };
}

describe('recipe image storage', () => {
  beforeEach(() => {
    clearRecipeImageUrlCache();
  });

  it('accepts owned object paths and rejects traversal or malformed paths', () => {
    expect(validateRecipeImagePath('user-1/recipe-1/image.jpg')).toBe(
      'user-1/recipe-1/image.jpg',
    );
    expect(() => validateRecipeImagePath('user-1/../image.jpg')).toThrow(/invalid/i);
    expect(() => validateRecipeImagePath('/user-1/recipe-1/image.jpg')).toThrow(/invalid/i);
    expect(() => validateRecipeImagePath('user-1/recipe-1/no-extension')).toThrow(/invalid/i);
  });

  it('caches signed URLs and expires the cache before the signed URL', async () => {
    const storage = createStorage();
    const createSignedUrl = vi.mocked(storage.createSignedUrl);
    let now = 1_000;

    await expect(
      resolveRecipeImageUrl('user/recipe/image.jpg', { storage, now: () => now }),
    ).resolves.toBe('https://signed.example/image');
    now += 239_999;
    await resolveRecipeImageUrl('user/recipe/image.jpg', { storage, now: () => now });
    expect(createSignedUrl).toHaveBeenCalledTimes(1);

    now += 2;
    createSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: 'https://signed.example/refreshed' },
      error: null,
    });
    await expect(
      resolveRecipeImageUrl('user/recipe/image.jpg', { storage, now: () => now }),
    ).resolves.toBe('https://signed.example/refreshed');
    expect(createSignedUrl).toHaveBeenCalledTimes(2);
  });

  it('uploads native local images directly with authenticated byte progress', async () => {
    const storage = createStorage();
    const remoteFetch = vi.fn();
    const progress = vi.fn();
    const release = vi.fn();
    const uploadAsync = vi.fn().mockResolvedValue({
      status: 200,
      body: '{}',
      headers: {},
    });
    const createUploadTask = vi.fn(
      (
        _url: string,
        options: { onProgress?: (event: { bytesSent: number; totalBytes: number }) => void },
      ) => {
        options.onProgress?.({ bytesSent: 2, totalBytes: 4 });
        return { uploadAsync, release };
      },
    );

    await expect(
      persistRecipeImage('content://picker/123', 'user', 'recipe', {
        storage,
        platform: 'android',
        randomId: () => 'random',
        supabaseUrl: 'https://project.supabase.co/',
        createHeaders: vi.fn().mockResolvedValue({
          apikey: 'publishable',
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        }),
        onProgress: progress,
        fetch: remoteFetch as unknown as typeof fetch,
        createFile: () => ({
          exists: true,
          size: 4,
          type: 'image/png',
          arrayBuffer: vi.fn(),
          createUploadTask: createUploadTask as unknown as CreateUploadTask,
        }),
      }),
    ).resolves.toBe('user/recipe/random.png');

    expect(createUploadTask).toHaveBeenCalledWith(
      'https://project.supabase.co/storage/v1/object/recipe-images/user/recipe/random.png',
      expect.objectContaining({
        httpMethod: 'POST',
        uploadType: 0,
        mimeType: 'image/png',
        headers: expect.objectContaining({
          apikey: 'publishable',
          Authorization: 'Bearer token',
          'Content-Type': 'image/png',
          'x-upsert': 'false',
        }),
      }),
    );
    expect(progress).toHaveBeenCalledWith({ stage: 'reading' });
    expect(progress).toHaveBeenCalledWith({
      stage: 'uploading',
      bytesSent: 2,
      totalBytes: 4,
      fraction: 0.5,
    });
    expect(release).toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
    expect(remoteFetch).not.toHaveBeenCalled();
  });

  it('rejects oversized and unsupported local images before upload', async () => {
    const storage = createStorage();

    await expect(
      persistRecipeImage('file:///large.jpg', 'user', 'recipe', {
        storage,
        platform: 'ios',
        createFile: () => ({
          exists: true,
          size: 8 * 1024 * 1024 + 1,
          type: 'image/jpeg',
          arrayBuffer: vi.fn(),
        }),
      }),
    ).rejects.toMatchObject({ code: 'read_failed' });

    await expect(
      persistRecipeImage('file:///vector.svg', 'user', 'recipe', {
        storage,
        platform: 'ios',
        createFile: () => ({
          exists: true,
          size: 3,
          type: 'image/svg+xml',
          arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(3)),
        }),
      }),
    ).rejects.toMatchObject({ code: 'read_failed' });

    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('dispatches HTTPS images to the authenticated copy function', async () => {
    const storage = createStorage();
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ storagePath: 'user/recipe/remote.webp' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      persistRecipeImage('https://images.example/photo.webp', 'user', 'recipe', {
        storage,
        supabaseUrl: 'https://project.supabase.co/',
        fetch: request,
        createHeaders: vi.fn().mockResolvedValue({ Authorization: 'Bearer token' }),
      }),
    ).resolves.toBe('user/recipe/remote.webp');

    expect(request).toHaveBeenCalledWith(
      'https://project.supabase.co/functions/v1/store-recipe-image',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
        body: JSON.stringify({
          sourceUrl: 'https://images.example/photo.webp',
          recipeId: 'recipe',
        }),
      }),
    );
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('reports local read, upload, remote response, and source errors cleanly', async () => {
    const storage = createStorage();
    vi.mocked(storage.upload).mockResolvedValueOnce({ error: { message: 'bucket denied' } });

    await expect(
      persistRecipeImage('file:///photo.jpg', 'user', 'recipe', {
        storage,
        platform: 'ios',
        createFile: () => ({
          exists: false,
          size: 0,
          type: 'image/jpeg',
          arrayBuffer: vi.fn(),
        }),
      }),
    ).rejects.toMatchObject({ code: 'read_failed' });

    await expect(
      persistRecipeImage('file:///photo.jpg', 'user', 'recipe', {
        storage,
        platform: 'ios',
        randomId: () => 'random',
        supabaseUrl: 'https://project.supabase.co',
        createHeaders: vi.fn().mockResolvedValue({ Authorization: 'Bearer token' }),
        createFile: () => ({
          exists: true,
          size: 1,
          type: 'image/jpeg',
          arrayBuffer: vi.fn(),
          createUploadTask: vi.fn().mockReturnValue({
            uploadAsync: vi.fn().mockResolvedValue({ status: 500, body: '', headers: {} }),
            release: vi.fn(),
          }) as unknown as CreateUploadTask,
        }),
      }),
    ).rejects.toMatchObject({ code: 'upload_failed' });

    await expect(
      persistRecipeImage('https://images.example/photo.jpg', 'user', 'recipe', {
        supabaseUrl: 'https://project.supabase.co',
        fetch: vi.fn().mockResolvedValue(new Response('{}', { status: 200 })),
        createHeaders: vi.fn().mockResolvedValue({}),
      }),
    ).rejects.toMatchObject({ code: 'remote_failed' });

    await expect(
      persistRecipeImage('http://insecure.example/photo.jpg', 'user', 'recipe', { storage }),
    ).rejects.toMatchObject({ code: 'invalid_source' });
  });

  it('removes owned storage objects and rejects foreign paths', async () => {
    const storage = createStorage();
    await resolveRecipeImageUrl('user/recipe/image.jpg', { storage, now: () => 1_000 });

    await expect(removeRecipeImage('user/recipe/image.jpg', 'user', { storage })).resolves.toBeUndefined();
    expect(storage.remove).toHaveBeenCalledWith(['user/recipe/image.jpg']);

    await expect(
      removeRecipeImage('other/recipe/image.jpg', 'user', { storage }),
    ).rejects.toMatchObject({ code: 'invalid_path' });

    await expect(
      resolveRecipeImageUrl('user/recipe/image.jpg', { storage, now: () => 1_001 }),
    ).resolves.toBe('https://signed.example/image');
    expect(storage.createSignedUrl).toHaveBeenCalledTimes(2);
  });
});
