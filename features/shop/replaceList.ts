import type { GroceryListWithItems, Repositories } from '@/data';
import {
  commitGroceryPreview,
  type GroceryGeneratePreview,
} from '@/features/shop/generateFromPlan';

export type ReplaceGroceryResult = {
  created: GroceryListWithItems;
  /** Prior active list id retired only after create succeeds; null if none. */
  replacedListId: string | null;
  replacedListName: string | null;
};

/**
 * Create the new list first, then soft-delete the prior active list.
 * Ordering guarantees the old list survives if create throws.
 */
export function replaceGroceryListFromPreview(
  grocery: Repositories['grocery'],
  preview: GroceryGeneratePreview,
  previous: GroceryListWithItems | null,
): ReplaceGroceryResult {
  const created = commitGroceryPreview(grocery, preview);
  const replacedListId = previous?.id ?? null;
  const replacedListName = previous?.name ?? null;
  if (replacedListId) {
    grocery.softDeleteList(replacedListId);
  }
  return { created, replacedListId, replacedListName };
}

/**
 * Undo a replace-generate: soft-delete the new list and restore the prior one.
 */
export function undoReplaceGroceryList(
  grocery: Repositories['grocery'],
  params: { newListId: string; previousListId: string },
): GroceryListWithItems {
  grocery.softDeleteList(params.newListId);
  return grocery.restoreList(params.previousListId);
}
