// @ts-nocheck — Supabase Edge Functions run in Deno, outside the Expo TypeScript runtime.
import { authenticateRequest, AuthenticationError } from '../_shared/auth.ts';
import {
  completeImportEvent,
  consumeImportQuota,
  recordImportFailure,
  UsageServiceError,
} from '../_shared/import-usage.ts';

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const recipeSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title',
    'description',
    'sourceAttribution',
    'prepTime',
    'cookTime',
    'servings',
    'ingredients',
    'steps',
    'tags',
  ],
  properties: {
    title: { type: 'string' },
    description: { type: ['string', 'null'] },
    sourceAttribution: { type: ['string', 'null'] },
    prepTime: { type: ['number', 'null'] },
    cookTime: { type: ['number', 'null'] },
    servings: { type: 'number' },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['amount', 'unit', 'name'],
        properties: {
          amount: { type: 'string' },
          unit: { type: 'string' },
          name: { type: 'string' },
        },
      },
    },
    steps: { type: 'array', items: { type: 'string' } },
    tags: { type: 'array', items: { type: 'string' } },
  },
};

async function structureImageWithAI(imageBase64: string, mimeType: string) {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('The AI normalization service is not configured.');
  }
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: Deno.env.get('OPENAI_VISION_MODEL') ?? Deno.env.get('OPENAI_MODEL') ?? 'gpt-4.1-mini',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'Extract only explicit recipe facts visible in the image. Never invent quantities, times, servings, ingredients, or steps. Use empty strings/arrays or null when absent.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract the recipe from this cookbook page or screenshot.' },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'recipe', strict: true, schema: recipeSchema },
      },
    }),
  });
  if (!response.ok) throw new Error('AI vision normalization failed.');
  const payload = await response.json();
  return JSON.parse(payload.choices?.[0]?.message?.content ?? '{}');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ message: 'Method not allowed.' }, 405);

  const startedAt = Date.now();
  let userId: string;
  try {
    ({ userId } = await authenticateRequest(request));
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return json({ message: error.message, code: 'authentication_required' }, 401);
    }
    return json({ message: 'Authentication service is unavailable.', code: 'auth_unavailable' }, 503);
  }

  let eventId: number | undefined;
  try {
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > 8_000_000) {
      await recordImportFailure(userId, 'image', 'image', 413, 'request_too_large', startedAt);
      return json({ message: 'Request is too large.', code: 'request_too_large' }, 413);
    }

    const body = await request.json();
    const imageBase64 =
      typeof body.imageBase64 === 'string' ? body.imageBase64.trim().slice(0, 6_000_000) : '';
    const mimeType =
      typeof body.mimeType === 'string' && body.mimeType.startsWith('image/')
        ? body.mimeType
        : 'image/jpeg';

    if (!imageBase64 || imageBase64.length < 100) {
      await recordImportFailure(userId, 'image', 'image', 400, 'invalid_image', startedAt);
      return json({ message: 'A valid photo is required.', code: 'invalid_image' }, 400);
    }

    const quota = await consumeImportQuota(userId, 'image', 'image');
    eventId = quota.eventId;
    if (!quota.allowed) {
      return json(
        {
          message: 'Daily import limit reached. Try again after the quota resets.',
          code: 'daily_quota_exceeded',
          retryAt: quota.resetAt,
        },
        429,
      );
    }

    const recipe = await structureImageWithAI(imageBase64, mimeType);
    const warnings = [];
    if (!recipe.ingredients?.length) {
      warnings.push({
        code: 'missing_ingredients',
        message: 'No complete ingredient list was found in the photo.',
        field: 'ingredients',
      });
    }
    if (!recipe.steps?.length) {
      warnings.push({
        code: 'missing_instructions',
        message: 'No complete cooking instructions were found in the photo.',
        field: 'steps',
      });
    }

    const responseBody = {
      ...recipe,
      description: recipe.description ?? undefined,
      sourceAttribution: recipe.sourceAttribution ?? 'Photo import',
      prepTime: recipe.prepTime ?? undefined,
      cookTime: recipe.cookTime ?? undefined,
      evidence: [{ kind: 'image', value: 'Uploaded photo OCR' }],
      warnings,
      confidence: {
        title: 'medium',
        ingredients: recipe.ingredients?.length ? 'medium' : 'unknown',
        steps: recipe.steps?.length ? 'medium' : 'unknown',
        servings: recipe.servings > 1 ? 'medium' : 'low',
      },
    };
    await completeImportEvent(eventId, userId, 'succeeded', 200, null, startedAt);
    return json(responseBody);
  } catch (error) {
    if (error instanceof UsageServiceError) {
      return json({ message: error.message, code: 'usage_service_unavailable' }, 503);
    }
    const message = error instanceof Error ? error.message : 'Import failed.';
    const status = message.includes('Invalid') ? 400 : 502;
    const errorCode = status === 400 ? 'invalid_request' : 'import_failed';
    if (eventId !== undefined) {
      try {
        await completeImportEvent(eventId, userId, 'failed', status, errorCode, startedAt);
      } catch {
        return json(
          { message: 'Import usage service is unavailable.', code: 'usage_service_unavailable' },
          503,
        );
      }
    } else {
      try {
        await recordImportFailure(userId, 'image', 'image', status, errorCode, startedAt);
      } catch {
        return json(
          { message: 'Import usage service is unavailable.', code: 'usage_service_unavailable' },
          503,
        );
      }
    }
    return json({ message, code: errorCode }, status);
  }
});
