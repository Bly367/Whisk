import type { CookStep, IngredientInput } from '@/data/contracts';
import { createId, nowIso } from '@/data/util';
import type { ImportWarning } from '@/import/types';

import {
  aggregateConfidence,
  type CompatAdapter,
  type CompatAdapterParseResult,
  type CompatExportRecipe,
  type CompatImportDraft,
} from '@/import/compat/types';

export const JSON_ADAPTER_ID = 'compat-json' as const;
export const WHISK_COMPAT_JSON_FORMAT = 'whisk-compat-json' as const;

type JsonRecipe = {
  id?: string;
  externalUid?: string | null;
  title?: string;
  notes?: string | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
  imageUri?: string | null;
  servings?: number | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  rating?: number | null;
  ingredients?: IngredientInput[];
  instructions?: { id?: string; text?: string; position?: number }[];
  tags?: string[];
};

function asRecipes(payload: string): JsonRecipe[] {
  const data = JSON.parse(payload) as unknown;
  if (Array.isArray(data)) return data as JsonRecipe[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.recipes)) return obj.recipes as JsonRecipe[];
    if (typeof obj.title === 'string') return [obj as JsonRecipe];
  }
  return [];
}

function draftFromJson(recipe: JsonRecipe): CompatImportDraft {
  const ingredients = (recipe.ingredients ?? [])
    .map((ing, index) => ({
      ...ing,
      name: (ing.name ?? '').trim(),
      position: ing.position ?? index,
    }))
    .filter((ing) => ing.name.length > 0);

  const instructions: CookStep[] = (recipe.instructions ?? [])
    .map((step, index) => ({
      id: step.id?.trim() || createId(),
      text: (step.text ?? '').trim(),
      position: step.position ?? index,
    }))
    .filter((step) => step.text.length > 0);

  const title = (recipe.title ?? '').trim() || 'Untitled recipe';
  const warnings: ImportWarning[] = [];
  if (!ingredients.length) {
    warnings.push({
      code: 'missing_ingredients',
      message: 'JSON recipe has no ingredients.',
      field: 'ingredients',
    });
  }
  if (!instructions.length) {
    warnings.push({
      code: 'missing_instructions',
      message: 'JSON recipe has no instructions.',
      field: 'instructions',
    });
  }

  const confidence = {
    title: recipe.title?.trim() ? ('high' as const) : ('unknown' as const),
    ingredients: ingredients.length ? ('high' as const) : ('unknown' as const),
    instructions: instructions.length ? ('high' as const) : ('unknown' as const),
    servings: recipe.servings != null ? ('high' as const) : ('unknown' as const),
    times:
      recipe.prepMinutes != null || recipe.cookMinutes != null
        ? ('high' as const)
        : ('unknown' as const),
    notes: recipe.notes ? ('high' as const) : ('unknown' as const),
  };

  return {
    id: createId(),
    format: 'json',
    adapterId: JSON_ADAPTER_ID,
    externalUid: recipe.externalUid?.trim() || recipe.id?.trim() || null,
    title,
    notes: recipe.notes ?? null,
    sourceUrl: recipe.sourceUrl ?? null,
    sourceName: recipe.sourceName ?? null,
    imageUri: recipe.imageUri ?? null,
    servings: recipe.servings ?? null,
    prepMinutes: recipe.prepMinutes ?? null,
    cookMinutes: recipe.cookMinutes ?? null,
    rating: recipe.rating ?? null,
    ingredients,
    instructions,
    tags: (recipe.tags ?? []).map((t) => String(t).trim()).filter(Boolean),
    confidence,
    overallConfidence: aggregateConfidence(confidence),
    warnings,
    sourceEvidence: JSON.stringify(recipe).slice(0, 4000),
    createdAt: nowIso(),
  };
}

export const jsonAdapter: CompatAdapter = {
  id: JSON_ADAPTER_ID,
  format: 'json',
  label: 'Common JSON',

  canHandle(input) {
    if (input.format && input.format !== 'json' && input.format !== 'generic') return false;
    const trimmed = input.payload.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false;
    try {
      const recipes = asRecipes(trimmed);
      return recipes.some((r) => r.title || (r.ingredients && r.ingredients.length));
    } catch {
      return false;
    }
  },

  parse(payload: string): CompatAdapterParseResult {
    try {
      const recipes = asRecipes(payload);
      const drafts = recipes
        .filter((r) => r.title || (r.ingredients && r.ingredients.length) || r.instructions)
        .map(draftFromJson);
      if (!drafts.length) {
        return {
          ok: false,
          error: { code: 'empty', message: 'No recipes found in that JSON pack.' },
        };
      }
      return { ok: true, drafts };
    } catch {
      return {
        ok: false,
        error: { code: 'parse_failed', message: 'Could not parse JSON recipe pack.' },
      };
    }
  },

  serialize(drafts: CompatExportRecipe[]): Record<string, unknown> {
    return {
      format: WHISK_COMPAT_JSON_FORMAT,
      version: 1,
      recipes: drafts.map((recipe) => ({
        id: recipe.id,
        externalUid: recipe.externalUid,
        title: recipe.title,
        notes: recipe.notes,
        sourceUrl: recipe.sourceUrl,
        sourceName: recipe.sourceName,
        servings: recipe.servings,
        prepMinutes: recipe.prepMinutes,
        cookMinutes: recipe.cookMinutes,
        rating: recipe.rating,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions.map((step) => ({
          text: step.text,
          position: step.position,
        })),
        tags: recipe.tags,
      })),
    };
  },
};
