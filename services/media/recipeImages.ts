import { File, UploadType } from 'expo-file-system';
import { Platform } from 'react-native';
import { supabase } from '../../lib/supabase';
import { createAuthenticatedImportHeaders } from '../import/authenticatedRequest';

const BUCKET = 'recipe-images';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 300;
const SIGNED_URL_CACHE_MS = 240_000;
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const IMAGE_PATH = /^([A-Za-z0-9][A-Za-z0-9._-]*)\/([A-Za-z0-9][A-Za-z0-9._-]*)\/([A-Za-z0-9][A-Za-z0-9._-]*)\.([A-Za-z0-9]+)$/;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

type StorageError = { message: string };

export interface RecipeImageStorage {
  upload(
    path: string,
    bytes: ArrayBuffer,
    options: { contentType: string; upsert: boolean },
  ): Promise<{ error: StorageError | null }>;
  createSignedUrl(
    path: string,
    expiresIn: number,
  ): Promise<{ data: { signedUrl: string } | null; error: StorageError | null }>;
  remove(paths: string[]): Promise<{ error: StorageError | null }>;
}

export type RecipeImageProgress =
  | { stage: 'reading' | 'copying' }
  | { stage: 'uploading'; bytesSent: number; totalBytes: number; fraction: number };

type RecipeImageFile = Pick<File, 'arrayBuffer' | 'exists' | 'size' | 'type'> & {
  createUploadTask?: File['createUploadTask'];
};

export interface RecipeImageDependencies {
  storage?: RecipeImageStorage;
  fetch?: typeof fetch;
  createFile?: (uri: string) => RecipeImageFile;
  createHeaders?: () => Promise<Record<string, string>>;
  platform?: typeof Platform.OS;
  now?: () => number;
  randomId?: () => string;
  supabaseUrl?: string;
  onProgress?: (progress: RecipeImageProgress) => void;
}

export class RecipeImageError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'invalid_source'
      | 'invalid_path'
      | 'configuration'
      | 'read_failed'
      | 'upload_failed'
      | 'remote_failed'
      | 'sign_failed'
      | 'delete_failed',
  ) {
    super(message);
    this.name = 'RecipeImageError';
  }
}

type CacheEntry = { signedUrl: string; expiresAt: number };
const signedUrlCache = new Map<string, CacheEntry>();

function getStorage(dependencies: RecipeImageDependencies): RecipeImageStorage {
  const storage = dependencies.storage ?? supabase?.storage.from(BUCKET);
  if (!storage) {
    throw new RecipeImageError('Cloud image storage is not configured.', 'configuration');
  }
  return storage;
}

function assertSafeSegment(value: string, label: string): string {
  const normalized = value.trim();
  if (!SAFE_SEGMENT.test(normalized)) {
    throw new RecipeImageError(`The ${label} is not valid for image storage.`, 'invalid_path');
  }
  return normalized;
}

export function validateRecipeImagePath(path: string): string {
  const normalized = path.trim();
  if (normalized !== path || normalized.includes('..') || !IMAGE_PATH.test(normalized)) {
    throw new RecipeImageError('The recipe image storage path is invalid.', 'invalid_path');
  }
  return normalized;
}

function extensionForUri(uri: string): string {
  const match = uri.split(/[?#]/, 1)[0].match(/\.([A-Za-z0-9]+)$/);
  const extension = match?.[1]?.toLowerCase();
  if (extension === 'jpeg') return 'jpg';
  if (extension && /^(avif|gif|heic|heif|jpg|png|webp)$/.test(extension)) return extension;
  return 'jpg';
}

function mimeTypeForExtension(extension: string): string {
  if (extension === 'jpg') return 'image/jpeg';
  if (extension === 'svg') return 'image/svg+xml';
  return `image/${extension}`;
}

function extensionForContentType(contentType?: string): string | undefined {
  if (contentType === 'image/jpeg') return 'jpg';
  return contentType?.replace(/^image\//, '');
}

function defaultRandomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createRecipeImageStoragePath(
  userId: string,
  recipeId: string,
  uri: string,
  randomId = defaultRandomId(),
): string {
  const extension = extensionForUri(uri);
  const path = `${assertSafeSegment(userId, 'user ID')}/${assertSafeSegment(
    recipeId,
    'recipe ID',
  )}/${assertSafeSegment(randomId, 'image ID')}.${extension}`;
  return validateRecipeImagePath(path);
}

function isLocalImageUri(uri: string): boolean {
  return /^(file|content|blob):/i.test(uri);
}

function assertImageBytes(size: number): void {
  if (size <= 0) {
    throw new RecipeImageError('The selected image is empty.', 'read_failed');
  }
  if (size > MAX_IMAGE_BYTES) {
    throw new RecipeImageError(
      'This image is too large to back up. Choose one smaller than 8 MB.',
      'read_failed',
    );
  }
}

function normalizedContentType(value?: string): string | undefined {
  const contentType = value?.split(';', 1)[0].trim().toLowerCase();
  if (!contentType) return undefined;
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new RecipeImageError('This image format is not supported.', 'read_failed');
  }
  return contentType;
}

async function readLocalImage(
  uri: string,
  dependencies: RecipeImageDependencies,
): Promise<{ bytes: ArrayBuffer; contentType?: string }> {
  try {
    if ((dependencies.platform ?? Platform.OS) === 'web' || /^blob:/i.test(uri)) {
      const response = await (dependencies.fetch ?? fetch)(uri);
      if (!response.ok) throw new Error(`Could not read image (${response.status})`);
      const declaredSize = Number(response.headers.get('content-length') ?? 0);
      if (declaredSize) assertImageBytes(declaredSize);
      const bytes = await response.arrayBuffer();
      assertImageBytes(bytes.byteLength);
      return {
        bytes,
        contentType: normalizedContentType(
          response.headers.get('content-type') ?? undefined,
        ),
      };
    }

    const file = (dependencies.createFile ?? ((fileUri) => new File(fileUri)))(uri);
    if (!file.exists) throw new Error('Image file is unavailable');
    assertImageBytes(file.size);
    dependencies.onProgress?.({ stage: 'reading' });
    const bytes = await file.arrayBuffer();
    assertImageBytes(bytes.byteLength);
    return { bytes, contentType: normalizedContentType(file.type || undefined) };
  } catch (error) {
    if (error instanceof RecipeImageError) throw error;
    throw new RecipeImageError(
      'Whisk could not read this image. Choose it again and retry.',
      'read_failed',
    );
  }
}

async function uploadNativeImage(
  path: string,
  contentType: string,
  file: RecipeImageFile,
  dependencies: RecipeImageDependencies,
): Promise<void> {
  const supabaseUrl =
    dependencies.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  if (!supabaseUrl || !file.createUploadTask) {
    throw new RecipeImageError('Cloud image storage is not configured.', 'configuration');
  }

  const objectPath = path.split('/').map(encodeURIComponent).join('/');
  const headers = await (dependencies.createHeaders ?? createAuthenticatedImportHeaders)();
  const task = file.createUploadTask(
    `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/${BUCKET}/${objectPath}`,
    {
      httpMethod: 'POST',
      uploadType: UploadType.BINARY_CONTENT,
      mimeType: contentType,
      headers: {
        ...headers,
        'Content-Type': contentType,
        'x-upsert': 'false',
      },
      onProgress: ({ bytesSent, totalBytes }) => {
        dependencies.onProgress?.({
          stage: 'uploading',
          bytesSent,
          totalBytes,
          fraction: totalBytes > 0 ? Math.min(1, bytesSent / totalBytes) : 0,
        });
      },
    },
  );
  try {
    const result = await task.uploadAsync();
    if (result.status >= 200 && result.status < 300) return;
    throw new RecipeImageError(
      'Whisk could not back up this image. Check your connection and retry.',
      'upload_failed',
    );
  } catch (error) {
    if (error instanceof RecipeImageError) throw error;
    throw new RecipeImageError(
      'Whisk could not back up this image. Check your connection and retry.',
      'upload_failed',
    );
  } finally {
    task.release();
  }
}

async function uploadLocalImage(
  sourceUri: string,
  userId: string,
  recipeId: string,
  dependencies: RecipeImageDependencies,
): Promise<string> {
  const randomId = (dependencies.randomId ?? defaultRandomId)();
  const platform = dependencies.platform ?? Platform.OS;
  const file = (dependencies.createFile ?? ((fileUri) => new File(fileUri)))(sourceUri);

  if (platform !== 'web' && !/^blob:/i.test(sourceUri)) {
    try {
      if (!file.exists) throw new Error('Image file is unavailable');
      assertImageBytes(file.size);
      const contentType =
        normalizedContentType(file.type || undefined) ??
        mimeTypeForExtension(extensionForUri(sourceUri));
      const extension = extensionForContentType(contentType) ?? extensionForUri(sourceUri);
      const path = createRecipeImageStoragePath(
        userId,
        recipeId,
        `image.${extension}`,
        randomId,
      );
      dependencies.onProgress?.({ stage: 'reading' });
      await uploadNativeImage(path, contentType, file, dependencies);
      return path;
    } catch (error) {
      if (error instanceof RecipeImageError) throw error;
      throw new RecipeImageError(
        'Whisk could not read or upload this image. Choose it again and retry.',
        'read_failed',
      );
    }
  }

  const image = await readLocalImage(sourceUri, {
    ...dependencies,
    createFile: () => file,
  });
  const contentType = image.contentType ?? mimeTypeForExtension(extensionForUri(sourceUri));
  const extension = extensionForContentType(contentType) ?? extensionForUri(sourceUri);
  const path = createRecipeImageStoragePath(userId, recipeId, `image.${extension}`, randomId);
  dependencies.onProgress?.({
    stage: 'uploading',
    bytesSent: 0,
    totalBytes: image.bytes.byteLength,
    fraction: 0,
  });
  const { error } = await getStorage(dependencies).upload(path, image.bytes, {
    contentType,
    upsert: false,
  });
  if (error) {
    throw new RecipeImageError(
      `Whisk could not back up this image: ${error.message}`,
      'upload_failed',
    );
  }
  dependencies.onProgress?.({
    stage: 'uploading',
    bytesSent: image.bytes.byteLength,
    totalBytes: image.bytes.byteLength,
    fraction: 1,
  });
  return path;
}

async function copyRemoteImage(
  sourceUrl: string,
  userId: string,
  recipeId: string,
  dependencies: RecipeImageDependencies,
): Promise<string> {
  const supabaseUrl =
    dependencies.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  if (!supabaseUrl) {
    throw new RecipeImageError('Cloud image storage is not configured.', 'configuration');
  }

  let response: Response;
  try {
    dependencies.onProgress?.({ stage: 'copying' });
    response = await (dependencies.fetch ?? fetch)(
      `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/store-recipe-image`,
      {
        method: 'POST',
        headers: await (dependencies.createHeaders ?? createAuthenticatedImportHeaders)(),
        body: JSON.stringify({ sourceUrl, recipeId }),
      },
    );
  } catch {
    throw new RecipeImageError(
      'Whisk could not reach the image backup service. Try again.',
      'remote_failed',
    );
  }

  const body = (await response.json().catch(() => null)) as
    | { storagePath?: unknown; error?: unknown }
    | null;
  if (!response.ok) {
    const detail = typeof body?.error === 'string' ? ` ${body.error}` : '';
    throw new RecipeImageError(
      `Whisk could not back up this image.${detail}`.trim(),
      'remote_failed',
    );
  }
  if (typeof body?.storagePath !== 'string') {
    throw new RecipeImageError(
      'The image backup service returned an invalid response.',
      'remote_failed',
    );
  }
  const path = validateRecipeImagePath(body.storagePath);
  const expectedPrefix = `${assertSafeSegment(userId, 'user ID')}/${assertSafeSegment(
    recipeId,
    'recipe ID',
  )}/`;
  if (!path.startsWith(expectedPrefix)) {
    throw new RecipeImageError(
      'The image backup service returned a path for a different recipe.',
      'invalid_path',
    );
  }
  return path;
}

export async function persistRecipeImage(
  sourceUri: string,
  userId: string,
  recipeId: string,
  dependencies: RecipeImageDependencies = {},
): Promise<string> {
  const source = sourceUri.trim();
  if (isLocalImageUri(source)) {
    return uploadLocalImage(source, userId, recipeId, dependencies);
  }
  if (/^https:\/\//i.test(source)) {
    return copyRemoteImage(source, userId, recipeId, dependencies);
  }
  throw new RecipeImageError(
    'Only local images and secure HTTPS image URLs can be backed up.',
    'invalid_source',
  );
}

export async function resolveRecipeImageUrl(
  storagePath: string,
  dependencies: RecipeImageDependencies = {},
): Promise<string> {
  const path = validateRecipeImagePath(storagePath);
  const now = (dependencies.now ?? Date.now)();
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > now) return cached.signedUrl;

  const { data, error } = await getStorage(dependencies).createSignedUrl(
    path,
    SIGNED_URL_TTL_SECONDS,
  );
  if (error || !data?.signedUrl) {
    throw new RecipeImageError(
      `Whisk could not load this private image${error ? `: ${error.message}` : '.'}`,
      'sign_failed',
    );
  }
  signedUrlCache.set(path, {
    signedUrl: data.signedUrl,
    expiresAt: now + SIGNED_URL_CACHE_MS,
  });
  return data.signedUrl;
}

export async function removeRecipeImage(
  storagePath: string,
  userId: string,
  dependencies: RecipeImageDependencies = {},
): Promise<void> {
  const path = validateRecipeImagePath(storagePath);
  const ownerId = assertSafeSegment(userId, 'user ID');
  if (!path.startsWith(`${ownerId}/`)) {
    throw new RecipeImageError('This image does not belong to the signed-in user.', 'invalid_path');
  }
  const { error } = await getStorage(dependencies).remove([path]);
  if (error) {
    throw new RecipeImageError(
      `Whisk could not remove the stored image: ${error.message}`,
      'delete_failed',
    );
  }
  signedUrlCache.delete(path);
}

export function clearRecipeImageUrlCache(): void {
  signedUrlCache.clear();
}
