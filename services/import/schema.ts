import { z } from 'zod';

const ingredientSchema = z.object({
  id: z.string().optional(),
  amount: z.string().default(''),
  unit: z.string().default(''),
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
      title: z.enum(['high', 'medium', 'low', 'unknown']).optional(),
      ingredients: z.enum(['high', 'medium', 'low', 'unknown']).optional(),
      steps: z.enum(['high', 'medium', 'low', 'unknown']).optional(),
      servings: z.enum(['high', 'medium', 'low', 'unknown']).optional(),
      times: z.enum(['high', 'medium', 'low', 'unknown']).optional(),
      nutrition: z.enum(['high', 'medium', 'low', 'unknown']).optional(),
    })
    .default({}),
});
