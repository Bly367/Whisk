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

function validatePublicUrl(value: unknown): URL {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Invalid URL.');
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('Only public HTTPS URLs are supported.');
  const hostname = url.hostname.toLowerCase();
  const blocked =
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    /^(127|10|0)\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    hostname === '::1';
  if (blocked) throw new Error('Private network URLs are not supported.');
  return url;
}

function sourceFor(url: URL) {
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram';
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok';
  if (host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.watch') {
    return 'facebook';
  }
  return 'url';
}

function readablePageText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50_000);
}

function extractPageMetadata(html: string) {
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
    const value = html.match(pattern)?.[1] ?? html.match(reverse)?.[1];
    return value
      ? value
          .replace(/&quot;/g, '"')
          .replace(/&#39;|&apos;/g, "'")
          .replace(/&amp;/g, '&')
          .replace(/\s+/g, ' ')
          .trim()
      : undefined;
  };
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  return {
    title: meta('og:title') ?? titleTag,
    description:
      meta('og:description') ??
      meta('description') ??
      meta('twitter:description'),
    imageUrl: meta('og:image') ?? meta('twitter:image'),
  };
}

function socialCaptionFromMetadata(metadata: {
  title?: string;
  description?: string;
}) {
  const parts = [metadata.title, metadata.description].filter(Boolean);
  return parts.join('\n\n').trim();
}

async function fetchPublicPage(url: URL, redirects = 0): Promise<string> {
  if (redirects > 3) throw new Error('Too many redirects.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'WhiskRecipeImporter/1.0',
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const redirect = response.headers.get('location');
      if (!redirect) throw new Error('Invalid redirect.');
      const target = validatePublicUrl(new URL(redirect, url).toString());
      return fetchPublicPage(target, redirects + 1);
    }
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}.`);
    const type = response.headers.get('content-type') ?? '';
    if (!type.includes('text/html')) throw new Error('Source is not a webpage.');
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > 1_500_000) throw new Error('Source page is too large.');
    const text = await response.text();
    if (text.length > 1_500_000) throw new Error('Source page is too large.');
    return text;
  } finally {
    clearTimeout(timeout);
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

async function structureWithAI(text: string, sourceUrl: string) {
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
      model: Deno.env.get('OPENAI_MODEL') ?? 'gpt-5-mini',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'Convert only explicit recipe facts into structured data. Never invent quantities, times, servings, ingredients, or steps. Use empty strings/arrays or null when absent.',
        },
        {
          role: 'user',
          content: `Source: ${sourceUrl}\n\nRecipe evidence:\n${text.slice(0, 50_000)}`,
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ message: 'Method not allowed.' }, 405);
  if (!isValidPublishableKey(request.headers.get('apikey'))) {
    return json({ message: 'Unauthorized.' }, 401);
  }

  try {
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > 64_000) return json({ message: 'Request is too large.' }, 413);
    const clientId =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('authorization')?.slice(-16) ??
      'anonymous';
    const now = Date.now();
    const active = (recentRequests.get(clientId) ?? []).filter((time) => now - time < 60_000);
    if (active.length >= 20) return json({ message: 'Too many imports. Try again shortly.' }, 429);
    recentRequests.set(clientId, [...active, now]);

    const body = await request.json();
    const url = validatePublicUrl(body.url);
    const source = sourceFor(url);
    const suppliedText =
      typeof body.suppliedText === 'string' ? body.suppliedText.trim().slice(0, 50_000) : '';

    let evidenceText = suppliedText;
    let evidenceKind = 'user-text';
    let imageUrl: string | undefined;

    if (!evidenceText && source !== 'url') {
      try {
        const html = await fetchPublicPage(url);
        const metadata = extractPageMetadata(html);
        imageUrl = metadata.imageUrl;
        const metadataText = socialCaptionFromMetadata(metadata);
        if (metadataText.length >= 40) {
          evidenceText = metadataText;
          evidenceKind = 'metadata';
        } else {
          const pageText = readablePageText(html);
          if (pageText.length >= 40) {
            evidenceText = pageText;
            evidenceKind = 'page-text';
          }
        }
      } catch {
        // Fall through to assisted-input response below.
      }
    }

    if (!evidenceText && source !== 'url') {
      return json(
        {
          message:
            'This social post does not expose enough permitted recipe data. Paste its caption, add screenshots, or share a media file you own.',
        },
        422,
      );
    }

    if (!evidenceText) {
      const html = await fetchPublicPage(url);
      const metadata = extractPageMetadata(html);
      imageUrl = metadata.imageUrl;
      evidenceText = readablePageText(html);
      evidenceKind = 'page-text';
    }
    if (evidenceText.length < 40) {
      return json({ message: 'Not enough recipe information was found.' }, 422);
    }

    const recipe = await structureWithAI(evidenceText, url.toString());
    const warnings = [];
    if (!recipe.ingredients?.length) {
      warnings.push({
        code: 'missing_ingredients',
        message: 'No complete ingredient list was found.',
        field: 'ingredients',
      });
    }
    if (!recipe.steps?.length) {
      warnings.push({
        code: 'missing_instructions',
        message: 'No complete cooking instructions were found.',
        field: 'steps',
      });
    }

    return json({
      ...recipe,
      description: recipe.description ?? undefined,
      imageUrl,
      sourceAttribution: recipe.sourceAttribution ?? url.hostname,
      prepTime: recipe.prepTime ?? undefined,
      cookTime: recipe.cookTime ?? undefined,
      evidence: [{ kind: evidenceKind, value: evidenceText, sourceUrl: url.toString() }],
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
    return json({ message }, message.includes('Invalid') ? 400 : 502);
  }
});
