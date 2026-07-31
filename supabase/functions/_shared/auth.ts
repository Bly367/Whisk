// @ts-nocheck — Supabase Edge Functions run in Deno, outside the Expo TypeScript runtime.
export class AuthenticationError extends Error {
  constructor(message = 'A valid signed-in session is required.') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

type KeyEntry = string | { key?: unknown };

function configuredKeys(variable: string): string[] {
  try {
    const parsed = JSON.parse(Deno.env.get(variable) ?? '{}') as Record<string, KeyEntry>;
    return Object.values(parsed).flatMap((entry) => {
      if (typeof entry === 'string') return [entry];
      return typeof entry?.key === 'string' ? [entry.key] : [];
    });
  } catch {
    return [];
  }
}

export function isValidPublishableKey(key: string | null): key is string {
  if (!key) return false;
  const legacyFallback = Deno.env.get('SUPABASE_ANON_KEY');
  const singleKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  return (
    key === singleKey ||
    key === legacyFallback ||
    configuredKeys('SUPABASE_PUBLISHABLE_KEYS').includes(key)
  );
}

function bearerToken(header: string | null): string {
  const match = header?.match(/^Bearer ([^\s]+)$/i);
  const token = match?.[1];
  if (!token || token.length > 8_192 || token.startsWith('sb_publishable_')) {
    throw new AuthenticationError();
  }
  return token;
}

export async function authenticateRequest(request: Request): Promise<{ userId: string }> {
  const publishableKey = request.headers.get('apikey');
  if (!isValidPublishableKey(publishableKey)) {
    throw new AuthenticationError();
  }

  const token = bearerToken(request.headers.get('authorization'));
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) throw new Error('Authentication service is not configured.');

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new Error('Authentication service is unavailable.');
  }

  if (!response.ok) {
    // Do not include the token or upstream response in errors/logs.
    throw new AuthenticationError();
  }

  const user = await response.json() as { id?: unknown };
  if (
    typeof user.id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      user.id,
    )
  ) {
    throw new AuthenticationError();
  }

  return { userId: user.id };
}
