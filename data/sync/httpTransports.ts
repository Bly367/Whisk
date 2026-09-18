/**
 * HTTP client transports for the Whisk sync server (`npm run sync-server`).
 * Used when EXPO_PUBLIC_WHISK_SYNC_URL is set so two physical devices share state.
 */

import type {
  AuthTokens,
  AuthTransport,
  AuthUser,
  SyncPullRequest,
  SyncPushRequest,
  SyncTransport,
} from '@/data/sync/contracts';
import type {
  GroceryRealtimeEvent,
  GroceryRealtimeTransport,
} from '@/data/sync/groceryRealtime';
import type {
  CloudHouseholdSnapshot,
  EntitlementClient,
  SharedCloudBackend,
} from '@/data/sync/cloudBackend';
import type { Entitlement } from '@/features/trust/freeTier';

function syncBaseUrl(): string | null {
  const raw = process.env.EXPO_PUBLIC_WHISK_SYNC_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

export function isHttpSyncConfigured(): boolean {
  return Boolean(syncBaseUrl());
}

async function api<T>(
  path: string,
  init: RequestInit & { tokens?: AuthTokens | null } = {},
): Promise<T> {
  const base = syncBaseUrl();
  if (!base) {
    throw new Error('EXPO_PUBLIC_WHISK_SYNC_URL is not configured.');
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.tokens?.accessToken) {
    headers.Authorization = `Bearer ${init.tokens.accessToken}`;
  }
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers,
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || `Sync server error (${response.status})`);
  }
  return data;
}

export function createHttpAuthTransport(): AuthTransport {
  let lastTokens: AuthTokens | null = null;
  return {
    async signIn(credentials) {
      const result = await api<{ user: AuthUser; tokens: AuthTokens }>('/auth/sign-in', {
        method: 'POST',
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
        }),
      });
      lastTokens = result.tokens;
      return result;
    },
    async signOut() {
      if (lastTokens) {
        try {
          await api('/auth/sign-out', { method: 'POST', tokens: lastTokens });
        } catch {
          // Local clear still happens in authSession.
        }
      }
      lastTokens = null;
    },
  };
}

export function createHttpSyncTransport(): SyncTransport {
  return {
    async push(request: SyncPushRequest, tokens: AuthTokens) {
      return api('/sync/push', {
        method: 'POST',
        tokens,
        body: JSON.stringify(request),
      });
    },
    async pull(request: SyncPullRequest, tokens: AuthTokens) {
      return api('/sync/pull', {
        method: 'POST',
        tokens,
        body: JSON.stringify(request),
      });
    },
  };
}

export function createHttpEntitlementClient(
  getTokens: () => Promise<AuthTokens | null>,
): EntitlementClient {
  return {
    async getEntitlement(_userId: string) {
      const tokens = await getTokens();
      if (!tokens) return 'free';
      const result = await api<{ entitlement: Entitlement }>('/entitlements/me', {
        method: 'GET',
        tokens,
      });
      return result.entitlement;
    },
    async setEntitlement(_userId: string, entitlement: Entitlement) {
      const tokens = await getTokens();
      if (!tokens) return;
      await api('/entitlements/me', {
        method: 'POST',
        tokens,
        body: JSON.stringify({ entitlement }),
      });
    },
  };
}

export function createHttpGroceryRealtimeTransport(
  getTokens: () => Promise<AuthTokens | null>,
): GroceryRealtimeTransport {
  const pollers = new Map<string, ReturnType<typeof setInterval>>();
  const cursors = new Map<string, number>();

  return {
    async subscribe(householdId, tokens, onEvent) {
      cursors.set(householdId, 0);
      const tick = async () => {
        try {
          const since = cursors.get(householdId) ?? 0;
          const base = syncBaseUrl();
          if (!base) return;
          const response = await fetch(
            `${base}/grocery/poll?householdId=${encodeURIComponent(householdId)}&since=${since}`,
            { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
          );
          if (!response.ok) return;
          const data = (await response.json()) as {
            events: GroceryRealtimeEvent[];
            nextIndex: number;
          };
          cursors.set(householdId, data.nextIndex);
          for (const event of data.events) {
            onEvent(event);
          }
        } catch {
          // Poll failures are transient; local shop still works.
        }
      };
      await tick();
      const handle = setInterval(() => void tick(), 1500);
      pollers.set(householdId, handle);
      return () => {
        const existing = pollers.get(householdId);
        if (existing) clearInterval(existing);
        pollers.delete(householdId);
      };
    },
    async publish(event, tokens) {
      await api('/grocery/publish', {
        method: 'POST',
        tokens,
        body: JSON.stringify({ event }),
      });
    },
  };
}

/**
 * Thin SharedCloudBackend-shaped adapter over HTTP for household registry.
 * Only the household methods are used by collaboration; other methods throw.
 */
export function createHttpHouseholdCloudAdapter(
  getTokens: () => Promise<AuthTokens | null>,
): Pick<SharedCloudBackend, 'registerHousehold' | 'resolveInvite' | 'addHouseholdMember'> {
  return {
    registerHousehold(snapshot: CloudHouseholdSnapshot) {
      void (async () => {
        const tokens = await getTokens();
        if (!tokens) return;
        await api('/households/register', {
          method: 'POST',
          tokens,
          body: JSON.stringify(snapshot),
        });
      })();
    },
    resolveInvite(inviteCode: string) {
      // Sync facade: collaboration expects a sync return. Callers that need
      // HTTP join should use joinHouseholdViaHttp.
      void inviteCode;
      return null;
    },
    addHouseholdMember() {
      return null;
    },
  };
}

export async function joinHouseholdViaHttp(
  inviteCode: string,
  displayName: string | null,
  getTokens: () => Promise<AuthTokens | null>,
): Promise<CloudHouseholdSnapshot> {
  const tokens = await getTokens();
  if (!tokens) {
    throw new Error('Sign in to join a household across devices.');
  }
  return api<CloudHouseholdSnapshot>('/households/join', {
    method: 'POST',
    tokens,
    body: JSON.stringify({ inviteCode, displayName }),
  });
}

export async function resolveInviteViaHttp(
  inviteCode: string,
): Promise<CloudHouseholdSnapshot | null> {
  const base = syncBaseUrl();
  if (!base) return null;
  const response = await fetch(
    `${base}/households/invite?code=${encodeURIComponent(inviteCode.trim().toUpperCase())}`,
  );
  if (!response.ok) return null;
  return (await response.json()) as CloudHouseholdSnapshot;
}
