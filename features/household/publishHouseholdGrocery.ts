import {
  createGroceryRealtimeHub,
  createHouseholdCollaboration,
  getRepositories,
  type GroceryItem,
} from '@/data';
import { getAuthTokens, useAuthSessionStore } from '@/data/sync/authSession';
import { getSharedGroceryRealtimeTransport } from '@/features/household/useHouseholdGrocerySync';

/** Best-effort publish after a local grocery mutation on a household list. */
export async function publishHouseholdGroceryUpsert(input: {
  householdId: string | null | undefined;
  listId: string;
  item: GroceryItem;
  deleted?: boolean;
}): Promise<void> {
  if (!input.householdId) {
    return;
  }
  const userId = useAuthSessionStore.getState().identity?.user.id;
  if (!userId) {
    return;
  }
  try {
    const tokens = await getAuthTokens();
    if (!tokens) {
      return;
    }
    const repos = getRepositories();
    const collab = createHouseholdCollaboration(repos);
    if (!collab.isActiveMember(input.householdId, userId)) {
      return;
    }
    const hub = createGroceryRealtimeHub({
      transport: getSharedGroceryRealtimeTransport(),
      collaboration: collab,
      grocery: repos.grocery,
    });
    await hub.publishItemUpsert({
      householdId: input.householdId,
      userId,
      listId: input.listId,
      item: input.item,
      tokens,
      deleted: input.deleted,
    });
  } catch {
    // Local persist already succeeded; remote publish failures stay quiet (banner elsewhere).
  }
}
