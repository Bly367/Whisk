/**
 * Shared cloud backend for real P2-W1 sync/auth + account-bound entitlements.
 *
 * In-process store is the source of truth for Jest multi-"device" tests and for
 * the optional HTTP sync server (`server/whisk-sync-server.mjs`). Mobile clients
 * use the same AuthTransport / SyncTransport / GroceryRealtimeTransport contracts.
 *
 * This is not a substitute for production Supabase Auth + RLS long-term
 * (see SECURITY.md §6) — it is the real replaceable backend behind those contracts
 * so household sync and unlock work across devices before Phase 3.
 */

import type {
  AuthTokens,
  AuthTransport,
  AuthUser,
  SyncEntityKind,
  SyncPullItem,
  SyncPullRequest,
  SyncPushRequest,
  SyncPushResult,
  SyncTransport,
} from '@/data/sync/contracts';
import type {
  GroceryRealtimeEvent,
  GroceryRealtimeTransport,
  GroceryRealtimeUnsubscribe,
} from '@/data/sync/groceryRealtime';
import type { Entitlement } from '@/features/trust/freeTier';
import { createId, nowIso } from '@/data/util';

export type CloudHouseholdMember = {
  userId: string;
  displayName: string | null;
  role: 'owner' | 'member';
  status: 'active' | 'invited' | 'removed';
};

export type CloudHouseholdSnapshot = {
  id: string;
  name: string;
  ownerUserId: string;
  inviteCode: string;
  members: CloudHouseholdMember[];
  updatedAtIso: string;
};

export type CloudSyncEntity = {
  kind: SyncEntityKind;
  remoteId: string;
  localId: string;
  userId: string;
  householdId: string | null;
  revision: number;
  body: Record<string, unknown>;
  updatedAtIso: string;
};

export type CloudEntitlementRecord = {
  userId: string;
  entitlement: Entitlement;
  updatedAtIso: string;
};

type CloudUserRecord = {
  id: string;
  email: string;
  displayName: string | null;
  /** Plain compare for shared-backend tests/dev server — not a production auth SDK. */
  password: string;
};

type CloudSessionRecord = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  expiresAtIso: string | null;
};

export type SharedCloudBackend = {
  /** Test/observability */
  listEntities(): CloudSyncEntity[];
  listEntitlements(): CloudEntitlementRecord[];
  listHouseholds(): CloudHouseholdSnapshot[];
  reset(): void;

  /** Auth */
  signIn(email: string, password: string): { user: AuthUser; tokens: AuthTokens };
  signOut(accessToken: string | null): void;
  resolveUser(tokens: AuthTokens): AuthUser | null;
  getUserById(userId: string): AuthUser | null;

  /** Sync */
  push(request: SyncPushRequest, tokens: AuthTokens): SyncPushResult;
  pull(request: SyncPullRequest, tokens: AuthTokens): {
    items: SyncPullItem[];
    serverTimeIso: string;
  };

  /** Household registry (invite codes work across devices) */
  registerHousehold(snapshot: CloudHouseholdSnapshot): void;
  resolveInvite(inviteCode: string): CloudHouseholdSnapshot | null;
  addHouseholdMember(
    householdId: string,
    member: CloudHouseholdMember,
  ): CloudHouseholdSnapshot | null;

  /** Grocery realtime */
  subscribeGrocery(
    householdId: string,
    onEvent: (event: GroceryRealtimeEvent) => void,
  ): GroceryRealtimeUnsubscribe;
  publishGrocery(event: GroceryRealtimeEvent): void;

  /** Entitlements (account-bound unlock) */
  setEntitlement(userId: string, entitlement: Entitlement): void;
  getEntitlement(userId: string): Entitlement;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeInvite(code: string): string {
  return code.trim().toUpperCase();
}

function entityKey(userId: string, kind: SyncEntityKind, localId: string): string {
  return `${userId}:${kind}:${localId}`;
}

/** Process-wide default used by the app when no HTTP sync URL is configured. */
let processDefaultBackend: SharedCloudBackend | null = null;

export function getProcessSharedCloudBackend(): SharedCloudBackend {
  if (!processDefaultBackend) {
    processDefaultBackend = createSharedCloudBackend();
  }
  return processDefaultBackend;
}

export function resetProcessSharedCloudBackendForTests(): void {
  processDefaultBackend = createSharedCloudBackend();
}

export function createSharedCloudBackend(): SharedCloudBackend {
  const usersByEmail = new Map<string, CloudUserRecord>();
  const usersById = new Map<string, CloudUserRecord>();
  const sessionsByAccess = new Map<string, CloudSessionRecord>();
  const entities = new Map<string, CloudSyncEntity>();
  const householdsById = new Map<string, CloudHouseholdSnapshot>();
  const householdsByInvite = new Map<string, string>();
  const entitlements = new Map<string, CloudEntitlementRecord>();
  const groceryListeners = new Map<string, Set<(event: GroceryRealtimeEvent) => void>>();

  function requireUser(tokens: AuthTokens): CloudUserRecord {
    const session = sessionsByAccess.get(tokens.accessToken);
    if (!session) {
      throw new Error('Invalid or expired session.');
    }
    const user = usersById.get(session.userId);
    if (!user) {
      throw new Error('Invalid or expired session.');
    }
    return user;
  }

  function toAuthUser(user: CloudUserRecord): AuthUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    };
  }

  const backend: SharedCloudBackend = {
    listEntities() {
      return [...entities.values()];
    },
    listEntitlements() {
      return [...entitlements.values()];
    },
    listHouseholds() {
      return [...householdsById.values()];
    },
    reset() {
      usersByEmail.clear();
      usersById.clear();
      sessionsByAccess.clear();
      entities.clear();
      householdsById.clear();
      householdsByInvite.clear();
      entitlements.clear();
      groceryListeners.clear();
    },

    signIn(email, password) {
      const normalized = normalizeEmail(email);
      if (!normalized || !password) {
        throw new Error('Email and password are required.');
      }
      let user = usersByEmail.get(normalized);
      if (!user) {
        user = {
          id: createId(),
          email: normalized,
          displayName: normalized.split('@')[0] || null,
          password,
        };
        usersByEmail.set(normalized, user);
        usersById.set(user.id, user);
      } else if (user.password !== password) {
        throw new Error('Invalid email or password.');
      }

      const tokens: AuthTokens = {
        accessToken: `access-${createId()}`,
        refreshToken: `refresh-${createId()}`,
        expiresAtIso: null,
      };
      sessionsByAccess.set(tokens.accessToken, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        userId: user.id,
        expiresAtIso: tokens.expiresAtIso,
      });
      return { user: toAuthUser(user), tokens };
    },

    signOut(accessToken) {
      if (accessToken) {
        sessionsByAccess.delete(accessToken);
      }
    },

    resolveUser(tokens) {
      try {
        return toAuthUser(requireUser(tokens));
      } catch {
        return null;
      }
    },

    getUserById(userId) {
      const user = usersById.get(userId);
      return user ? toAuthUser(user) : null;
    },

    push(request, tokens) {
      const user = requireUser(tokens);
      const accepted: string[] = [];
      const rejected: { localId: string; reason: string }[] = [];
      const now = nowIso();

      for (const item of request.items) {
        if (request.householdId) {
          const household = householdsById.get(request.householdId);
          const member = household?.members.find(
            (m) => m.userId === user.id && m.status === 'active',
          );
          if (!household || !member) {
            rejected.push({ localId: item.localId, reason: 'Not authorized for this household.' });
            continue;
          }
        }

        const key = entityKey(user.id, item.kind, item.localId);
        const existing = entities.get(key);
        if (existing && existing.revision > item.revision) {
          rejected.push({ localId: item.localId, reason: 'stale_revision' });
          continue;
        }
        const remoteId = existing?.remoteId ?? `remote-${item.kind}-${item.localId}`;
        entities.set(key, {
          kind: item.kind,
          remoteId,
          localId: item.localId,
          userId: user.id,
          householdId: request.householdId,
          revision: item.revision,
          body: item.body,
          updatedAtIso: now,
        });
        accepted.push(item.localId);
      }

      return { accepted, rejected };
    },

    pull(request, tokens) {
      const user = requireUser(tokens);
      const since = request.sinceIso ? Date.parse(request.sinceIso) : null;
      const items: SyncPullItem[] = [];

      for (const entity of entities.values()) {
        if (entity.userId !== user.id) {
          // Household-scoped rows: allow active members to pull household entities.
          if (!request.householdId || entity.householdId !== request.householdId) {
            continue;
          }
          const household = householdsById.get(request.householdId);
          const member = household?.members.find(
            (m) => m.userId === user.id && m.status === 'active',
          );
          if (!member) {
            continue;
          }
        } else if (request.householdId && entity.householdId !== request.householdId) {
          continue;
        } else if (!request.householdId && entity.householdId != null) {
          // Personal pull: skip household-tenanted rows unless requested.
          continue;
        }

        if (since != null) {
          const updated = Date.parse(entity.updatedAtIso);
          if (Number.isFinite(updated) && updated <= since) {
            continue;
          }
        }

        items.push({
          kind: entity.kind,
          remoteId: entity.remoteId,
          localId: entity.localId,
          revision: entity.revision,
          body: entity.body,
          updatedAtIso: entity.updatedAtIso,
        });
      }

      return { items, serverTimeIso: nowIso() };
    },

    registerHousehold(snapshot) {
      const invite = normalizeInvite(snapshot.inviteCode);
      const next: CloudHouseholdSnapshot = {
        ...snapshot,
        inviteCode: invite,
        members: snapshot.members.map((m) => ({ ...m })),
        updatedAtIso: snapshot.updatedAtIso || nowIso(),
      };
      householdsById.set(next.id, next);
      householdsByInvite.set(invite, next.id);
    },

    resolveInvite(inviteCode) {
      const id = householdsByInvite.get(normalizeInvite(inviteCode));
      if (!id) return null;
      return householdsById.get(id) ?? null;
    },

    addHouseholdMember(householdId, member) {
      const existing = householdsById.get(householdId);
      if (!existing) return null;
      const members = existing.members.filter((m) => m.userId !== member.userId);
      members.push({ ...member });
      const next: CloudHouseholdSnapshot = {
        ...existing,
        members,
        updatedAtIso: nowIso(),
      };
      householdsById.set(householdId, next);
      householdsByInvite.set(normalizeInvite(next.inviteCode), householdId);
      return next;
    },

    subscribeGrocery(householdId, onEvent) {
      let set = groceryListeners.get(householdId);
      if (!set) {
        set = new Set();
        groceryListeners.set(householdId, set);
      }
      set.add(onEvent);
      return () => {
        set?.delete(onEvent);
        if (set && set.size === 0) {
          groceryListeners.delete(householdId);
        }
      };
    },

    publishGrocery(event) {
      const set = groceryListeners.get(event.householdId);
      if (!set) return;
      for (const listener of [...set]) {
        listener(event);
      }
    },

    setEntitlement(userId, entitlement) {
      entitlements.set(userId, {
        userId,
        entitlement,
        updatedAtIso: nowIso(),
      });
    },

    getEntitlement(userId) {
      return entitlements.get(userId)?.entitlement ?? 'free';
    },
  };

  return backend;
}

export function createCloudAuthTransport(
  cloud: SharedCloudBackend,
  options?: { getAccessToken?: () => Promise<string | null> },
): AuthTransport {
  let lastAccessToken: string | null = null;
  return {
    async signIn(credentials) {
      const result = cloud.signIn(credentials.email, credentials.password);
      lastAccessToken = result.tokens.accessToken;
      return result;
    },
    async signOut() {
      const token = options?.getAccessToken
        ? await options.getAccessToken()
        : lastAccessToken;
      cloud.signOut(token);
      lastAccessToken = null;
    },
  };
}

export function createCloudSyncTransport(cloud: SharedCloudBackend): SyncTransport {
  return {
    async push(request, tokens) {
      return cloud.push(request, tokens);
    },
    async pull(request, tokens) {
      return cloud.pull(request, tokens);
    },
  };
}

export function createCloudGroceryRealtimeTransport(
  cloud: SharedCloudBackend,
): GroceryRealtimeTransport {
  return {
    async subscribe(householdId, _tokens, onEvent) {
      return cloud.subscribeGrocery(householdId, onEvent);
    },
    async publish(event, _tokens) {
      cloud.publishGrocery(event);
    },
  };
}

export type EntitlementClient = {
  getEntitlement(userId: string): Promise<Entitlement>;
  setEntitlement(userId: string, entitlement: Entitlement): Promise<void>;
};

export function createCloudEntitlementClient(cloud: SharedCloudBackend): EntitlementClient {
  return {
    async getEntitlement(userId) {
      return cloud.getEntitlement(userId);
    },
    async setEntitlement(userId, entitlement) {
      cloud.setEntitlement(userId, entitlement);
    },
  };
}

/** Default app wiring: process-shared cloud (same binary / tests). */
export function createDefaultCloudStack(cloud: SharedCloudBackend = getProcessSharedCloudBackend()) {
  return {
    cloud,
    authTransport: createCloudAuthTransport(cloud),
    syncTransport: createCloudSyncTransport(cloud),
    groceryTransport: createCloudGroceryRealtimeTransport(cloud),
    entitlementClient: createCloudEntitlementClient(cloud),
  };
}
