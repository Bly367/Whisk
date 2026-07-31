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
  let sourceCategory = 'url';
  try {
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > 64_000) {
      await recordImportFailure(userId, 'url', sourceCategory, 413, 'request_too_large', startedAt);
      return json({ message: 'Request is too large.', code: 'request_too_large' }, 413);
    }

    const body = await request.json();
    const url = validatePublicUrl(body.url);
    const source = sourceFor(url);
    sourceCategory = source;
    const suppliedText =
      typeof body.suppliedText === 'string' ? body.suppliedText.trim().slice(0, 50_000) : '';

    const quota = await consumeImportQuota(userId, 'url', source);
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
      await completeImportEvent(
        eventId,
        userId,
        'failed',
        422,
        'insufficient_source_data',
        startedAt,
      );
      return json(
        {
          message:
            'This social post does not expose enough permitted recipe data. Paste its caption, add screenshots, or share a media file you own.',
          code: 'insufficient_source_data',
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
      await completeImportEvent(
        eventId,
        userId,
        'failed',
        422,
        'insufficient_recipe_data',
        startedAt,
      );
      return json(
        {
          message: 'Not enough recipe information was found.',
          code: 'insufficient_recipe_data',
        },
        422,
      );
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

    const responseBody = {
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
        await recordImportFailure(
          userId,
          'url',
          sourceCategory,
          status,
          errorCode,
          startedAt,
        );
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
