/**
 * P2-W3 — Household collaboration + real-time grocery sync (test-first).
 *
 * Acceptance covered:
 * - Invite / join household; members see shared grocery list updates
 * - Conflict policy documented (last-write-wins + distinct-item merge) and tested
 * - Authz failures never leak another household’s rows
 * - Membership boundary + realtime apply / reorder
 */
import {
  createRepositories,
  useSyncStatusStore,
} from '@/data';
import { createTestDbClient } from '@/data/testing/createTestDb';
import {
  HouseholdAuthzError,
  createHouseholdCollaboration,
} from '@/features/household/collaboration';
import {
  GROCERY_CONFLICT_POLICY,
  resolveGroceryItemConflict,
} from '@/data/sync/groceryConflict';
import {
  createGroceryRealtimeHub,
  createInMemoryGroceryRealtimeTransport,
  type GroceryRealtimeEvent,
} from '@/data/sync/groceryRealtime';

describe('P2-W3 household invite / join', () => {
  beforeEach(() => {
    useSyncStatusStore.getState().resetToLocalOk();
  });

  it('creates a household with an invite code and joins a second member by code', () => {
    const db = createTestDbClient();
    const repos = createRepositories(db);
    const collab = createHouseholdCollaboration(repos);

    const created = collab.createHousehold({
      name: 'Shared Kitchen',
      ownerUserId: 'owner-1',
      ownerDisplayName: 'Alex',
    });

    expect(created.inviteCode).toBeTruthy();
    expect(created.inviteCode!.length).toBeGreaterThanOrEqual(6);
    expect(created.members).toHaveLength(1);
    expect(created.members[0].role).toBe('owner');

    const joined = collab.joinByInviteCode({
      inviteCode: created.inviteCode!,
      userId: 'member-2',
      displayName: 'Sam',
    });

    expect(joined.household.id).toBe(created.id);
    expect(joined.member.userId).toBe('member-2');
    expect(joined.member.status).toBe('active');
    expect(joined.member.role).toBe('member');

    const loaded = repos.households.getById(created.id);
    expect(loaded?.members.map((m) => m.userId).sort()).toEqual(['member-2', 'owner-1']);
  });

  it('rejects join with an unknown invite code without leaking households', () => {
    const db = createTestDbClient();
    const repos = createRepositories(db);
    const collab = createHouseholdCollaboration(repos);
    collab.createHousehold({
      name: 'Secret Home',
      ownerUserId: 'owner-1',
      ownerDisplayName: 'Alex',
    });

    expect(() =>
      collab.joinByInviteCode({
        inviteCode: 'NOPE-NOT-REAL',
        userId: 'intruder',
        displayName: 'Nope',
      }),
    ).toThrow(/invite/i);

    expect(repos.households.list()).toHaveLength(1);
  });

  it('is case-insensitive on invite codes and trims whitespace', () => {
    const db = createTestDbClient();
    const repos = createRepositories(db);
    const collab = createHouseholdCollaboration(repos);
    const created = collab.createHousehold({
      name: 'Home',
      ownerUserId: 'owner-1',
      ownerDisplayName: 'Alex',
      inviteCode: 'AbCd12',
    });

    const joined = collab.joinByInviteCode({
      inviteCode: `  ${created.inviteCode!.toLowerCase()}  `,
      userId: 'member-2',
      displayName: 'Sam',
    });
    expect(joined.household.id).toBe(created.id);
  });
});

describe('P2-W3 membership authz boundaries', () => {
  beforeEach(() => {
    useSyncStatusStore.getState().resetToLocalOk();
  });

  it('allows members to read shared grocery lists for their household only', () => {
    const db = createTestDbClient();
    const repos = createRepositories(db);
    const collab = createHouseholdCollaboration(repos);

    const homeA = collab.createHousehold({
      name: 'A',
      ownerUserId: 'u-a',
      ownerDisplayName: 'A',
    });
    const homeB = collab.createHousehold({
      name: 'B',
      ownerUserId: 'u-b',
      ownerDisplayName: 'B',
    });

    const listA = repos.grocery.create({
      name: 'A Shop',
      householdId: homeA.id,
      items: [{ name: 'Milk' }],
    });
    const listB = repos.grocery.create({
      name: 'B Shop',
      householdId: homeB.id,
      items: [{ name: 'Eggs' }],
    });

    const visible = collab.listSharedGroceryLists({
      householdId: homeA.id,
      userId: 'u-a',
    });
    expect(visible.map((l) => l.id)).toEqual([listA.id]);
    expect(visible.some((l) => l.id === listB.id)).toBe(false);
    expect(visible[0].items.map((i) => i.name)).toEqual(['Milk']);
  });

  it('denies non-members with HouseholdAuthzError and never returns foreign rows', () => {
    const db = createTestDbClient();
    const repos = createRepositories(db);
    const collab = createHouseholdCollaboration(repos);

    const homeA = collab.createHousehold({
      name: 'A',
      ownerUserId: 'u-a',
      ownerDisplayName: 'A',
    });
    repos.grocery.create({
      name: 'Secret list',
      householdId: homeA.id,
      items: [{ name: 'Hidden butter' }],
    });

    let caught: unknown;
    try {
      collab.listSharedGroceryLists({ householdId: homeA.id, userId: 'stranger' });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(HouseholdAuthzError);
    expect((caught as Error).message).not.toMatch(/Hidden butter|Secret list/i);
    expect((caught as HouseholdAuthzError).code).toBe('HOUSEHOLD_AUTHZ_DENIED');
  });

  it('getSharedGroceryList returns null-style authz denial without foreign item bodies', () => {
    const db = createTestDbClient();
    const repos = createRepositories(db);
    const collab = createHouseholdCollaboration(repos);
    const home = collab.createHousehold({
      name: 'Home',
      ownerUserId: 'owner',
      ownerDisplayName: 'O',
    });
    const list = repos.grocery.create({
      name: 'Weekly',
      householdId: home.id,
      items: [{ name: 'Pasta' }],
    });

    expect(() =>
      collab.getSharedGroceryList({
        listId: list.id,
        userId: 'outsider',
      }),
    ).toThrow(HouseholdAuthzError);
  });
});

describe('P2-W3 grocery conflict policy', () => {
  it('documents last-write-wins with distinct-item merge', () => {
    expect(GROCERY_CONFLICT_POLICY.strategy).toBe('last_write_wins');
    expect(GROCERY_CONFLICT_POLICY.distinctItems).toBe('merge');
    expect(GROCERY_CONFLICT_POLICY.tieBreaker).toBe('revision');
    expect(GROCERY_CONFLICT_POLICY.summary.length).toBeGreaterThan(20);
  });

  it('keeps the newer updatedAt when the same item conflicts', () => {
    const local = {
      id: 'item-1',
      name: 'Milk',
      quantity: '1',
      isCompleted: false,
      position: 0,
      updatedAtIso: '2026-09-18T10:00:00.000Z',
      revision: 2,
      deleted: false,
    };
    const remote = {
      id: 'item-1',
      name: 'Milk',
      quantity: '2',
      isCompleted: true,
      position: 1,
      updatedAtIso: '2026-09-18T11:00:00.000Z',
      revision: 3,
      deleted: false,
    };

    const winner = resolveGroceryItemConflict(local, remote);
    expect(winner).toEqual(remote);
  });

  it('uses revision as tiebreaker when timestamps match', () => {
    const olderRev = {
      id: 'item-1',
      name: 'Bread',
      quantity: null,
      isCompleted: false,
      position: 0,
      updatedAtIso: '2026-09-18T12:00:00.000Z',
      revision: 4,
      deleted: false,
    };
    const newerRev = {
      ...olderRev,
      name: 'Sourdough',
      revision: 5,
    };
    expect(resolveGroceryItemConflict(olderRev, newerRev)).toEqual(newerRev);
    expect(resolveGroceryItemConflict(newerRev, olderRev)).toEqual(newerRev);
  });
});

describe('P2-W3 real-time grocery sync', () => {
  beforeEach(() => {
    useSyncStatusStore.getState().resetToLocalOk();
  });

  it('delivers published grocery upserts to other subscribed household members', async () => {
    const dbA = createTestDbClient();
    const dbB = createTestDbClient();
    const reposA = createRepositories(dbA);
    const reposB = createRepositories(dbB);
    const transport = createInMemoryGroceryRealtimeTransport();

    const collabA = createHouseholdCollaboration(reposA);
    const home = collabA.createHousehold({
      name: 'Shared',
      ownerUserId: 'u-a',
      ownerDisplayName: 'A',
      inviteCode: 'SHARE1',
    });
    collabA.joinByInviteCode({
      inviteCode: 'SHARE1',
      userId: 'u-b',
      displayName: 'B',
    });

    // Mirror same household id + membership onto device B (sync bootstrap).
    const collabB = createHouseholdCollaboration(reposB);
    collabB.createHousehold({
      id: home.id,
      name: 'Shared',
      ownerUserId: 'u-a',
      ownerDisplayName: 'A',
      inviteCode: 'SHARE1',
    });
    reposB.households.addMember({
      householdId: home.id,
      userId: 'u-b',
      displayName: 'B',
      role: 'member',
    });

    const householdId = home.id;
    const listA = reposA.grocery.create({
      name: 'Shop',
      householdId,
      items: [],
    });
    const listB = reposB.grocery.create({
      name: 'Shop',
      householdId,
      items: [],
    });

    const hubA = createGroceryRealtimeHub({
      transport,
      collaboration: collabA,
      grocery: reposA.grocery,
    });
    const hubB = createGroceryRealtimeHub({
      transport,
      collaboration: collabB,
      grocery: reposB.grocery,
      resolveLocalListId: () => listB.id,
    });

    const received: GroceryRealtimeEvent[] = [];
    await hubB.subscribe({
      householdId,
      userId: 'u-b',
      tokens: {
        accessToken: 't',
        refreshToken: 'r',
        expiresAtIso: null,
      },
      onEvent: (event) => {
        received.push(event);
      },
    });

    const item = reposA.grocery.addItem(listA.id, {
      name: 'Tomatoes',
      quantity: '4',
      aisle: 'Produce',
      position: 0,
    });

    await hubA.publishItemUpsert({
      householdId,
      userId: 'u-a',
      listId: listA.id,
      item,
      tokens: {
        accessToken: 't',
        refreshToken: 'r',
        expiresAtIso: null,
      },
    });

    expect(received).toHaveLength(1);
    expect(received[0]!.kind).toBe('item_upsert');
    if (received[0]!.kind !== 'item_upsert') {
      throw new Error('expected item_upsert');
    }
    expect(received[0].item.name).toBe('Tomatoes');

    const applied = hubB.applyEvent(received[0]);
    expect(applied.applied).toBe(true);
    const remoteList = reposB.grocery.getById(listB.id);
    expect(remoteList?.items.some((i) => i.name === 'Tomatoes')).toBe(true);
  });

  it('applies remote reorder using last-write-wins positions', () => {
    const db = createTestDbClient();
    const repos = createRepositories(db);
    const collab = createHouseholdCollaboration(repos);
    const home = collab.createHousehold({
      name: 'Home',
      ownerUserId: 'u1',
      ownerDisplayName: 'U',
    });
    const list = repos.grocery.create({
      name: 'Shop',
      householdId: home.id,
      items: [
        { name: 'A', position: 0 },
        { name: 'B', position: 1 },
      ],
    });
    const [first, second] = list.items;
    const transport = createInMemoryGroceryRealtimeTransport();
    const hub = createGroceryRealtimeHub({
      transport,
      collaboration: collab,
      grocery: repos.grocery,
    });

    const event: GroceryRealtimeEvent = {
      kind: 'item_reorder',
      householdId: home.id,
      listId: list.id,
      actorUserId: 'peer',
      updatedAtIso: '2026-09-18T15:00:00.000Z',
      revision: 10,
      positions: [
        { itemId: first.id, position: 1 },
        { itemId: second.id, position: 0 },
      ],
    };

    const result = hub.applyEvent(event);
    expect(result.applied).toBe(true);
    const reloaded = repos.grocery.getById(list.id)!;
    const byName = Object.fromEntries(reloaded.items.map((i) => [i.name, i.position]));
    expect(byName.A).toBe(1);
    expect(byName.B).toBe(0);
  });

  it('rejects subscribe / publish for non-members without leaking list payloads', async () => {
    const db = createTestDbClient();
    const repos = createRepositories(db);
    const collab = createHouseholdCollaboration(repos);
    const home = collab.createHousehold({
      name: 'Home',
      ownerUserId: 'owner',
      ownerDisplayName: 'O',
    });
    repos.grocery.create({
      name: 'Private',
      householdId: home.id,
      items: [{ name: 'Secret cheese' }],
    });

    const hub = createGroceryRealtimeHub({
      transport: createInMemoryGroceryRealtimeTransport(),
      collaboration: collab,
      grocery: repos.grocery,
    });

    await expect(
      hub.subscribe({
        householdId: home.id,
        userId: 'intruder',
        tokens: {
          accessToken: 't',
          refreshToken: 'r',
          expiresAtIso: null,
        },
        onEvent: () => undefined,
      }),
    ).rejects.toBeInstanceOf(HouseholdAuthzError);

    await expect(
      hub.publishItemUpsert({
        householdId: home.id,
        userId: 'intruder',
        listId: 'any',
        item: {
          id: 'x',
          listId: 'any',
          name: 'leak?',
          quantity: null,
          unit: null,
          aisle: null,
          isCompleted: false,
          completedAt: null,
          recipeId: null,
          recipeTitle: null,
          mergeKey: null,
          position: 0,
          createdAt: '2026-09-18T00:00:00.000Z',
          updatedAt: '2026-09-18T00:00:00.000Z',
          deletedAt: null,
        },
        tokens: {
          accessToken: 't',
          refreshToken: 'r',
          expiresAtIso: null,
        },
      }),
    ).rejects.toBeInstanceOf(HouseholdAuthzError);
  });

  it('skips stale remote upserts when local item is newer (LWW)', () => {
    const db = createTestDbClient();
    const repos = createRepositories(db);
    const collab = createHouseholdCollaboration(repos);
    const home = collab.createHousehold({
      name: 'Home',
      ownerUserId: 'u1',
      ownerDisplayName: 'U',
    });
    const list = repos.grocery.create({
      name: 'Shop',
      householdId: home.id,
      items: [{ name: 'Milk', quantity: 'local-2', position: 0 }],
    });
    const item = list.items[0];
    // Bump local updated_at into the future relative to remote.
    db.run(`UPDATE grocery_items SET updated_at = ?, quantity = ? WHERE id = ?`, [
      '2026-09-18T20:00:00.000Z',
      'local-2',
      item.id,
    ]);

    const hub = createGroceryRealtimeHub({
      transport: createInMemoryGroceryRealtimeTransport(),
      collaboration: collab,
      grocery: repos.grocery,
    });

    const result = hub.applyEvent({
      kind: 'item_upsert',
      householdId: home.id,
      listId: list.id,
      actorUserId: 'peer',
      updatedAtIso: '2026-09-18T10:00:00.000Z',
      revision: 1,
      item: {
        id: item.id,
        name: 'Milk',
        quantity: 'stale-remote',
        unit: null,
        aisle: null,
        isCompleted: false,
        completedAt: null,
        recipeId: null,
        recipeTitle: null,
        mergeKey: null,
        position: 0,
        deleted: false,
      },
    });

    expect(result.applied).toBe(false);
    if (result.applied) {
      throw new Error('expected stale');
    }
    expect(result.reason).toBe('stale');
    expect(repos.grocery.getById(list.id)?.items[0].quantity).toBe('local-2');
  });
});
