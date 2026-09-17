import type { GroceryItem, GroceryListWithItems, Repositories } from '@/data';
import { reportLocalPersistFailure, reportLocalPersistSuccess } from '@/data';
import { splitMergedDraft } from '@/features/shop/merge';

/**
 * Unmerge a carefully merged item back into its source lines.
 * Soft-deletes the merged row and inserts originals via grocery repo.
 */
export function unmergeGroceryItem(
  grocery: Repositories['grocery'],
  list: GroceryListWithItems,
  item: GroceryItem,
): GroceryListWithItems {
  const sources = splitMergedDraft(item);
  if (!sources || sources.length < 2) {
    return list;
  }

  try {
    grocery.softDeleteItem(item.id);
    for (const [index, source] of sources.entries()) {
      grocery.addItem(list.id, {
        name: source.name,
        quantity: source.quantity,
        unit: source.unit,
        aisle: source.aisle,
        recipeId: source.recipeId,
        recipeTitle: source.recipeTitle,
        mergeKey: undefined,
        position: item.position + index,
      });
    }
    reportLocalPersistSuccess();
  } catch (error) {
    reportLocalPersistFailure(
      error instanceof Error ? error.message : 'Could not split item',
    );
    throw error;
  }

  const refreshed = grocery.getById(list.id);
  if (!refreshed) {
    throw new Error('Grocery list missing after unmerge');
  }
  return refreshed;
}
