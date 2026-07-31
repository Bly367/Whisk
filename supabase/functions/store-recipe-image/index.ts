// @ts-nocheck — Supabase Edge Functions run in Deno, outside the Expo TypeScript runtime.
import { createClient } from 'npm:@supabase/supabase-js@2.111.0';
import {
  authenticateRequest,
  AuthenticationError,
} from '../_shared/auth.ts';
import { configuredSecretKey } from '../_shared/import-usage.ts';

const BUCKET = 'recipe-images';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const allowedTypes = new Map([
  ['image/avif', 'avif'],
  ['image/gif', 'gif'],
  ['image/heic', 'heic'],
  ['image/heif', 'heif'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

function validateRecipeId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > 128 ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)
  ) {
    throw new RequestError('A valid recipe ID is required.', 400, 'invalid_recipe_id');
  }
  return value;
}

function validatePublicImageUrl(value: unknown): URL {
  if (typeof value !== 'string' || value.length > 2048) {
    throw new RequestError('A valid image URL is required.', 400, 'invalid_image_url');
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RequestError('A valid image URL is required.', 400, 'invalid_image_url');
  }
  if (url.protocol !== 'https:') {
    throw new RequestError('Only secure HTTPS images are supported.', 400, 'invalid_image_url');
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const blocked =
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === '::1' ||
    hostname === '0:0:0:0:0:0:0:1' ||
    /^(127|10|0)\./.test(hostname) ||
    /^169\.254\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    /^fc/i.test(hostname) ||
    /^fd/i.test(hostname) ||
    /^fe[89ab]/i.test(hostname);
  if (blocked) {
    throw new RequestError('Private network URLs are not supported.', 400, 'invalid_image_url');
  }
  return url;
}

async function fetchImage(url: URL, redirects = 0): Promise<{
  bytes: ArrayBuffer;
  contentType: string;
  extension: string;
}> {
  if (redirects > 3) {
    throw new RequestError('The image redirected too many times.', 422, 'image_fetch_failed');
  }

  let response: Response;
  try {
    response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/heic,image/heif',
        'User-Agent': 'WhiskRecipeImageStore/1.0',
      },
    });
  } catch {
    throw new RequestError('The source image could not be reached.', 422, 'image_fetch_failed');
  }

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (!location) {
      throw new RequestError('The image redirect was invalid.', 422, 'image_fetch_failed');
    }
    const target = validatePublicImageUrl(new URL(location, url).toString());
    return fetchImage(target, redirects + 1);
  }
  if (!response.ok) {
    throw new RequestError('The source image could not be downloaded.', 422, 'image_fetch_failed');
  }

  const contentType = (response.headers.get('content-type') ?? '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  const extension = allowedTypes.get(contentType);
  if (!extension) {
    throw new RequestError('The source is not a supported image.', 415, 'unsupported_image');
  }

  const declaredSize = Number(response.headers.get('content-length') ?? 0);
  if (declaredSize > MAX_IMAGE_BYTES) {
    throw new RequestError('The source image is too large.', 413, 'image_too_large');
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) {
    throw new RequestError('The source image was empty.', 422, 'image_fetch_failed');
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new RequestError('The source image is too large.', 413, 'image_too_large');
  }
  return { bytes, contentType, extension };
}

function adminStorageClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const secretKey = configuredSecretKey();
  if (!supabaseUrl || !secretKey) {
    throw new RequestError(
      'The image storage service is not configured.',
      503,
      'storage_unavailable',
    );
  }
  return createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.', code: 'method_not_allowed' }, 405);
  }

  try {
    const { userId } = await authenticateRequest(request);
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > 8_192) {
      throw new RequestError('Request is too large.', 413, 'request_too_large');
    }

    const body = await request.json();
    const recipeId = validateRecipeId(body.recipeId);
    const sourceUrl = validatePublicImageUrl(body.sourceUrl);
    const image = await fetchImage(sourceUrl);
    const storagePath = `${userId}/${recipeId}/${crypto.randomUUID()}.${image.extension}`;

    const { error } = await adminStorageClient()
      .storage.from(BUCKET)
      .upload(storagePath, image.bytes, {
        contentType: image.contentType,
        upsert: false,
      });
    if (error) {
      throw new RequestError(
        'The image could not be stored.',
        502,
        'storage_upload_failed',
      );
    }

    return json({ storagePath }, 200);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return json(
        { error: 'Sign in to back up recipe images.', code: 'authentication_required' },
        401,
      );
    }
    if (error instanceof RequestError) {
      return json({ error: error.message, code: error.code }, error.status);
    }
    return json(
      { error: 'Image backup failed.', code: 'image_backup_failed' },
      500,
    );
  }
});
