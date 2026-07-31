import { RecipeDraft } from '../../types/recipe';
import { extractPageMetadata, extractRecipeJsonLd } from './jsonLd';
import { recipeDraftResponseSchema } from './schema';
import { canonicalizeUrl, detectSource, isSocialSource } from './url';

export class RecipeImportError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'invalid_url'
      | 'network'
      | 'needs_input'
      | 'unsupported'
      | 'backend_unavailable',
  ) {
    super(message);
  }
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

async function importFromBackend(url: string, suppliedText?: string): Promise<RecipeDraft> {
  const endpoint = process.env.EXPO_PUBLIC_IMPORT_API_URL;
  if (!endpoint) {
    throw new RecipeImportError(
      'This source needs the Whisk import service. Add the recipe caption or configure EXPO_PUBLIC_IMPORT_API_URL.',
      'backend_unavailable',
    );
  }

  let response: Response;
  try {
    const publishableKey =
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(publishableKey ? { apikey: publishableKey } : {}),
      },
      body: JSON.stringify({ url, suppliedText }),
    });
  } catch {
    throw new RecipeImportError('The import service could not be reached.', 'network');
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body.message === 'string'
        ? body.message
        : 'This source could not be imported automatically.';
    throw new RecipeImportError(message, response.status === 422 ? 'needs_input' : 'network');
  }

  const parsed = recipeDraftResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new RecipeImportError('The import service returned an invalid recipe.', 'network');
  }

  return withIds({
    ...parsed.data,
    imageGradient: ['#1A1A2E', '#FF6B4A'],
    source: detectSource(url),
    sourceUrl: url,
    canonicalUrl: url,
  } as Omit<RecipeDraft, 'id'>);
}

export async function importRecipe(input: string, suppliedText?: string): Promise<RecipeDraft> {
  let url: string;
  try {
    url = canonicalizeUrl(input);
  } catch {
    throw new RecipeImportError('Paste a valid public recipe link.', 'invalid_url');
  }

  const source = detectSource(url);
  if (isSocialSource(source)) {
    return importFromBackend(url, suppliedText);
  }

  try {
    const response = await fetch(url, {
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new RecipeImportError('That link does not point to a webpage.', 'unsupported');
    }
    const html = await response.text();
    const structured = extractRecipeJsonLd(html, url);
    if (structured) return structured;

    const metadata = extractPageMetadata(html);
    if (suppliedText || process.env.EXPO_PUBLIC_IMPORT_API_URL) {
      return importFromBackend(url, suppliedText);
    }
    if (metadata.title) {
      return {
        id: `draft-${Date.now()}`,
        title: metadata.title,
        description: metadata.description,
        imageUrl: metadata.imageUrl,
        imageGradient: ['#1A1A2E', '#FF6B4A'],
        source,
        sourceUrl: url,
        canonicalUrl: url,
        servings: 1,
        ingredients: [],
        steps: [],
        tags: [],
        evidence: [
          {
            kind: 'metadata',
            value: JSON.stringify(metadata),
            sourceUrl: url,
          },
        ],
        warnings: [
          {
            code: 'missing_ingredients',
            message: 'Add the ingredient list from the source.',
            field: 'ingredients',
          },
          {
            code: 'missing_instructions',
            message: 'Add the cooking instructions from the source.',
            field: 'steps',
          },
        ],
        confidence: { title: 'high', ingredients: 'unknown', steps: 'unknown' },
      };
    }
  } catch (error) {
    if (error instanceof RecipeImportError) throw error;
    if (process.env.EXPO_PUBLIC_IMPORT_API_URL) return importFromBackend(url, suppliedText);
    throw new RecipeImportError(
      'Whisk could not read this page locally. Configure the import service or paste its recipe text.',
      'backend_unavailable',
    );
  }

  throw new RecipeImportError(
    'No structured recipe was found. Paste the recipe caption or text to continue.',
    'needs_input',
  );
}
