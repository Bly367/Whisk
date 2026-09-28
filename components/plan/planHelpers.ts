import type { MealPlanEntry, MealSlot, RecipeListItem } from '@/data/contracts';

export const MEAL_SLOTS: { slot: MealSlot; label: string }[] = [
  { slot: 'breakfast', label: 'Breakfast' },
  { slot: 'lunch', label: 'Lunch' },
  { slot: 'dinner', label: 'Dinner' },
  { slot: 'snack', label: 'Snack' },
];

export function slotLabel(slot: MealSlot): string {
  return MEAL_SLOTS.find((s) => s.slot === slot)?.label ?? slot;
}

export function recipeTitleMap(recipes: RecipeListItem[]): Map<string, RecipeListItem> {
  return new Map(recipes.map((r) => [r.id, r]));
}

export function entriesForDaySlot(
  entries: MealPlanEntry[],
  planDate: string,
  slot: MealSlot,
): MealPlanEntry[] {
  return entries
    .filter((e) => e.planDate === planDate && e.slot === slot)
    .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
}
