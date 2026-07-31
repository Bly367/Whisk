// @ts-nocheck — Supabase Edge Functions run in Deno, outside the Expo TypeScript runtime.
const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const recentRequests = new Map<string, number[]>();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function isValidPublishableKey(key: string | null): boolean {
  if (!key) return false;
  const singleKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  if (singleKey && key === singleKey) return true;

  try {
    const configured = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}');
    return Object.values(configured).some((value) => {
      if (typeof value === 'string') return value === key;
      return value && typeof value === 'object' && value.key === key;
    });
  } catch {
    return false;
  }
}

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

async function structureWithAI(text: string, sourceLabel: string) {
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
      model: Deno.env.get('OPENAI_MODEL') ?? 'gpt-4.1-mini',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'Convert only explicit recipe facts into structured data. Never invent quantities, times, servings, ingredients, or steps. Use empty strings/arrays or null when absent.',
        },
        {
          role: 'user',
          content: `Source: ${sourceLabel}\n\nRecipe evidence:\n${text.slice(0, 50_000)}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'recipe', strict: true, schema: recipeSchema },
      },
    }),
  });
  if (!response.ok) throw new Error('AI normalization failed.');
  const payload = await response.json();
  return JSON.parse(payload.choices?.[0]?.message?.content ?? '{}');
}

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
  if (!isValidPublishableKey(request.headers.get('apikey'))) {
    return json({ message: 'Unauthorized.' }, 401);
  }

  try {
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > 8_000_000) return json({ message: 'Request is too large.' }, 413);
    const clientId =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('authorization')?.slice(-16) ??
      'anonymous';
    const now = Date.now();
    const active = (recentRequests.get(clientId) ?? []).filter((time) => now - time < 60_000);
    if (active.length >= 10) return json({ message: 'Too many imports. Try again shortly.' }, 429);
    recentRequests.set(clientId, [...active, now]);

    const body = await request.json();
    const imageBase64 =
      typeof body.imageBase64 === 'string' ? body.imageBase64.trim().slice(0, 6_000_000) : '';
    const mimeType =
      typeof body.mimeType === 'string' && body.mimeType.startsWith('image/')
        ? body.mimeType
        : 'image/jpeg';

    if (!imageBase64 || imageBase64.length < 100) {
      return json({ message: 'A valid photo is required.' }, 400);
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

    return json({
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
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import failed.';
    return json({ message }, 502);
  }
});
