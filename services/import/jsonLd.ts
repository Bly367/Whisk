import { Ingredient, RecipeDraft } from '../../types/recipe';
import { detectSource } from './url';

type JsonLd = Record<string, unknown>;

const decodeEntities = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

const cleanText = (value: unknown): string =>
  decodeEntities(String(value ?? ''))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function hasRecipeType(node: JsonLd): boolean {
  const type = node['@type'];
  return type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'));
}

function findRecipe(value: unknown): JsonLd | null {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findRecipe(child);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const node = value as JsonLd;
  if (hasRecipeType(node)) return node;
  for (const child of Object.values(node)) {
    const found = findRecipe(child);
    if (found) return found;
  }
  return null;
}

function parseDuration(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const match = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i);
  if (!match) return undefined;
  return Number(match[1] ?? 0) * 1440 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

function parseNumber(value: unknown): number | undefined {
  const match = String(value ?? '').match(/[\d.]+/);
  return match ? Number(match[0]) : undefined;
}

function parseServings(value: unknown): number {
  if (Array.isArray(value)) return parseNumber(value[0]) ?? 1;
  return parseNumber(value) ?? 1;
}

function parseIngredient(line: string, index: number): Ingredient {
  const cleaned = cleanText(line);
  const match = cleaned.match(/^(\d+(?:\.\d+)?|\d+\/\d+|[¼½¾⅓⅔⅛⅜⅝⅞])?\s*(.*)$/);
  if (!match) return { id: `ingredient-${index}`, amount: '', unit: '', name: cleaned };
  const [, amount = '', remainder = ''] = match;
  const unitMatch = remainder.match(
    /^(fl\s+oz|tsp|teaspoons?|tbsp|tablespoons?|cups?|oz|ounces?|lb|pounds?|g|kg|ml|l|cloves?|cans?|packages?|pinch)\b\s*(.*)$/i,
  );
  const unit = unitMatch?.[1] ?? '';
  const name = unitMatch?.[2] ?? remainder;
  return { id: `ingredient-${index}`, amount, unit, name: name || cleaned };
}

function flattenInstructions(value: unknown): string[] {
  if (typeof value === 'string') {
    return value
      .split(/\r?\n/)
      .map(cleanText)
      .filter(Boolean);
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string') return [cleanText(item)].filter(Boolean);
    if (!item || typeof item !== 'object') return [];
    const node = item as JsonLd;
    if (node['@type'] === 'HowToSection') return flattenInstructions(node.itemListElement);
    const text = cleanText(node.text ?? node.name);
    return text ? [text] : [];
  });
}

function imageUrl(value: unknown): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate === 'string') return candidate;
  if (candidate && typeof candidate === 'object') {
    const url = (candidate as JsonLd).url;
    return typeof url === 'string' ? url : undefined;
  }
  return undefined;
}

export function extractRecipeJsonLd(html: string, sourceUrl: string): RecipeDraft | null {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];

  for (const script of scripts) {
    try {
      const parsed = JSON.parse(decodeEntities(script[1].trim()));
      const recipe = findRecipe(parsed);
      if (!recipe) continue;

      const title = cleanText(recipe.name);
      if (!title) continue;
      const ingredientLines = Array.isArray(recipe.recipeIngredient)
        ? recipe.recipeIngredient.map(cleanText).filter(Boolean)
        : [];
      const ingredients = ingredientLines.map(parseIngredient);
      const steps = flattenInstructions(recipe.recipeInstructions);
      const nutritionNode =
        recipe.nutrition && typeof recipe.nutrition === 'object'
          ? (recipe.nutrition as JsonLd)
          : undefined;
      const calories = parseNumber(nutritionNode?.calories);
      const protein = parseNumber(nutritionNode?.proteinContent);
      const carbs = parseNumber(nutritionNode?.carbohydrateContent);
      const fat = parseNumber(nutritionNode?.fatContent);
      const author =
        typeof recipe.author === 'string'
          ? recipe.author
          : recipe.author && typeof recipe.author === 'object'
            ? cleanText((recipe.author as JsonLd).name)
            : undefined;
      const warnings = [];
      if (!ingredients.length) {
        warnings.push({
          code: 'missing_ingredients' as const,
          message: 'No ingredient list was found on this page.',
          field: 'ingredients' as const,
        });
      }
      if (!steps.length) {
        warnings.push({
          code: 'missing_instructions' as const,
          message: 'No cooking instructions were found on this page.',
          field: 'steps' as const,
        });
      }

      return {
        id: `draft-${Date.now()}`,
        title,
        description: cleanText(recipe.description) || undefined,
        imageUrl: imageUrl(recipe.image),
        imageGradient: ['#1A1A2E', '#FF6B4A'],
        source: detectSource(sourceUrl),
        sourceUrl,
        canonicalUrl: sourceUrl,
        sourceAttribution: author,
        prepTime: parseDuration(recipe.prepTime),
        cookTime: parseDuration(recipe.cookTime),
        servings: parseServings(recipe.recipeYield),
        ingredients,
        steps,
        nutrition:
          calories !== undefined
            ? {
                calories,
                protein: protein ?? 0,
                carbs: carbs ?? 0,
                fat: fat ?? 0,
              }
            : undefined,
        tags: Array.isArray(recipe.keywords)
          ? recipe.keywords.map(cleanText)
          : String(recipe.keywords ?? '')
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean),
        evidence: [{ kind: 'json-ld', value: script[1], sourceUrl }],
        warnings,
        confidence: {
          title: 'high',
          ingredients: ingredients.length ? 'high' : 'unknown',
          steps: steps.length ? 'high' : 'unknown',
          servings: recipe.recipeYield ? 'high' : 'low',
          times: recipe.prepTime || recipe.cookTime ? 'high' : 'unknown',
          nutrition: calories !== undefined ? 'high' : 'unknown',
        },
      };
    } catch {
      // Some pages include malformed JSON-LD; continue to the next block.
    }
  }
  return null;
}

export function extractPageMetadata(html: string): { title?: string; description?: string; imageUrl?: string } {
  const meta = (property: string) => {
    const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      'i',
    );
    const reverse = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
      'i',
    );
    return cleanText(html.match(pattern)?.[1] ?? html.match(reverse)?.[1]) || undefined;
  };
  const titleTag = cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]) || undefined;
  return {
    title: meta('og:title') ?? titleTag,
    description: meta('og:description') ?? meta('description'),
    imageUrl: meta('og:image'),
  };
}
