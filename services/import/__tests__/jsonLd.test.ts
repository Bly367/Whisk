import { describe, expect, it } from 'vitest';
import { extractRecipeJsonLd } from '../jsonLd';

const page = `
  <html>
    <head>
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@graph": [
            {"@type": "WebPage", "name": "Example"},
            {
              "@type": "Recipe",
              "name": "Weeknight Tacos",
              "description": "Fast and easy tacos.",
              "author": {"@type": "Person", "name": "Test Kitchen"},
              "image": ["https://example.com/tacos.jpg"],
              "prepTime": "PT10M",
              "cookTime": "PT20M",
              "recipeYield": "4 servings",
              "recipeIngredient": ["1 lb ground beef", "2 tbsp taco seasoning"],
              "recipeInstructions": [
                {"@type": "HowToStep", "text": "Brown the beef."},
                {"@type": "HowToSection", "itemListElement": [
                  {"@type": "HowToStep", "text": "Add seasoning and serve."}
                ]}
              ],
              "nutrition": {
                "@type": "NutritionInformation",
                "calories": "450 kcal",
                "proteinContent": "30 g",
                "carbohydrateContent": "25 g",
                "fatContent": "22 g"
              },
              "keywords": "tacos,weeknight"
            }
          ]
        }
      </script>
    </head>
  </html>
`;

describe('JSON-LD recipe extraction', () => {
  it('extracts a nested schema.org Recipe into a draft', () => {
    const draft = extractRecipeJsonLd(page, 'https://example.com/tacos');
    expect(draft?.title).toBe('Weeknight Tacos');
    expect(draft?.ingredients).toHaveLength(2);
    expect(draft?.steps).toEqual(['Brown the beef.', 'Add seasoning and serve.']);
    expect(draft?.prepTime).toBe(10);
    expect(draft?.cookTime).toBe(20);
    expect(draft?.servings).toBe(4);
    expect(draft?.nutrition?.calories).toBe(450);
    expect(draft?.sourceAttribution).toBe('Test Kitchen');
    expect(draft?.warnings).toEqual([]);
  });

  it('returns null for pages without a recipe', () => {
    expect(
      extractRecipeJsonLd(
        '<script type="application/ld+json">{"@type":"Article"}</script>',
        'https://example.com',
      ),
    ).toBeNull();
  });

  it('warns instead of inventing missing recipe fields', () => {
    const draft = extractRecipeJsonLd(
      '<script type="application/ld+json">{"@type":"Recipe","name":"Mystery Dish"}</script>',
      'https://example.com/mystery',
    );
    expect(draft?.ingredients).toEqual([]);
    expect(draft?.steps).toEqual([]);
    expect(draft?.warnings.map((warning) => warning.code)).toEqual([
      'missing_ingredients',
      'missing_instructions',
    ]);
  });
});
