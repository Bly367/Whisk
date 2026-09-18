import type { GroceryListWithItems, HouseholdMember, HouseholdWithMembers } from '@/data/contracts';
import type { Repositories } from '@/data/repositories';
import type { CloudHouseholdSnapshot, SharedCloudBackend } from '@/data/sync/cloudBackend';
import { createId, nowIso } from '@/data/util';

/** Generic authz denial — never include foreign row bodies in the message. */
export class HouseholdAuthzError extends Error {
  readonly code = 'HOUSEHOLD_AUTHZ_DENIED' as const;

  constructor(message = 'Not authorized for this household.') {
    super(message);
    this.name = 'HouseholdAuthzError';
  }
}

export type CreateHouseholdInput = {
  /** Optional stable id (sync mirror / tests). */
  id?: string;
  name: string;
  ownerUserId: string;
  ownerDisplayName?: string | null;
  inviteCode?: string | null;
};

export type JoinHouseholdInput = {
  inviteCode: string;
  userId: string;
  displayName?: string | null;
};

export type HouseholdCollaborationOptions = {
  /**
   * Shared cloud registry so invite/join works across devices.
   * Local SQLite remains the on-device SOT; cloud mirrors membership.
   */
  cloud?: SharedCloudBackend;
  /** Optional remote invite lookup (HTTP sync server). */
  resolveInviteRemote?: (inviteCode: string) => Promise<CloudHouseholdSnapshot | null>;
  /** Optional remote household register (HTTP sync server). */
  registerHouseholdRemote?: (snapshot: CloudHouseholdSnapshot) => Promise<void>;
  /** Optional remote member add after local join (HTTP sync server). */
  addMemberRemote?: (input: {
    inviteCode: string;
    displayName: string | null;
  }) => Promise<CloudHouseholdSnapshot | null>;
};

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase();
}

export function generateInviteCode(length = 8): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * INVITE_ALPHABET.length);
    out += INVITE_ALPHABET[idx]!;
  }
  return out;
}

function mirrorCloudHouseholdLocally(
  repos: Repositories,
  remote: {
    id: string;
    name: string;
    ownerUserId: string;
    inviteCode: string;
    members: {
      userId: string;
      displayName: string | null;
      role: 'owner' | 'member';
      status: 'active' | 'invited' | 'removed';
    }[];
  },
): HouseholdWithMembers {
  const existing = repos.households.getById(remote.id);
  if (!existing) {
    const owner = remote.members.find((m) => m.role === 'owner' && m.status === 'active');
    repos.households.create({
      id: remote.id,
      name: remote.name,
      ownerUserId: owner?.userId ?? remote.ownerUserId,
      ownerDisplayName: owner?.displayName ?? null,
      inviteCode: remote.inviteCode,
    });
  }
  for (const member of remote.members) {
    if (member.status !== 'active') continue;
    const household = repos.households.getById(remote.id);
    const already = household?.members.find(
      (m) => m.userId === member.userId && m.status === 'active',
    );
    if (already) continue;
    // Owner row is created with the household; skip duplicate owner insert.
    if (member.role === 'owner' && household?.members.some((m) => m.role === 'owner')) {
      continue;
    }
    repos.households.addMember({
      householdId: remote.id,
      userId: member.userId,
      displayName: member.displayName,
      role: member.role === 'owner' ? 'owner' : 'member',
      status: 'active',
    });
  }
  const hydrated = repos.households.getById(remote.id);
  if (!hydrated) {
    throw new Error('Invite code is invalid or expired.');
  }
  return hydrated;
}

export function createHouseholdCollaboration(
  repos: Repositories,
  options: HouseholdCollaborationOptions = {},
) {
  const cloud = options.cloud;

  function assertActiveMember(
    householdId: string,
    userId: string,
  ): {
    household: HouseholdWithMembers;
    member: HouseholdMember;
  } {
    const household = repos.households.getById(householdId);
    if (!household) {
      throw new HouseholdAuthzError();
    }
    const member = household.members.find((m) => m.userId === userId && m.status === 'active');
    if (!member) {
      throw new HouseholdAuthzError();
    }
    return { household, member };
  }

  function isActiveMember(householdId: string, userId: string): boolean {
    try {
      assertActiveMember(householdId, userId);
      return true;
    } catch (error) {
      if (error instanceof HouseholdAuthzError) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Bind local grocery list(s) to a household so Shop realtime can arm.
   * Attaches every untenanted list; creates a shared list if none exist for the household.
   */
  function ensureSharedGroceryList(householdId: string): GroceryListWithItems {
    const household = repos.households.getById(householdId);
    if (!household) {
      throw new HouseholdAuthzError();
    }

    for (const list of repos.grocery.list()) {
      if (list.householdId == null) {
        repos.grocery.setTenantFields(list.id, { householdId });
      }
    }

    const shared = repos.grocery.list().filter((list) => list.householdId === householdId);
    if (shared.length > 0) {
      const hydrated = repos.grocery.getById(shared[0]!.id);
      if (!hydrated) {
        throw new Error('Shared grocery list missing after attach');
      }
      return hydrated;
    }

    return repos.grocery.create({
      name: 'Shared list',
      householdId,
      items: [],
    });
  }

  function publishHouseholdToCloud(household: HouseholdWithMembers): void {
    if (!household.inviteCode) return;
    const snapshot: CloudHouseholdSnapshot = {
      id: household.id,
      name: household.name,
      ownerUserId:
        household.ownerUserId ?? household.members.find((m) => m.role === 'owner')?.userId ?? '',
      inviteCode: household.inviteCode,
      members: household.members
        .filter((m) => m.userId)
        .map((m) => ({
          userId: m.userId!,
          displayName: m.displayName,
          role: m.role === 'owner' ? 'owner' : 'member',
          status: m.status === 'removed' ? 'removed' : m.status === 'invited' ? 'invited' : 'active',
        })),
      updatedAtIso: household.updatedAt ?? nowIso(),
    };
    cloud?.registerHousehold(snapshot);
    void options.registerHouseholdRemote?.(snapshot);
  }

  return {
    assertActiveMember,
    isActiveMember,
    ensureSharedGroceryList,

    createHousehold(input: CreateHouseholdInput): HouseholdWithMembers {
      const inviteCode = normalizeInviteCode(
        input.inviteCode?.trim() ? input.inviteCode : generateInviteCode(),
      );
      const household = repos.households.create({
        id: input.id,
        name: input.name,
        ownerUserId: input.ownerUserId,
        ownerDisplayName: input.ownerDisplayName ?? null,
        inviteCode,
      });
      ensureSharedGroceryList(household.id);
      const refreshed = repos.households.getById(household.id) ?? household;
      publishHouseholdToCloud(refreshed);
      return refreshed;
    },

    joinByInviteCode(input: JoinHouseholdInput): {
      household: HouseholdWithMembers;
      member: HouseholdMember;
    } {
      const inviteCode = normalizeInviteCode(input.inviteCode);
      if (!inviteCode) {
        throw new Error('Invite code is invalid or expired.');
      }
      let household = repos.households.findByInviteCode(inviteCode);
      if (!household && cloud) {
        const remote = cloud.resolveInvite(inviteCode);
        if (remote) {
          household = mirrorCloudHouseholdLocally(repos, remote);
        }
      }
      if (!household) {
        throw new Error('Invite code is invalid or expired.');
      }
      const existing = household.members.find(
        (m) => m.userId === input.userId && m.status === 'active',
      );
      let member: HouseholdMember;
      if (existing) {
        member = existing;
      } else {
        member = repos.households.addMember({
          householdId: household.id,
          userId: input.userId,
          displayName: input.displayName ?? null,
          role: 'member',
          status: 'active',
        });
        cloud?.addHouseholdMember(household.id, {
          userId: input.userId,
          displayName: input.displayName ?? null,
          role: 'member',
          status: 'active',
        });
      }
      const refreshed = repos.households.getById(household.id);
      if (!refreshed) {
        throw new Error('Invite code is invalid or expired.');
      }
      ensureSharedGroceryList(refreshed.id);
      publishHouseholdToCloud(repos.households.getById(refreshed.id) ?? refreshed);
      return {
        household: repos.households.getById(refreshed.id) ?? refreshed,
        member,
      };
    },

    async joinByInviteCodeAsync(input: JoinHouseholdInput): Promise<{
      household: HouseholdWithMembers;
      member: HouseholdMember;
    }> {
      const inviteCode = normalizeInviteCode(input.inviteCode);
      if (!inviteCode) {
        throw new Error('Invite code is invalid or expired.');
      }
      if (!repos.households.findByInviteCode(inviteCode)) {
        let remote = cloud?.resolveInvite(inviteCode) ?? null;
        if (!remote && options.addMemberRemote) {
          remote = await options.addMemberRemote({
            inviteCode,
            displayName: input.displayName ?? null,
          });
        }
        if (!remote && options.resolveInviteRemote) {
          remote = await options.resolveInviteRemote(inviteCode);
        }
        if (remote) {
          mirrorCloudHouseholdLocally(repos, remote);
        }
      }
      return createHouseholdCollaboration(repos, {
        cloud,
        registerHouseholdRemote: options.registerHouseholdRemote,
      }).joinByInviteCode(input);
    },

    listSharedGroceryLists(input: { householdId: string; userId: string }): GroceryListWithItems[] {
      assertActiveMember(input.householdId, input.userId);
      return repos.grocery
        .list()
        .filter((list) => list.householdId === input.householdId)
        .map((list) => repos.grocery.getById(list.id))
        .filter((list): list is GroceryListWithItems => list != null);
    },

    getSharedGroceryList(input: { listId: string; userId: string }): GroceryListWithItems {
      const list = repos.grocery.getById(input.listId);
      if (!list?.householdId) {
        throw new HouseholdAuthzError();
      }
      assertActiveMember(list.householdId, input.userId);
      return list;
    },
  };
}

export type HouseholdCollaboration = ReturnType<typeof createHouseholdCollaboration>;

/** Stable id helper for sync mirrors (re-export createId for feature callers). */
export { createId as createLocalId };
