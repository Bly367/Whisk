import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { RecipeDraft } from '../../types/recipe';
import { createAuthenticatedImportHeaders } from './authenticatedRequest';
import {
  mapAuthenticatedRequestError,
  mapImportResponseError,
  RecipeImportError,
} from './errors';
import { recipeDraftResponseSchema } from './schema';

export const MAX_IMAGE_BASE64_LENGTH = 6_000_000;
export const MAX_IMAGE_BYTES = Math.floor(MAX_IMAGE_BASE64_LENGTH / 4) * 3;

type NativeImageFile = Pick<File, 'base64' | 'exists' | 'size'>;

export interface ImageEncodingDependencies {
  platform?: typeof Platform.OS;
  fetch?: typeof fetch;
  createFile?: (uri: string) => NativeImageFile;
}

function withIds(draft: Omit<RecipeDraft, 'id'> & { id?: string }): RecipeDraft {
  return {
    ...draft,
    id: draft.id ?? `draft-${Date.now()}`,
    ingredients: draft.ingredients.map((ingredient, index) => ({
      ...ingredient,
      id: ingredient.id || `ingredient-${Date.now()}-${index}`,
    })),
  };
}

function assertImageSize(size: number): void {
  if (size > MAX_IMAGE_BYTES) {
    throw new RecipeImportError(
      'This photo is too large. Choose an image smaller than 4.5 MB.',
      'needs_input',
    );
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 32_768;
  let binary = '';

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return btoa(binary);
}

export async function encodeImageToBase64(
  uri: string,
  dependencies: ImageEncodingDependencies = {},
): Promise<string> {
  if (!uri.trim()) {
    throw new RecipeImportError('Choose a photo to import.', 'needs_input');
  }

  let imageBase64: string;

  try {
    if ((dependencies.platform ?? Platform.OS) === 'web') {
      const response = await (dependencies.fetch ?? fetch)(uri);
      if (!response.ok) throw new Error(`Could not read image (${response.status})`);

      const blob = await response.blob();
      assertImageSize(blob.size);
      imageBase64 = arrayBufferToBase64(await blob.arrayBuffer());
    } else {
      const file = (dependencies.createFile ?? ((fileUri) => new File(fileUri)))(uri);
      if (!file.exists) throw new Error('Image file is unavailable');

      assertImageSize(file.size);
      imageBase64 = await file.base64();
    }
  } catch (error) {
    if (error instanceof RecipeImportError) throw error;
    throw new RecipeImportError(
      'Whisk could not read this photo. Choose it again or try another image.',
      'needs_input',
    );
  }

  if (imageBase64.length < 100) {
    throw new RecipeImportError(
      'This photo appears to be empty or unreadable. Choose another image.',
      'needs_input',
    );
  }
  if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    throw new RecipeImportError(
      'This photo is too large. Choose an image smaller than 4.5 MB.',
      'needs_input',
    );
  }

  return imageBase64;
}

export async function importRecipeFromImage(
  imageUri: string,
  mimeType = 'image/jpeg',
): Promise<RecipeDraft> {
  const normalizedMimeType = mimeType.trim().toLowerCase();
  if (!/^image\/[a-z0-9][a-z0-9.+-]*$/.test(normalizedMimeType)) {
    throw new RecipeImportError(
      'The selected file is not a supported photo.',
      'unsupported',
    );
  }

  const endpoint = process.env.EXPO_PUBLIC_IMPORT_IMAGE_API_URL;
  if (!endpoint) {
    throw new RecipeImportError(
      'Photo import needs EXPO_PUBLIC_IMPORT_IMAGE_API_URL configured.',
      'backend_unavailable',
    );
  }

  const imageBase64 = await encodeImageToBase64(imageUri);
  let headers: Record<string, string>;
  try {
    headers = await createAuthenticatedImportHeaders();
  } catch (error) {
    throw mapAuthenticatedRequestError(error);
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ imageBase64, mimeType: normalizedMimeType }),
    });
  } catch {
    throw new RecipeImportError('The photo import service could not be reached.', 'network');
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw mapImportResponseError(response.status, body, 'photo');
  }

  const parsed = recipeDraftResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new RecipeImportError(
      'The photo import service returned an invalid recipe. Please try again.',
      'invalid_response',
    );
  }

  return withIds({
    ...parsed.data,
    imageGradient: ['#11998e', '#38ef7d'],
    imageUrl: imageUri,
    source: 'photo',
    tags: [...parsed.data.tags, 'photo'],
    evidence: [
      ...(parsed.data.evidence ?? []),
      { kind: 'image', value: 'Uploaded photo', sourceUrl: imageUri },
    ],
  } as Omit<RecipeDraft, 'id'>);
}
