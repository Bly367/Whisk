/**
 * W4 pantry destructive-action policy (SECURITY.md).
 *
 * Soft-delete without confirmation and recoverable undo/trash is forbidden.
 * P2-W4 therefore does **not** expose Remove in the pantry UI.
 *
 * Depletion is via `consume()`; "Show used up" keeps history recoverable.
 * Repo `softDelete` may exist for later workstreams that ship confirm + undo.
 */

export const PANTRY_UI_MUTATIONS = ['create', 'update', 'consume'] as const;

export type PantryUiMutation = (typeof PANTRY_UI_MUTATIONS)[number];

export function isPantryUiSoftDeleteAllowed(): boolean {
  return false;
}

/**
 * Guard for any accidental UI path that attempts soft-delete in W4.
 * Always throws — callers must use consume / Show used up instead.
 */
export function refusePantryUiSoftDelete(itemName?: string): never {
  const subject = itemName?.trim() ? ` ${itemName.trim()}` : '';
  throw new Error(
    `Pantry Remove is not available${subject}. Mark items as used up instead (Show used up keeps history). Soft-delete needs confirm and undo before it can return.`,
  );
}
