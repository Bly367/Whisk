import type {
  GroceryListWithItems,
  HouseholdMember,
  HouseholdWithMembers,
} from '@/data/contracts';
import type { Repositories } from '@/data/repositories';
import { createId } from '@/data/util';

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

export function createHouseholdCollaboration(repos: Repositories) {
  function assertActiveMember(householdId: string, userId: string): {
    household: HouseholdWithMembers;
    member: HouseholdMember;
  } {
    const household = repos.households.getById(householdId);
    if (!household) {
      throw new HouseholdAuthzError();
    }
    const member = household.members.find(
      (m) => m.userId === userId && m.status === 'active',
    );
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

  return {
    assertActiveMember,
    isActiveMember,

    createHousehold(input: CreateHouseholdInput): HouseholdWithMembers {
      const inviteCode = normalizeInviteCode(
        input.inviteCode?.trim() ? input.inviteCode : generateInviteCode(),
      );
      return repos.households.create({
        id: input.id,
        name: input.name,
        ownerUserId: input.ownerUserId,
        ownerDisplayName: input.ownerDisplayName ?? null,
        inviteCode,
      });
    },

    joinByInviteCode(input: JoinHouseholdInput): {
      household: HouseholdWithMembers;
      member: HouseholdMember;
    } {
      const inviteCode = normalizeInviteCode(input.inviteCode);
      if (!inviteCode) {
        throw new Error('Invite code is invalid or expired.');
      }
      const household = repos.households.findByInviteCode(inviteCode);
      if (!household) {
        throw new Error('Invite code is invalid or expired.');
      }
      const existing = household.members.find(
        (m) => m.userId === input.userId && m.status === 'active',
      );
      if (existing) {
        return { household, member: existing };
      }
      const member = repos.households.addMember({
        householdId: household.id,
        userId: input.userId,
        displayName: input.displayName ?? null,
        role: 'member',
        status: 'active',
      });
      const refreshed = repos.households.getById(household.id);
      if (!refreshed) {
        throw new Error('Invite code is invalid or expired.');
      }
      return { household: refreshed, member };
    },

    listSharedGroceryLists(input: {
      householdId: string;
      userId: string;
    }): GroceryListWithItems[] {
      assertActiveMember(input.householdId, input.userId);
      return repos.grocery
        .list()
        .filter((list) => list.householdId === input.householdId)
        .map((list) => repos.grocery.getById(list.id))
        .filter((list): list is GroceryListWithItems => list != null);
    },

    getSharedGroceryList(input: {
      listId: string;
      userId: string;
    }): GroceryListWithItems {
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
