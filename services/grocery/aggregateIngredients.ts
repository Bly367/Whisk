import { Ingredient } from '../../types/recipe';
import { GroceryItem } from '../../types/recipe';

function normalizeKey(name: string) {
  return name.trim().toLowerCase();
}

export function aggregateIngredients(
  items: { recipeId: string; ingredients: Ingredient[] }[],
): GroceryItem[] {
  const map = new Map<string, GroceryItem>();

  for (const { recipeId, ingredients } of items) {
    for (const ing of ingredients) {
      const key = normalizeKey(ing.name);
      if (!key) continue;
      const existing = map.get(key);
      if (existing) {
        existing.recipeIds = [...new Set([...existing.recipeIds, recipeId])];
        if (ing.amount && !existing.amount.includes(ing.amount)) {
          existing.amount = [existing.amount, ing.amount].filter(Boolean).join(' + ');
        }
        if (ing.unit && !existing.unit.includes(ing.unit)) {
          existing.unit = [existing.unit, ing.unit].filter(Boolean).join(' / ');
        }
      } else {
        map.set(key, {
          id: key,
          name: ing.name.trim(),
          amount: ing.amount,
          unit: ing.unit,
          checked: false,
          recipeIds: [recipeId],
        });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}
