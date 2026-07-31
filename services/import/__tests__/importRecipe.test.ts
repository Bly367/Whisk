import { afterEach, describe, expect, it, vi } from 'vitest';
import { importRecipe, RecipeImportError } from '../importRecipe';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.EXPO_PUBLIC_IMPORT_API_URL;
});

describe('recipe import orchestration', () => {
  it('imports a structured recipe website locally', async () => {
    const html = `
      <script type="application/ld+json">
        {
          "@type": "Recipe",
          "name": "Simple Soup",
          "recipeYield": "2 servings",
          "recipeIngredient": ["2 cups broth"],
          "recipeInstructions": [{"@type": "HowToStep", "text": "Simmer the broth."}]
        }
      </script>
    `;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(html, {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
      ),
    );

    const draft = await importRecipe('https://example.com/soup?utm_source=test');
    expect(draft.title).toBe('Simple Soup');
    expect(draft.canonicalUrl).toBe('https://example.com/soup');
    expect(draft.ingredients[0].name).toBe('broth');
  });

  it('does not pretend a social link can be read without the backend', async () => {
    await expect(importRecipe('https://instagram.com/reel/example/')).rejects.toMatchObject({
      code: 'backend_unavailable',
    } satisfies Partial<RecipeImportError>);
  });
});
