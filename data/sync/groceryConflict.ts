/**
 * Grocery realtime conflict policy (P2-W3).
 *
 * Strategy: **last-write-wins (LWW)** per grocery item.
 * - Compare `updatedAtIso` (ISO-8601); the later timestamp wins.
 * - When timestamps are equal, higher `revision` wins (`tieBreaker`).
 * - Soft-delete is modeled as a write: a newer delete beats an older upsert.
 * - Distinct item ids **merge** (both apply); we never drop unrelated adds.
 *
 * This is intentional vs field-level CRDT merge: shopping-list rows are small,
 * and LWW keeps offline-first apply predictable for membership-scoped channels.
 */

export const GROCERY_CONFLICT_POLICY = {
  strategy: 'last_write_wins' as const,
  distinctItems: 'merge' as const,
  tieBreaker: 'revision' as const,
  summary:
    'Per grocery item, last-write-wins by updatedAtIso (revision tiebreaker). ' +
    'Distinct item ids merge. Soft-delete is a write competing under the same LWW rules. ' +
    'Reorder events LWW against the list updatedAt clock. ' +
    'applyEvent requires list.householdId === event.householdId.',
};

export type GroceryConflictCandidate = {
  id: string;
  name: string;
  quantity: string | null;
  isCompleted: boolean;
  position: number;
  updatedAtIso: string;
  revision: number;
  deleted: boolean;
};

/**
 * Returns the winning candidate under LWW + revision tiebreaker.
 * Callers apply the winner; losers are ignored (not merged field-wise).
 */
export function resolveGroceryItemConflict(
  a: GroceryConflictCandidate,
  b: GroceryConflictCandidate,
): GroceryConflictCandidate {
  if (a.id !== b.id) {
    // Distinct ids are not conflicts — callers should merge both. Prefer `b` only
    // if someone mistakenly passes different ids; documented policy is merge.
    return b.updatedAtIso >= a.updatedAtIso ? b : a;
  }
  if (a.updatedAtIso !== b.updatedAtIso) {
    return a.updatedAtIso > b.updatedAtIso ? a : b;
  }
  return a.revision >= b.revision ? a : b;
}

/** True when `incoming` should replace `local` under the published policy. */
export function shouldApplyRemoteGroceryWrite(
  local: GroceryConflictCandidate | null,
  incoming: GroceryConflictCandidate,
): boolean {
  if (!local) {
    return true;
  }
  return resolveGroceryItemConflict(local, incoming) === incoming;
}
