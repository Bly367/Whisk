import { Ingredient } from '../../types/recipe';
import { GroceryItem } from '../../types/recipe';

function normalizeKey(name: string) {
  return name.trim().toLowerCase();
}

const unicodeFractions: Record<string, number> = {
  '¼': 0.25,
  '½': 0.5,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
};

const units: Record<string, { canonical: string; family: string; toBase: number }> = {
  tsp: { canonical: 'tsp', family: 'volume', toBase: 1 },
  teaspoon: { canonical: 'tsp', family: 'volume', toBase: 1 },
  teaspoons: { canonical: 'tsp', family: 'volume', toBase: 1 },
  tbsp: { canonical: 'tbsp', family: 'volume', toBase: 3 },
  tablespoon: { canonical: 'tbsp', family: 'volume', toBase: 3 },
  tablespoons: { canonical: 'tbsp', family: 'volume', toBase: 3 },
  cup: { canonical: 'cup', family: 'volume', toBase: 48 },
  cups: { canonical: 'cup', family: 'volume', toBase: 48 },
  ml: { canonical: 'ml', family: 'volume', toBase: 0.202884 },
  l: { canonical: 'l', family: 'volume', toBase: 202.884 },
  g: { canonical: 'g', family: 'weight', toBase: 1 },
  kg: { canonical: 'kg', family: 'weight', toBase: 1000 },
  oz: { canonical: 'oz', family: 'weight', toBase: 28.3495 },
  lb: { canonical: 'lb', family: 'weight', toBase: 453.592 },
  lbs: { canonical: 'lb', family: 'weight', toBase: 453.592 },
  clove: { canonical: 'clove', family: 'count', toBase: 1 },
  cloves: { canonical: 'clove', family: 'count', toBase: 1 },
};

function parseAmount(value: string): number | undefined {
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (unicodeFractions[normalized] !== undefined) return unicodeFractions[normalized];
  const mixed = normalized.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = normalized.match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const number = Number(normalized);
  return Number.isFinite(number) ? number : undefined;
}

function formatAmount(value: number): string {
  return String(Math.round(value * 100) / 100);
}

interface AggregateEntry {
  item: GroceryItem;
  numericAmount?: number;
  family?: string;
  toBase?: number;
}

export function aggregateIngredients(
  items: { recipeId: string; ingredients: Ingredient[]; factor?: number }[],
): GroceryItem[] {
  const map = new Map<string, AggregateEntry>();

  for (const { recipeId, ingredients, factor = 1 } of items) {
    for (const ing of ingredients) {
      const key = normalizeKey(ing.name);
      if (!key) continue;
      const existing = map.get(key);
      const unit = units[ing.unit.trim().toLowerCase()];
      const parsed = parseAmount(ing.amount);
      const scaled = parsed === undefined ? undefined : parsed * factor;
      if (existing) {
        existing.item.recipeIds = [...new Set([...existing.item.recipeIds, recipeId])];
        if (
          scaled !== undefined &&
          existing.numericAmount !== undefined &&
          unit?.family === existing.family &&
          existing.toBase
        ) {
          const converted = (scaled * (unit?.toBase ?? 1)) / existing.toBase;
          existing.numericAmount += converted;
          existing.item.amount = formatAmount(existing.numericAmount);
        } else if (ing.amount) {
          const scaledText =
            scaled === undefined ? ing.amount : formatAmount(scaled);
          const addition = [scaledText, unit?.canonical ?? ing.unit].filter(Boolean).join(' ');
          const current = [existing.item.amount, existing.item.unit].filter(Boolean).join(' ');
          existing.item.amount = [current, addition].filter(Boolean).join(' + ');
          existing.item.unit = '';
          existing.numericAmount = undefined;
          existing.family = undefined;
          existing.toBase = undefined;
        }
      } else {
        map.set(key, {
          item: {
            id: key,
            name: ing.name.trim(),
            amount: scaled === undefined ? ing.amount : formatAmount(scaled),
            unit: unit?.canonical ?? ing.unit,
            checked: false,
            recipeIds: [recipeId],
          },
          numericAmount: scaled,
          family: unit?.family,
          toBase: unit?.toBase,
        });
      }
    }
  }

  return Array.from(map.values())
    .map((entry) => entry.item)
    .sort((a, b) => a.name.localeCompare(b.name));
}
