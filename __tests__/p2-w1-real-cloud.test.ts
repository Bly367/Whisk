/**
 * P2-W1 real cloud + account-bound billing (test-first).
 *
 * Acceptance:
 * - Two "devices" sharing one cloud backend can sign in as the same user
 *   and push/pull recipe sync (not stub no-ops).
 * - Household invite on device A is joinable on device B via the cloud registry.
 * - Grocery realtime events published on device A apply on device B.
 * - One-time unlock on device A restores on device B after sign-in (account-bound).
 * - Guest / offline local loop still works without cloud.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createMemorySecureTokenStorage,
  createRepositories,
  createSyncClient,
  createGroceryRealtimeHub,
  createHouseholdCollaboration,
  useAuthSessionStore,
  useSyncStatusStore,
  type GroceryRealtimeEvent,
} from '@/data';
import {
  createSharedCloudBackend,
  createCloudAuthTransport,
  createCloudSyncTransport,
  createCloudGroceryRealtimeTransport,
  createCloudEntitlementClient,
} from '@/data/sync/cloudBackend';
import { createTestDbClient } from '@/data/testing/createTestDb';
import { useSessionStore } from '@/features/trust/sessionStore';

describe('P2-W1 real cloud backend — cross-device sync', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useSyncStatusStore.getState().resetToLocalOk();
    useSessionStore.getState().resetSessionForTests({ mode: 'guest' });
    await useAuthSessionStore.getState().resetForTests();
  });

  it('device B pull receives recipe pushed by device A for the same account', async () => {
    const cloud = createSharedCloudBackend();
    const auth = createCloudAuthTransport(cloud);

    const deviceAStorage = createMemorySecureTokenStorage();
    const deviceBStorage = createMemorySecureTokenStorage();

    useAuthSessionStore.getState().configureForTests({
      storage: deviceAStorage,
      transport: auth,
    });
    await useAuthSessionStore.getState().signIn({
      email: 'cook@example.com',
      password: 'kitchen-pass',
    });
    const tokensA = await deviceAStorage.read();
    expect(tokensA).not.toBeNull();

    const syncA = createSyncClient({
      transport: createCloudSyncTransport(cloud),
      getTokens: () => deviceAStorage.read(),
    });
    const push = await syncA.persistLocalThenSync({
      localWrite: () => ({ id: 'local-recipe-a' }),
      pushRequest: {
        householdId: null,
        items: [
          {
            kind: 'recipe',
            localId: 'local-recipe-a',
            revision: 1,
            body: { title: 'Tomato soup', servings: 4 },
          },
        ],
      },
    });
    expect(push.remote).not.toEqual({ skipped: 'guest' });
    if ('skipped' in push.remote) {
      throw new Error('expected remote push');
    }
    expect(push.remote.accepted).toContain('local-recipe-a');
    expect(useSyncStatusStore.getState().status).toBe('synced');

    // Device B signs in as the same account (shared cloud auth).
    useAuthSessionStore.getState().configureForTests({
      storage: deviceBStorage,
      transport: auth,
    });
    await useAuthSessionStore.getState().signIn({
      email: 'cook@example.com',
      password: 'kitchen-pass',
    });

    const syncB = createSyncClient({
      transport: createCloudSyncTransport(cloud),
      getTokens: () => deviceBStorage.read(),
    });
    const pulled = await syncB.pull({ householdId: null, sinceIso: null });
    expect(pulled).not.toEqual({ skipped: 'guest' });
    if ('skipped' in pulled) {
      throw new Error('expected remote pull');
    }
    expect(pulled.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'recipe',
          localId: 'local-recipe-a',
          body: expect.objectContaining({ title: 'Tomato soup' }),
        }),
      ]),
    );
  });

  it('rejects sign-in with wrong password against the shared cloud', async () => {
    const cloud = createSharedCloudBackend();
    const auth = createCloudAuthTransport(cloud);
    const storage = createMemorySecureTokenStorage();
    useAuthSessionStore.getState().configureForTests({ storage, transport: auth });

    await useAuthSessionStore.getState().signIn({
      email: 'cook@example.com',
      password: 'correct-horse',
    });
    await useAuthSessionStore.getState().signOut();

    await expect(
      useAuthSessionStore.getState().signIn({
        email: 'cook@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toThrow(/invalid|password|credentials/i);
  });

  it('guest push is skipped and local persist still works offline', async () => {
    const cloud = createSharedCloudBackend();
    await useAuthSessionStore.getState().resetForTests();

    const sync = createSyncClient({
      transport: createCloudSyncTransport(cloud),
      getTokens: async () => null,
    });
    const result = await sync.persistLocalThenSync({
      localWrite: () => 'ok-local',
      pushRequest: {
        householdId: null,
        items: [{ kind: 'recipe', localId: 'r1', revision: 1, body: { title: 'X' } }],
      },
    });
    expect(result.local).toBe('ok-local');
    expect(result.remote).toEqual({ skipped: 'guest' });
    expect(cloud.listEntities()).toHaveLength(0);
  });
});

describe('P2-W1 real cloud — household + grocery across devices', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useSyncStatusStore.getState().resetToLocalOk();
    await useAuthSessionStore.getState().resetForTests();
  });

  it('device B joins household by invite code registered on the cloud by device A', () => {
    const cloud = createSharedCloudBackend();
    const dbA = createTestDbClient();
    const dbB = createTestDbClient();
    const reposA = createRepositories(dbA);
    const reposB = createRepositories(dbB);

    const collabA = createHouseholdCollaboration(reposA, { cloud });
    const collabB = createHouseholdCollaboration(reposB, { cloud });

    const created = collabA.createHousehold({
      name: 'Our Kitchen',
      ownerUserId: 'user-a',
      ownerDisplayName: 'Alex',
    });
    expect(created.inviteCode).toBeTruthy();

    // Device B has no local household rows — join must resolve via cloud.
    expect(reposB.households.list()).toHaveLength(0);

    const joined = collabB.joinByInviteCode({
      inviteCode: created.inviteCode!,
      userId: 'user-b',
      displayName: 'Sam',
    });

    expect(joined.household.id).toBe(created.id);
    expect(joined.household.name).toBe('Our Kitchen');
    expect(reposB.households.getById(created.id)?.members.map((m) => m.userId).sort()).toEqual([
      'user-a',
      'user-b',
    ]);
  });

  it('grocery upsert published on device A is received on device B over cloud realtime', async () => {
    const cloud = createSharedCloudBackend();
    const transport = createCloudGroceryRealtimeTransport(cloud);

    const dbA = createTestDbClient();
    const dbB = createTestDbClient();
    const reposA = createRepositories(dbA);
    const reposB = createRepositories(dbB);

    const collabA = createHouseholdCollaboration(reposA, { cloud });
    const collabB = createHouseholdCollaboration(reposB, { cloud });

    const home = collabA.createHousehold({
      name: 'Sync Home',
      ownerUserId: 'user-a',
      ownerDisplayName: 'Alex',
      inviteCode: 'CLOUDJOIN',
    });
    collabB.joinByInviteCode({
      inviteCode: 'CLOUDJOIN',
      userId: 'user-b',
      displayName: 'Sam',
    });

    const listA = collabA.ensureSharedGroceryList(home.id);
    const listB = collabB.ensureSharedGroceryList(home.id);

    const tokens = {
      accessToken: 'tok',
      refreshToken: 'ref',
      expiresAtIso: null,
    };

    const hubA = createGroceryRealtimeHub({
      transport,
      collaboration: collabA,
      grocery: reposA.grocery,
    });
    const hubB = createGroceryRealtimeHub({
      transport,
      collaboration: collabB,
      grocery: reposB.grocery,
      resolveLocalListId: (remoteListId, householdId) => {
        if (householdId !== home.id) return null;
        if (remoteListId === listA.id) return listB.id;
        return remoteListId === listB.id ? listB.id : null;
      },
    });

    const received: GroceryRealtimeEvent[] = [];
    await hubB.subscribe({
      householdId: home.id,
      userId: 'user-b',
      tokens,
      onEvent: (event) => {
        received.push(event);
        hubB.applyEvent(event);
      },
    });

    const item = reposA.grocery.addItem(listA.id, {
      name: 'Oat milk',
      quantity: '1',
      aisle: 'Dairy',
    });
    await hubA.publishItemUpsert({
      householdId: home.id,
      userId: 'user-a',
      listId: listA.id,
      item,
      tokens,
    });

    expect(received).toHaveLength(1);
    expect(received[0]?.kind).toBe('item_upsert');
    const remote = reposB.grocery.getItemById(item.id);
    expect(remote?.name).toBe('Oat milk');
    expect(remote?.listId).toBe(listB.id);
  });
});

describe('P2-W1 real cloud — unlock across devices', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useSessionStore.getState().resetSessionForTests({ mode: 'guest', entitlement: 'free' });
    await useAuthSessionStore.getState().resetForTests();
  });

  it('unlock purchased on device A restores on device B after sign-in', async () => {
    const cloud = createSharedCloudBackend();
    const auth = createCloudAuthTransport(cloud);
    const entitlements = createCloudEntitlementClient(cloud);

    const storageA = createMemorySecureTokenStorage();
    useAuthSessionStore.getState().configureForTests({ storage: storageA, transport: auth });
    await useAuthSessionStore.getState().signIn({
      email: 'payer@example.com',
      password: 'pay-once',
    });
    const userId = useAuthSessionStore.getState().identity!.user.id;

    useSessionStore.getState().configureEntitlementClientForTests(entitlements);
    await useSessionStore.getState().setMode('signed_in');
    await useSessionStore.getState().unlockWithPurchase(userId);
    expect(useSessionStore.getState().entitlement).toBe('unlocked');
    expect(await entitlements.getEntitlement(userId)).toBe('unlocked');

    // Device B: fresh local session, same account.
    const storageB = createMemorySecureTokenStorage();
    useSessionStore.getState().resetSessionForTests({ mode: 'guest', entitlement: 'free' });
    useAuthSessionStore.getState().configureForTests({ storage: storageB, transport: auth });
    useSessionStore.getState().configureEntitlementClientForTests(entitlements);

    await useAuthSessionStore.getState().signIn({
      email: 'payer@example.com',
      password: 'pay-once',
    });
    await useSessionStore.getState().restoreEntitlementFromAccount(
      useAuthSessionStore.getState().identity!.user.id,
    );

    expect(useSessionStore.getState().entitlement).toBe('unlocked');
  });

  it('simulate unlock without account stays device-local only', async () => {
    const cloud = createSharedCloudBackend();
    const entitlements = createCloudEntitlementClient(cloud);
    useSessionStore.getState().configureEntitlementClientForTests(entitlements);

    await useSessionStore.getState().unlockWithPurchase();
    expect(useSessionStore.getState().entitlement).toBe('unlocked');
    expect(cloud.listEntitlements()).toHaveLength(0);
  });
});