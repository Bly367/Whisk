import { RecipeDraft } from '../../types/recipe';
import { RecipeImportError } from './importRecipe';
import { recipeDraftResponseSchema } from './schema';

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

async function uriToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function importRecipeFromImage(
  imageUri: string,
  mimeType = 'image/jpeg',
): Promise<RecipeDraft> {
  const endpoint = process.env.EXPO_PUBLIC_IMPORT_IMAGE_API_URL;
  if (!endpoint) {
    throw new RecipeImportError(
      'Photo import needs EXPO_PUBLIC_IMPORT_IMAGE_API_URL configured.',
      'backend_unavailable',
    );
  }

  const imageBase64 = await uriToBase64(imageUri);
  const publishableKey =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(publishableKey ? { apikey: publishableKey } : {}),
      },
      body: JSON.stringify({ imageBase64, mimeType }),
    });
  } catch {
    throw new RecipeImportError('The photo import service could not be reached.', 'network');
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body.message === 'string'
        ? body.message
        : 'This photo could not be imported automatically.';
    throw new RecipeImportError(message, response.status === 422 ? 'needs_input' : 'network');
  }

  const parsed = recipeDraftResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new RecipeImportError('The import service returned an invalid recipe.', 'network');
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
