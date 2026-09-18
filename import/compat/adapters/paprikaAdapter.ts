import type { CookStep, IngredientInput } from '@/data/contracts';
import { createId, nowIso } from '@/data/util';
import { parseIngredientLine } from '@/import/parse/ingredients';
import type { ImportWarning } from '@/import/types';

import {
  sanitizeCompatImageUri,
  sanitizeCompatSourceUrl,
} from '@/import/compat/safeUrl';
import {
  aggregateConfidence,
  type CompatAdapter,
  type CompatAdapterParseResult,
  type CompatExportRecipe,
  type CompatImportDraft,
} from '@/import/compat/types';

export const PAPRIKA_ADAPTER_ID = 'compat-paprika' as const;

/** Paprika recipe object (uncompressed .paprikarecipe JSON). */
export type PaprikaRecipeJson = {
  uid?: string;
  name?: string;
  ingredients?: string;
  directions?: string;
  notes?: string;
  description?: string;
  servings?: string | number;
  prep_time?: string;
  cook_time?: string;
  source?: string;
  source_url?: string;
  categories?: string[];
  rating?: number;
  image_url?: string;
};

function parseMinutes(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const hour = raw.match(/(\d+)\s*h/i);
  const min = raw.match(/(\d+)\s*m/i);
  const bare = raw.match(/^\s*(\d+)\s*$/);
  let total = 0;
  if (hour) total += Number(hour[1]) * 60;
  if (min) total += Number(min[1]);
  if (!hour && !min && bare) total = Number(bare[1]);
  return total > 0 ? total : null;
}

function parseServings(raw: string | number | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const match = String(raw).match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function splitIngredients(block: string | undefined): IngredientInput[] {
  if (!block?.trim()) return [];
  return block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => parseIngredientLine(line, index))
    .filter((ing) => ing.name.trim().length > 0);
}

function splitDirections(block: string | undefined): CookStep[] {
  if (!block?.trim()) return [];
  const parts = block
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const lines =
    parts.length > 1
      ? parts
      : block
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
  return lines.map((text, index) => ({
    id: createId(),
    text,
    position: index,
  }));
}

function unwrapPayload(payload: string): PaprikaRecipeJson[] {
  const trimmed = payload.trim();
  const data = JSON.parse(trimmed) as unknown;
  if (Array.isArray(data)) {
    return data as PaprikaRecipeJson[];
  }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.recipes)) {
      return obj.recipes as PaprikaRecipeJson[];
    }
    return [obj as PaprikaRecipeJson];
  }
  return [];
}

function draftFromPaprika(recipe: PaprikaRecipeJson): CompatImportDraft {
  const ingredients = splitIngredients(recipe.ingredients);
  const instructions = splitDirections(recipe.directions);
  const title = (recipe.name ?? '').trim() || 'Untitled recipe';
  const warnings: ImportWarning[] = [];
  if (!ingredients.length) {
    warnings.push({
      code: 'missing_ingredients',
      message: 'No ingredients detected in this Paprika recipe.',
      field: 'ingredients',
    });
  }
  if (!instructions.length) {
    warnings.push({
      code: 'missing_instructions',
      message: 'No directions detected in this Paprika recipe.',
      field: 'instructions',
    });
  }
  if (!recipe.name?.trim()) {
    warnings.push({
      code: 'missing_title',
      message: 'Paprika recipe is missing a name.',
      field: 'title',
    });
  }

  const confidence = {
    title: recipe.name?.trim() ? ('high' as const) : ('unknown' as const),
    ingredients: ingredients.length ? ('high' as const) : ('unknown' as const),
    instructions: instructions.length ? ('high' as const) : ('unknown' as const),
    servings: recipe.servings != null ? ('medium' as const) : ('unknown' as const),
    times:
      recipe.prep_time || recipe.cook_time ? ('medium' as const) : ('unknown' as const),
    notes: recipe.notes || recipe.description ? ('medium' as const) : ('unknown' as const),
  };

  const notesParts = [recipe.description?.trim(), recipe.notes?.trim()].filter(Boolean);
  const sourceUrl = sanitizeCompatSourceUrl(recipe.source_url);
  const imageUri = sanitizeCompatImageUri(recipe.image_url);
  if (recipe.source_url?.trim() && !sourceUrl) {
    warnings.push({
      code: 'unsupported_source',
      message: 'Rejected untrusted source URL scheme (https only).',
    });
  }
  if (recipe.image_url?.trim() && !imageUri) {
    warnings.push({
      code: 'unsupported_source',
      message: 'Rejected untrusted image URL scheme (https only).',
      field: 'image',
    });
  }

  return {
    id: createId(),
    format: 'paprika',
    adapterId: PAPRIKA_ADAPTER_ID,
    externalUid: recipe.uid?.trim() || null,
    title,
    notes: notesParts.length ? notesParts.join('\n\n') : null,
    sourceUrl,
    sourceName: recipe.source?.trim() || null,
    imageUri,
    servings: parseServings(recipe.servings),
    prepMinutes: parseMinutes(recipe.prep_time),
    cookMinutes: parseMinutes(recipe.cook_time),
    rating: typeof recipe.rating === 'number' ? recipe.rating : null,
    ingredients,
    instructions,
    tags: Array.isArray(recipe.categories)
      ? recipe.categories.map((c) => String(c).trim()).filter(Boolean)
      : [],
    confidence,
    overallConfidence: aggregateConfidence(confidence),
    warnings,
    sourceEvidence: JSON.stringify(recipe).slice(0, 4000),
    createdAt: nowIso(),
  };
}

function formatIngredientLine(ing: IngredientInput): string {
  return [ing.quantity, ing.unit, ing.name, ing.note ? `(${ing.note})` : null]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toPaprikaRecipe(recipe: CompatExportRecipe): PaprikaRecipeJson {
  return {
    uid: recipe.externalUid ?? recipe.id,
    name: recipe.title,
    ingredients: recipe.ingredients.map(formatIngredientLine).join('\n'),
    directions: recipe.instructions
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((step) => step.text)
      .join('\n\n'),
    notes: recipe.notes ?? '',
    servings: recipe.servings != null ? String(recipe.servings) : '',
    prep_time: recipe.prepMinutes != null ? `${recipe.prepMinutes} min` : '',
    cook_time: recipe.cookMinutes != null ? `${recipe.cookMinutes} min` : '',
    source: recipe.sourceName ?? '',
    source_url: recipe.sourceUrl ?? '',
    categories: recipe.tags,
    rating: recipe.rating ?? 0,
  };
}

export const paprikaAdapter: CompatAdapter = {
  id: PAPRIKA_ADAPTER_ID,
  format: 'paprika',
  label: 'Paprika',

  canHandle(input) {
    if (input.format && input.format !== 'paprika') return false;
    const trimmed = input.payload.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false;
    try {
      const recipes = unwrapPayload(trimmed);
      return recipes.some((r) => r.name || r.ingredients || r.directions || r.uid);
    } catch {
      return false;
    }
  },

  parse(payload: string): CompatAdapterParseResult {
    try {
      const recipes = unwrapPayload(payload);
      const drafts = recipes
        .filter((r) => r.name || r.ingredients || r.directions)
        .map(draftFromPaprika);
      if (!drafts.length) {
        return {
          ok: false,
          error: {
            code: 'empty',
            message: 'No Paprika recipes found in that file.',
          },
        };
      }
      return { ok: true, drafts };
    } catch {
      return {
        ok: false,
        error: {
          code: 'parse_failed',
          message: 'Could not parse Paprika recipe JSON.',
        },
      };
    }
  },

  serialize(drafts: CompatExportRecipe[]): Record<string, unknown> {
    const recipes = drafts.map(toPaprikaRecipe);
    return {
      format: 'paprika',
      version: 1,
      recipes,
    };
  },
};
