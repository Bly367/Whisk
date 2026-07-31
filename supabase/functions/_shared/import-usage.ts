// @ts-nocheck — Supabase Edge Functions run in Deno, outside the Expo TypeScript runtime.
export type ImportKind = 'url' | 'image';
export type SourceCategory = 'url' | 'instagram' | 'tiktok' | 'facebook' | 'image';

export interface QuotaReservation {
  eventId: number;
  allowed: boolean;
  remaining: number;
  resetAt: string;
}

export class UsageServiceError extends Error {
  constructor() {
    super('Import usage service is unavailable.');
    this.name = 'UsageServiceError';
  }
}

export function configuredSecretKey(): string | undefined {
  const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacyKey) return legacyKey;

  try {
    const configured = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<
      string,
      string | { key?: unknown }
    >;
    const preferred = configured.default ?? Object.values(configured)[0];
    if (typeof preferred === 'string') return preferred;
    return typeof preferred?.key === 'string' ? preferred.key : undefined;
  } catch {
    return undefined;
  }
}

async function callAdminRpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const secretKey = configuredSecretKey();
  if (!supabaseUrl || !secretKey) throw new UsageServiceError();

  let response: Response;
  try {
    const headers: Record<string, string> = {
      apikey: secretKey,
      'Content-Type': 'application/json',
    };
    // Modern secret keys belong only in apikey. Legacy service-role JWTs also
    // need Authorization so PostgREST assumes the service_role.
    if (!secretKey.startsWith('sb_secret_')) {
      headers.Authorization = `Bearer ${secretKey}`;
    }
    response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new UsageServiceError();
  }

  if (!response.ok) {
    // Never surface or log the admin credential or upstream response body.
    throw new UsageServiceError();
  }
  try {
    const responseBody = await response.text();
    return (responseBody ? JSON.parse(responseBody) : null) as T;
  } catch {
    throw new UsageServiceError();
  }
}

export async function consumeImportQuota(
  userId: string,
  importKind: ImportKind,
  sourceCategory: SourceCategory,
): Promise<QuotaReservation> {
  const rows = await callAdminRpc<Array<{
    event_id: unknown;
    allowed: unknown;
    remaining: unknown;
    reset_at: unknown;
  }>>('consume_import_quota', {
    p_user_id: userId,
    p_import_kind: importKind,
    p_source_category: sourceCategory,
  });
  const row = rows[0];
  if (
    !row ||
    typeof row.event_id !== 'number' ||
    typeof row.allowed !== 'boolean' ||
    typeof row.remaining !== 'number' ||
    typeof row.reset_at !== 'string'
  ) {
    throw new UsageServiceError();
  }
  return {
    eventId: row.event_id,
    allowed: row.allowed,
    remaining: row.remaining,
    resetAt: row.reset_at,
  };
}

export async function completeImportEvent(
  eventId: number,
  userId: string,
  status: 'succeeded' | 'failed',
  httpStatus: number,
  errorCode: string | null,
  startedAt: number,
): Promise<void> {
  await callAdminRpc<null>('complete_import_event', {
    p_event_id: eventId,
    p_user_id: userId,
    p_status: status,
    p_http_status: httpStatus,
    p_error_code: errorCode,
    p_duration_ms: Math.max(0, Date.now() - startedAt),
  });
}

export async function recordImportFailure(
  userId: string,
  importKind: ImportKind,
  sourceCategory: SourceCategory,
  httpStatus: number,
  errorCode: string,
  startedAt: number,
): Promise<void> {
  await callAdminRpc<null>('record_import_event', {
    p_user_id: userId,
    p_import_kind: importKind,
    p_source_category: sourceCategory,
    p_http_status: httpStatus,
    p_error_code: errorCode,
    p_duration_ms: Math.max(0, Date.now() - startedAt),
  });
}
