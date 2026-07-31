import { z } from 'zod';

const confidenceLevel = z.enum(['high', 'medium', 'low', 'unknown']);

const ingredientSchema = z.object({
  id: z.string().optional(),
  amount: z.string().catch(''),
  unit: z.string().catch(''),
  name: z.string().min(1),
});

const warningSchema = z.object({
  code: z.enum([
    'missing_ingredients',
    'missing_instructions',
    'missing_quantities',
    'private_or_unavailable',
    'unsupported_source',
    'low_confidence',
  ]),
  message: z.string(),
  field: z.string().optional(),
});

const evidenceSchema = z.object({
  kind: z.enum(['json-ld', 'page-text', 'caption', 'metadata', 'user-text', 'image', 'video']),
  value: z.string(),
  sourceUrl: z.string().optional(),
});

function asOptionalString(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function asOptionalNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function asAbsoluteHttpUrl(value: unknown): string | undefined {
  const raw = asOptionalString(value);
  if (!raw) return undefined;
  try {
    const candidate = raw.startsWith('//') ? `https:${raw}` : raw;
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function asIngredients(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const name = asOptionalString(row.name);
      if (!name) return null;
      return {
        id: asOptionalString(row.id),
        amount: asOptionalString(row.amount) ?? '',
        unit: asOptionalString(row.unit) ?? '',
        name,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function asWarnings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const parsed = warningSchema.safeParse({
        code: row.code,
        message: asOptionalString(row.message) ?? 'Import warning',
        field: asOptionalString(row.field),
      });
      return parsed.success ? parsed.data : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function asEvidence(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const parsed = evidenceSchema.safeParse({
        kind: row.kind,
        value: asOptionalString(row.value) ?? '',
        sourceUrl: asAbsoluteHttpUrl(row.sourceUrl) ?? asOptionalString(row.sourceUrl),
      });
      return parsed.success && parsed.data.value ? parsed.data : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function asNutrition(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Record<string, unknown>;
  const calories = asOptionalNumber(row.calories);
  if (calories === undefined) return undefined;
  return {
    calories: Math.max(0, calories),
    protein: Math.max(0, asOptionalNumber(row.protein) ?? 0),
    carbs: Math.max(0, asOptionalNumber(row.carbs) ?? 0),
    fat: Math.max(0, asOptionalNumber(row.fat) ?? 0),
  };
}

function asConfidence(value: unknown) {
  if (!value || typeof value !== 'object') return {};
  const row = value as Record<string, unknown>;
  const pick = (key: string) => {
    const parsed = confidenceLevel.safeParse(row[key]);
    return parsed.success ? parsed.data : undefined;
  };
  return {
    title: pick('title'),
    ingredients: pick('ingredients'),
    steps: pick('steps'),
    servings: pick('servings'),
    times: pick('times'),
    nutrition: pick('nutrition'),
  };
}

/** Softens backend/AI payloads so minor shape quirks don't fail the whole import. */
export function normalizeRecipeDraftResponse(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const row = body as Record<string, unknown>;
  const title = asOptionalString(row.title);
  const servings = asOptionalNumber(row.servings);

  return {
    title: title ?? '',
    description: asOptionalString(row.description),
    imageUrl: asAbsoluteHttpUrl(row.imageUrl),
    sourceAttribution: asOptionalString(row.sourceAttribution),
    prepTime: asOptionalNumber(row.prepTime),
    cookTime: asOptionalNumber(row.cookTime),
    servings: servings && servings > 0 ? servings : 1,
    ingredients: asIngredients(row.ingredients),
    steps: asStringArray(row.steps),
    nutrition: asNutrition(row.nutrition),
    tags: asStringArray(row.tags),
    evidence: asEvidence(row.evidence),
    warnings: asWarnings(row.warnings),
    confidence: asConfidence(row.confidence),
  };
}

export const recipeDraftResponseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  sourceAttribution: z.string().optional(),
  prepTime: z.number().nonnegative().optional(),
  cookTime: z.number().nonnegative().optional(),
  servings: z.number().positive().default(1),
  ingredients: z.array(ingredientSchema).default([]),
  steps: z.array(z.string().min(1)).default([]),
  nutrition: z
    .object({
      calories: z.number().nonnegative(),
      protein: z.number().nonnegative(),
      carbs: z.number().nonnegative(),
      fat: z.number().nonnegative(),
    })
    .optional(),
  tags: z.array(z.string()).default([]),
  evidence: z.array(evidenceSchema).default([]),
  warnings: z.array(warningSchema).default([]),
  confidence: z
    .object({
      title: confidenceLevel.optional(),
      ingredients: confidenceLevel.optional(),
      steps: confidenceLevel.optional(),
      servings: confidenceLevel.optional(),
      times: confidenceLevel.optional(),
      nutrition: confidenceLevel.optional(),
    })
    .default({}),
});

export function parseRecipeDraftResponse(body: unknown) {
  return recipeDraftResponseSchema.safeParse(normalizeRecipeDraftResponse(body));
}
