import { create } from 'zustand';

import type {
  AuthIdentity,
  AuthMode,
  AuthTokens,
  AuthTransport,
  AuthUser,
  SecureTokenStorage,
  SignInCredentials,
} from '@/data/sync/contracts';
import {
  createSecureTokenStorage,
  createMemorySecureTokenStorage,
} from '@/data/sync/secureTokenStorage';
import {
  createSharedCloudBackend,
  type SharedCloudBackend,
} from '@/data/sync/cloudBackend';
import { createAppAuthTransport, createAppEntitlementClient, getAppCloudBackend } from '@/data/sync/appCloudWiring';
import { useSessionStore } from '@/features/trust/sessionStore';

type AuthSessionDeps = {
  storage: SecureTokenStorage;
  transport: AuthTransport;
  cloud: SharedCloudBackend | null;
};

export type AuthSessionState = {
  mode: AuthMode;
  identity: AuthIdentity | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  signIn: (credentials: SignInCredentials) => Promise<void>;
  signOut: () => Promise<void>;
  getTokens: () => Promise<AuthTokens | null>;
  /** Test-only: swap storage/transport before sign-in. */
  configureForTests: (deps: Partial<AuthSessionDeps>) => void;
  /** Test-only: reset to guest with memory storage + stub transport. */
  resetForTests: () => Promise<void>;
};

function createDefaultDeps(): AuthSessionDeps {
  const storage = createSecureTokenStorage();
  return {
    storage,
    cloud: getAppCloudBackend(),
    transport: createAppAuthTransport(storage),
  };
}

let deps: AuthSessionDeps = createDefaultDeps();

// Align entitlement client with HTTP vs process-shared backend.
useSessionStore.getState().configureEntitlementClientForTests(
  createAppEntitlementClient(() => deps.storage.read()),
);

function identityFrom(user: AuthUser, hasTokens: boolean): AuthIdentity {
  return { user, hasTokens };
}

/**
 * Dev/test stub auth transport — accepts any non-empty email/password; no network.
 * Prefer createCloudAuthTransport / HTTP for cross-device sessions.
 */
export function createStubAuthTransport(
  preset?: { user?: AuthUser; tokens?: AuthTokens },
): AuthTransport {
  return {
    async signIn(credentials) {
      const email = credentials.email.trim().toLowerCase();
      if (!email || !credentials.password) {
        throw new Error('Email and password are required.');
      }
      const user =
        preset?.user ??
        ({
          id: `stub-${email}`,
          email,
          displayName: email.split('@')[0] || null,
        } satisfies AuthUser);
      const tokens =
        preset?.tokens ??
        ({
          accessToken: `stub-access-${user.id}`,
          refreshToken: `stub-refresh-${user.id}`,
          expiresAtIso: null,
        } satisfies AuthTokens);
      return { user, tokens };
    },
    async signOut() {
      // No remote session to revoke in the stub.
    },
  };
}

export const useAuthSessionStore = create<AuthSessionState>((set, get) => ({
  mode: 'guest',
  identity: null,
  hydrated: false,

  configureForTests(partial) {
    deps = {
      storage: partial.storage ?? deps.storage,
      transport: partial.transport ?? deps.transport,
      cloud: partial.cloud !== undefined ? partial.cloud : deps.cloud,
    };
  },

  async resetForTests() {
    const cloud = createSharedCloudBackend();
    const storage = createMemorySecureTokenStorage();
    deps = {
      storage,
      cloud,
      transport: createStubAuthTransport(),
    };
    await deps.storage.clear();
    set({ mode: 'guest', identity: null, hydrated: true });
  },

  async hydrate() {
    try {
      const tokens = await deps.storage.read();
      if (tokens) {
        const restored =
          deps.cloud?.resolveUser(tokens) ??
          ({
            id: 'restored',
            email: null,
            displayName: null,
          } satisfies AuthUser);
        const identity = identityFrom(restored, true);
        set({ mode: 'signed_in', identity, hydrated: true });
        await useSessionStore.getState().setMode('signed_in');
        if (restored.id !== 'restored') {
          await useSessionStore.getState().restoreEntitlementFromAccount(restored.id);
        }
        return;
      }
    } catch {
      // Secure store unavailable — remain guest; local core loop still works.
    }
    set({ mode: 'guest', identity: null, hydrated: true });
    // Align trust session (AsyncStorage mode) so a keychain wipe cannot leave
    // the UI stuck on signed_in without tokens.
    await useSessionStore.getState().setMode('guest');
  },

  async signIn(credentials) {
    const { user, tokens } = await deps.transport.signIn(credentials);
    await deps.storage.write(tokens);
    set({
      mode: 'signed_in',
      identity: identityFrom(user, true),
      hydrated: true,
    });
    await useSessionStore.getState().setMode('signed_in');
    await useSessionStore.getState().restoreEntitlementFromAccount(user.id);
  },

  async signOut() {
    try {
      await deps.transport.signOut();
    } catch {
      // Still clear local tokens — fail closed for session.
    }
    await deps.storage.clear();
    set({ mode: 'guest', identity: null, hydrated: true });
    await useSessionStore.getState().setMode('guest');
  },

  async getTokens() {
    return deps.storage.read();
  },
}));

/** Imperative access for sync client wiring outside React. */
export function getAuthTokens(): Promise<AuthTokens | null> {
  return useAuthSessionStore.getState().getTokens();
}

export {
  createAppAuthTransport,
  createAppEntitlementClient,
  createAppGroceryRealtimeTransport,
  getAppCloudBackend,
  householdCollaborationCloudOptions,
  describeSyncBackend,
  isHttpSyncConfigured,
} from '@/data/sync/appCloudWiring';

/** Cloud backend used by the live auth session (null when HTTP sync URL is set). */
export function getAuthCloudBackend(): SharedCloudBackend | null {
  return deps.cloud;
}
