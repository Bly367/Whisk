/**
 * P2-W1 — Sync & auth foundation (test-first).
 *
 * Acceptance covered:
 * - Guest/local core loop works with network off (no auth required for local persist)
 * - Optional sign-in; tokens in secure storage (not AsyncStorage)
 * - Sign-out clears session tokens
 * - Sync status never reaches "synced" before local persist
 * - Published sync/auth contracts are usable by later workstreams
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createMemorySecureTokenStorage,
  createSecureTokenStorage,
  SECURE_TOKEN_STORAGE_KEY,
} from '@/data/sync/secureTokenStorage';
import {
  createStubAuthTransport,
  useAuthSessionStore,
} from '@/data/sync/authSession';
import {
  createStubSyncTransport,
  createSyncClient,
} from '@/data/sync/syncClient';
import {
  useSyncStatusStore,
  withLocalPersist,
} from '@/data/sync/statusStore';
import type {
  AuthTokens,
  SyncPushRequest,
} from '@/data/sync/contracts';
import { useSessionStore } from '@/features/trust/sessionStore';

const SAMPLE_TOKENS: AuthTokens = {
  accessToken: 'access-test-token',
  refreshToken: 'refresh-test-token',
  expiresAtIso: '2099-01-01T00:00:00.000Z',
};

const SAMPLE_PUSH: SyncPushRequest = {
  householdId: null,
  items: [
    {
      kind: 'recipe',
      localId: 'recipe-1',
      revision: 1,
      body: { title: 'Soup' },
    },
  ],
};

describe('P2-W1 secure token storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('expo-secure-store').__resetSecureStoreMock();
  });

  it('stores tokens in secure storage, not AsyncStorage', async () => {
    const storage = createSecureTokenStorage();
    await storage.write(SAMPLE_TOKENS);

    const asyncKeys = await AsyncStorage.getAllKeys();
    expect(asyncKeys).not.toContain(SECURE_TOKEN_STORAGE_KEY);
    expect(asyncKeys.every((k) => !k.toLowerCase().includes('token'))).toBe(true);

    const read = await storage.read();
    expect(read).toEqual(SAMPLE_TOKENS);
  });

  it('clear removes tokens from secure storage', async () => {
    const storage = createMemorySecureTokenStorage();
    await storage.write(SAMPLE_TOKENS);
    await storage.clear();
    expect(await storage.read()).toBeNull();
  });
});

describe('P2-W1 auth session', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useSessionStore.getState().resetSessionForTests({ mode: 'guest' });
    await useAuthSessionStore.getState().resetForTests();
  });

  it('stays guest without network and without tokens', async () => {
    await useAuthSessionStore.getState().hydrate();
    const state = useAuthSessionStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.identity).toBeNull();
    expect(state.mode).toBe('guest');
    expect(useSessionStore.getState().mode).toBe('guest');
  });

  it('optional sign-in stores tokens securely and flips mode to signed_in', async () => {
    const storage = createMemorySecureTokenStorage();
    const transport = createStubAuthTransport({
      user: { id: 'user-1', email: 'cook@example.com', displayName: 'Cook' },
      tokens: SAMPLE_TOKENS,
    });
    useAuthSessionStore.getState().configureForTests({ storage, transport });

    await useAuthSessionStore.getState().signIn({
      email: 'cook@example.com',
      password: 'not-a-real-secret',
    });

    const auth = useAuthSessionStore.getState();
    expect(auth.mode).toBe('signed_in');
    expect(auth.identity).toEqual({
      user: { id: 'user-1', email: 'cook@example.com', displayName: 'Cook' },
      hasTokens: true,
    });
    expect(useSessionStore.getState().mode).toBe('signed_in');

    const stored = await storage.read();
    expect(stored).toEqual(SAMPLE_TOKENS);

    const asyncKeys = await AsyncStorage.getAllKeys();
    expect(asyncKeys).not.toContain(SECURE_TOKEN_STORAGE_KEY);
  });

  it('sign-out clears tokens and returns to guest', async () => {
    const storage = createMemorySecureTokenStorage();
    const transport = createStubAuthTransport({
      user: { id: 'user-1', email: 'cook@example.com', displayName: 'Cook' },
      tokens: SAMPLE_TOKENS,
    });
    useAuthSessionStore.getState().configureForTests({ storage, transport });

    await useAuthSessionStore.getState().signIn({
      email: 'cook@example.com',
      password: 'pw',
    });
    await useAuthSessionStore.getState().signOut();

    expect(useAuthSessionStore.getState().mode).toBe('guest');
    expect(useAuthSessionStore.getState().identity).toBeNull();
    expect(await storage.read()).toBeNull();
    expect(useSessionStore.getState().mode).toBe('guest');
  });
});

describe('P2-W1 sync status vs local persist', () => {
  beforeEach(() => {
    useSyncStatusStore.getState().resetToLocalOk();
    useSyncStatusStore.setState({ lastLocalPersistAt: null, status: 'offline' });
  });

  it('never marks synced before local persist succeeds', () => {
    useSyncStatusStore.getState().markRemoteSyncSucceeded();
    expect(useSyncStatusStore.getState().status).not.toBe('synced');
    expect(useSyncStatusStore.getState().status).toBe('needs_attention');
  });

  it('marks synced only after local persist then remote success', () => {
    withLocalPersist(() => 'ok');
    expect(useSyncStatusStore.getState().status).toBe('saved_locally');
    expect(useSyncStatusStore.getState().lastLocalPersistAt).not.toBeNull();

    useSyncStatusStore.getState().markRemoteSyncStarted();
    expect(useSyncStatusStore.getState().status).toBe('syncing');

    useSyncStatusStore.getState().markRemoteSyncSucceeded();
    expect(useSyncStatusStore.getState().status).toBe('synced');
  });

  it('remote failure after local persist surfaces needs_attention without claiming synced', () => {
    withLocalPersist(() => 'ok');
    useSyncStatusStore.getState().markRemoteSyncStarted();
    useSyncStatusStore.getState().markRemoteSyncFailed('transport down');
    expect(useSyncStatusStore.getState().status).toBe('needs_attention');
    expect(useSyncStatusStore.getState().detail).toMatch(/transport down/i);
  });
});

describe('P2-W1 sync client contracts', () => {
  beforeEach(async () => {
    await useAuthSessionStore.getState().resetForTests();
  });

  it('skips remote push when guest (network optional; local loop unaffected)', async () => {
    const transport = createStubSyncTransport();
    const client = createSyncClient({
      transport,
      getTokens: async () => null,
    });

    const result = await client.pushPending(SAMPLE_PUSH);
    expect(result).toEqual({ skipped: 'guest' });
    expect(transport.calls.push).toHaveLength(0);
  });

  it('signed-in push uses transport stub and returns accepted ids', async () => {
    const transport = createStubSyncTransport();
    const client = createSyncClient({
      transport,
      getTokens: async () => SAMPLE_TOKENS,
    });

    const result = await client.pushPending(SAMPLE_PUSH);
    expect(result).toEqual({
      accepted: ['recipe-1'],
      rejected: [],
    });
    expect(transport.calls.push).toHaveLength(1);
    expect(transport.calls.push[0].tokens.accessToken).toBe(SAMPLE_TOKENS.accessToken);
  });

  it('wires local persist then remote attempt without celebrating early', async () => {
    useSyncStatusStore.setState({ lastLocalPersistAt: null, status: 'offline', detail: null });
    const transport = createStubSyncTransport();
    const client = createSyncClient({
      transport,
      getTokens: async () => SAMPLE_TOKENS,
    });

    await client.persistLocalThenSync({
      localWrite: () => 'saved',
      pushRequest: SAMPLE_PUSH,
    });

    expect(useSyncStatusStore.getState().lastLocalPersistAt).not.toBeNull();
    expect(useSyncStatusStore.getState().status).toBe('synced');
    expect(transport.calls.push).toHaveLength(1);
  });

  it('does not claim synced when local write throws before remote', async () => {
    useSyncStatusStore.setState({ lastLocalPersistAt: null, status: 'offline', detail: null });
    const transport = createStubSyncTransport();
    const client = createSyncClient({
      transport,
      getTokens: async () => SAMPLE_TOKENS,
    });

    await expect(
      client.persistLocalThenSync({
        localWrite: () => {
          throw new Error('sqlite busy');
        },
        pushRequest: SAMPLE_PUSH,
      }),
    ).rejects.toThrow(/sqlite busy/);

    expect(useSyncStatusStore.getState().status).toBe('needs_attention');
    expect(useSyncStatusStore.getState().status).not.toBe('synced');
    expect(transport.calls.push).toHaveLength(0);
  });
});
