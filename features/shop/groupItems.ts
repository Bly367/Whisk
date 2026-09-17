import type { GroceryItem } from '@/data/contracts';
import { aisleSortIndex } from '@/features/shop/aisle';
import { parseMergeKey } from '@/features/shop/merge';

export type ShopGroupMode = 'aisle' | 'recipe';

export type GroceryGroup = {
  key: string;
  title: string;
  items: GroceryItem[];
};

function recipeGroupTitle(item: GroceryItem): string {
  return item.recipeTitle?.trim() || 'Manual / other';
}

export function groupGroceryItems(items: GroceryItem[], mode: ShopGroupMode): GroceryGroup[] {
  const active = items.filter((i) => !i.isCompleted);
  const map = new Map<string, GroceryItem[]>();

  for (const item of active) {
    const key = mode === 'aisle' ? item.aisle?.trim() || 'Other' : recipeGroupTitle(item);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }

  const groups: GroceryGroup[] = [...map.entries()].map(([title, groupItems]) => ({
    key: title,
    title,
    items: groupItems.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)),
  }));

  if (mode === 'aisle') {
    groups.sort(
      (a, b) => aisleSortIndex(a.title) - aisleSortIndex(b.title) || a.title.localeCompare(b.title),
    );
  } else {
    groups.sort((a, b) => a.title.localeCompare(b.title));
  }

  return groups;
}

export function completedItems(items: GroceryItem[]): GroceryItem[] {
  return items
    .filter((i) => i.isCompleted)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
}

export function isMergedItem(item: GroceryItem): boolean {
  const { sources } = parseMergeKey(item.mergeKey);
  return !!sources && sources.length > 1;
}
