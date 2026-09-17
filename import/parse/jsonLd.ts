import type { CookStep, IngredientInput } from '@/data/contracts';
import { createId, nowIso } from '@/data/util';

import { parseIngredientLine } from '@/import/parse/ingredients';
import type {
  FieldConfidence,
  ImportDraft,
  ImportWarning,
} from '@/import/types';

type JsonLd = Record<string, unknown>;

const decodeEntities = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

export function cleanText(value: unknown): string {
  return decodeEntities(String(value ?? ''))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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

export function parseDurationMinutes(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i);
  if (!match) return null;
  return (
    Number(match[1] ?? 0) * 1440 +
    Number(match[2] ?? 0) * 60 +
    Number(match[3] ?? 0)
  );
}

function parseNumber(value: unknown): number | null {
  const match = String(value ?? '').match(/[\d.]+/);
  return match ? Number(match[0]) : null;
}

function parseServings(value: unknown): number | null {
  if (Array.isArray(value)) return parseNumber(value[0]);
  return parseNumber(value);
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
    if (node['@type'] === 'HowToSection') {
      return flattenInstructions(node.itemListElement);
    }
    const text = cleanText(node.text ?? node.name);
    return text ? [text] : [];
  });
}

function imageUri(value: unknown): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate === 'string') return candidate;
  if (candidate && typeof candidate === 'object') {
    const url = (candidate as JsonLd).url;
    return typeof url === 'string' ? url : null;
  }
  return null;
}

function authorName(value: unknown): string | null {
  if (typeof value === 'string') return cleanText(value) || null;
  if (value && typeof value === 'object') {
    return cleanText((value as JsonLd).name) || null;
  }
  return null;
}

export type ExtractedRecipe = {
  title: string;
  notes: string | null;
  imageUri: string | null;
  sourceName: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: IngredientInput[];
  instructions: CookStep[];
  confidence: FieldConfidence;
  warnings: ImportWarning[];
  sourceEvidence: string;
};

/**
 * Parse schema.org Recipe JSON-LD from HTML.
 * Returns null when no recipe node exists — callers must not invent one.
 */
export function extractRecipeJsonLd(
  html: string,
  _sourceUrl: string,
): ExtractedRecipe | null {
  const scripts = [
    ...html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];

  for (const script of scripts) {
    try {
      const parsed: unknown = JSON.parse(decodeEntities(script[1].trim()));
      const recipe = findRecipe(parsed);
      if (!recipe) continue;

      const title = cleanText(recipe.name);
      if (!title) continue;

      const ingredientLines = Array.isArray(recipe.recipeIngredient)
        ? recipe.recipeIngredient.map(cleanText).filter(Boolean)
        : [];
      const ingredients = ingredientLines.map((line, index) =>
        parseIngredientLine(line, index),
      );
      const stepTexts = flattenInstructions(recipe.recipeInstructions);
      const instructions: CookStep[] = stepTexts.map((text, index) => ({
        id: createId(),
        text,
        position: index,
      }));

      const warnings: ImportWarning[] = [];
      if (!ingredients.length) {
        warnings.push({
          code: 'missing_ingredients',
          message: 'No ingredient list was found on this page. Add them before saving.',
          field: 'ingredients',
        });
      }
      if (!instructions.length) {
        warnings.push({
          code: 'missing_instructions',
          message: 'No cooking steps were found on this page. Add them before saving.',
          field: 'instructions',
        });
      }

      const confidence: FieldConfidence = {
        title: 'high',
        ingredients: ingredients.length ? 'high' : 'unknown',
        instructions: instructions.length ? 'high' : 'unknown',
        servings: recipe.recipeYield ? 'high' : 'low',
        times: recipe.prepTime || recipe.cookTime ? 'high' : 'unknown',
        notes: recipe.description ? 'medium' : 'unknown',
        image: recipe.image ? 'high' : 'unknown',
      };

      return {
        title,
        notes: cleanText(recipe.description) || null,
        imageUri: imageUri(recipe.image),
        sourceName: authorName(recipe.author),
        servings: parseServings(recipe.recipeYield),
        prepMinutes: parseDurationMinutes(recipe.prepTime),
        cookMinutes: parseDurationMinutes(recipe.cookTime),
        ingredients,
        instructions,
        confidence,
        warnings,
        sourceEvidence: script[1].trim().slice(0, 4000),
      };
    } catch {
      // Malformed JSON-LD — try the next block.
    }
  }

  return null;
}

export function extractPageMetadata(html: string): {
  title?: string;
  description?: string;
  imageUri?: string;
} {
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
    return (
      cleanText(html.match(pattern)?.[1] ?? html.match(reverse)?.[1]) ||
      undefined
    );
  };
  const titleTag =
    cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]) || undefined;
  return {
    title: meta('og:title') ?? titleTag,
    description: meta('og:description') ?? meta('description'),
    imageUri: meta('og:image'),
  };
}

export function draftFromExtracted(
  extracted: ExtractedRecipe,
  options: {
    adapterId: string;
    sourceKind: ImportDraft['sourceKind'];
    sourceUrl: string | null;
  },
): ImportDraft {
  return {
    id: createId(),
    sourceKind: options.sourceKind,
    sourceUrl: options.sourceUrl,
    sourceName: extracted.sourceName,
    imageUri: extracted.imageUri,
    title: extracted.title,
    notes: extracted.notes,
    servings: extracted.servings,
    prepMinutes: extracted.prepMinutes,
    cookMinutes: extracted.cookMinutes,
    ingredients: extracted.ingredients,
    instructions: extracted.instructions,
    confidence: extracted.confidence,
    warnings: extracted.warnings,
    sourceEvidence: extracted.sourceEvidence,
    adapterId: options.adapterId,
    createdAt: nowIso(),
  };
}
