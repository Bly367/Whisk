import type { AuthTokens } from '@/data/sync/contracts';
import type { GroceryItem } from '@/data/contracts';
import type { GroceryRepository } from '@/data/repositories/grocery';
import {
  shouldApplyRemoteGroceryWrite,
  type GroceryConflictCandidate,
} from '@/data/sync/groceryConflict';
import {
  HouseholdAuthzError,
  type HouseholdCollaboration,
} from '@/features/household/collaboration';

export type GroceryRealtimeItemPayload = {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  aisle: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  recipeId: string | null;
  recipeTitle: string | null;
  mergeKey: string | null;
  position: number;
  deleted: boolean;
};

export type GroceryRealtimeEvent =
  | {
      kind: 'item_upsert';
      householdId: string;
      listId: string;
      actorUserId: string;
      updatedAtIso: string;
      revision: number;
      item: GroceryRealtimeItemPayload;
    }
  | {
      kind: 'item_reorder';
      householdId: string;
      listId: string;
      actorUserId: string;
      updatedAtIso: string;
      revision: number;
      positions: { itemId: string; position: number }[];
    }
  | {
      kind: 'item_delete';
      householdId: string;
      listId: string;
      actorUserId: string;
      updatedAtIso: string;
      revision: number;
      itemId: string;
    };

export type GroceryRealtimeUnsubscribe = () => void;

export type GroceryRealtimeTransport = {
  subscribe(
    householdId: string,
    tokens: AuthTokens,
    onEvent: (event: GroceryRealtimeEvent) => void,
  ): Promise<GroceryRealtimeUnsubscribe>;
  publish(event: GroceryRealtimeEvent, tokens: AuthTokens): Promise<void>;
};

/**
 * In-memory pub/sub for tests and local multi-client simulation.
 * Production replaces this behind the same transport contract.
 */
export function createInMemoryGroceryRealtimeTransport(): GroceryRealtimeTransport & {
  listenerCount(householdId: string): number;
} {
  const listeners = new Map<string, Set<(event: GroceryRealtimeEvent) => void>>();

  return {
    listenerCount(householdId) {
      return listeners.get(householdId)?.size ?? 0;
    },
    async subscribe(householdId, _tokens, onEvent) {
      let set = listeners.get(householdId);
      if (!set) {
        set = new Set();
        listeners.set(householdId, set);
      }
      set.add(onEvent);
      return () => {
        set?.delete(onEvent);
        if (set && set.size === 0) {
          listeners.delete(householdId);
        }
      };
    },
    async publish(event, _tokens) {
      const set = listeners.get(event.householdId);
      if (!set) {
        return;
      }
      for (const listener of [...set]) {
        listener(event);
      }
    },
  };
}

export type GroceryRealtimeApplyResult =
  | { applied: true }
  | { applied: false; reason: 'stale' | 'unknown_list' | 'ignored' };

type HubDeps = {
  transport: GroceryRealtimeTransport;
  collaboration: HouseholdCollaboration;
  grocery: GroceryRepository;
  /** Map remote list id → local list id when devices use different local ids. */
  resolveLocalListId?: (remoteListId: string, householdId: string) => string | null;
};

function itemToCandidate(
  item: Pick<GroceryItem, 'id' | 'name' | 'quantity' | 'isCompleted' | 'position' | 'updatedAt' | 'deletedAt'>,
  revision: number,
): GroceryConflictCandidate {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    isCompleted: item.isCompleted,
    position: item.position,
    updatedAtIso: item.updatedAt,
    revision,
    deleted: item.deletedAt != null,
  };
}

function payloadToCandidate(
  payload: GroceryRealtimeItemPayload,
  updatedAtIso: string,
  revision: number,
): GroceryConflictCandidate {
  return {
    id: payload.id,
    name: payload.name,
    quantity: payload.quantity,
    isCompleted: payload.isCompleted,
    position: payload.position,
    updatedAtIso,
    revision,
    deleted: payload.deleted,
  };
}

function groceryItemToPayload(item: GroceryItem, deleted = false): GroceryRealtimeItemPayload {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    aisle: item.aisle,
    isCompleted: item.isCompleted,
    completedAt: item.completedAt,
    recipeId: item.recipeId,
    recipeTitle: item.recipeTitle,
    mergeKey: item.mergeKey,
    position: item.position,
    deleted,
  };
}

export function createGroceryRealtimeHub(deps: HubDeps) {
  function resolveListId(event: GroceryRealtimeEvent): string | null {
    if (deps.resolveLocalListId) {
      return deps.resolveLocalListId(event.listId, event.householdId) ?? event.listId;
    }
    return event.listId;
  }

  function revisionFromUpdatedAt(updatedAtIso: string): number {
    const ms = Date.parse(updatedAtIso);
    return Number.isFinite(ms) ? ms : 0;
  }

  return {
    async subscribe(input: {
      householdId: string;
      userId: string;
      tokens: AuthTokens;
      onEvent: (event: GroceryRealtimeEvent) => void;
    }): Promise<GroceryRealtimeUnsubscribe> {
      deps.collaboration.assertActiveMember(input.householdId, input.userId);
      return deps.transport.subscribe(input.householdId, input.tokens, input.onEvent);
    },

    async publishItemUpsert(input: {
      householdId: string;
      userId: string;
      listId: string;
      item: GroceryItem;
      tokens: AuthTokens;
      deleted?: boolean;
    }): Promise<void> {
      deps.collaboration.assertActiveMember(input.householdId, input.userId);
      const updatedAtIso = input.item.updatedAt;
      const event: GroceryRealtimeEvent = {
        kind: 'item_upsert',
        householdId: input.householdId,
        listId: input.listId,
        actorUserId: input.userId,
        updatedAtIso,
        revision: revisionFromUpdatedAt(updatedAtIso),
        item: groceryItemToPayload(input.item, input.deleted ?? false),
      };
      await deps.transport.publish(event, input.tokens);
    },

    async publishReorder(input: {
      householdId: string;
      userId: string;
      listId: string;
      positions: { itemId: string; position: number }[];
      tokens: AuthTokens;
      updatedAtIso?: string;
    }): Promise<void> {
      deps.collaboration.assertActiveMember(input.householdId, input.userId);
      const updatedAtIso = input.updatedAtIso ?? new Date().toISOString();
      const event: GroceryRealtimeEvent = {
        kind: 'item_reorder',
        householdId: input.householdId,
        listId: input.listId,
        actorUserId: input.userId,
        updatedAtIso,
        revision: revisionFromUpdatedAt(updatedAtIso),
        positions: input.positions,
      };
      await deps.transport.publish(event, input.tokens);
    },

    applyEvent(event: GroceryRealtimeEvent): GroceryRealtimeApplyResult {
      const listId = resolveListId(event);
      if (!listId) {
        return { applied: false, reason: 'unknown_list' };
      }
      const list = deps.grocery.getById(listId);
      if (!list) {
        return { applied: false, reason: 'unknown_list' };
      }

      if (event.kind === 'item_reorder') {
        deps.grocery.reorderItems(listId, event.positions, event.updatedAtIso);
        return { applied: true };
      }

      if (event.kind === 'item_delete') {
        const existing = list.items.find((i) => i.id === event.itemId) ?? null;
        const local = existing
          ? itemToCandidate(existing, revisionFromUpdatedAt(existing.updatedAt))
          : null;
        const incoming: GroceryConflictCandidate = {
          id: event.itemId,
          name: existing?.name ?? '',
          quantity: existing?.quantity ?? null,
          isCompleted: existing?.isCompleted ?? false,
          position: existing?.position ?? 0,
          updatedAtIso: event.updatedAtIso,
          revision: event.revision,
          deleted: true,
        };
        if (!shouldApplyRemoteGroceryWrite(local, incoming)) {
          return { applied: false, reason: 'stale' };
        }
        deps.grocery.softDeleteItem(event.itemId);
        return { applied: true };
      }

      // item_upsert
      const existing = deps.grocery.getItemById(event.item.id);
      const local = existing
        ? itemToCandidate(existing, revisionFromUpdatedAt(existing.updatedAt))
        : null;
      const incoming = payloadToCandidate(event.item, event.updatedAtIso, event.revision);
      if (!shouldApplyRemoteGroceryWrite(local, incoming)) {
        return { applied: false, reason: 'stale' };
      }

      if (event.item.deleted) {
        if (existing && !existing.deletedAt) {
          deps.grocery.softDeleteItem(event.item.id);
        }
        return { applied: true };
      }

      deps.grocery.upsertSyncedItem(listId, {
        id: event.item.id,
        name: event.item.name,
        quantity: event.item.quantity,
        unit: event.item.unit,
        aisle: event.item.aisle,
        isCompleted: event.item.isCompleted,
        completedAt: event.item.completedAt,
        recipeId: event.item.recipeId,
        recipeTitle: event.item.recipeTitle,
        mergeKey: event.item.mergeKey,
        position: event.item.position,
        updatedAt: event.updatedAtIso,
      });
      return { applied: true };
    },
  };
}

export type GroceryRealtimeHub = ReturnType<typeof createGroceryRealtimeHub>;

/** @internal exhaustiveness helper for callers */
export function assertNeverHouseholdAuthz(error: unknown): asserts error is HouseholdAuthzError {
  if (!(error instanceof HouseholdAuthzError)) {
    throw error;
  }
}
