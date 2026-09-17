import type { IngredientInput } from '@/data/contracts';

const UNIT_PATTERN =
  /^(fl\s+oz|tsp|teaspoons?|tbsp|tablespoons?|cups?|oz|ounces?|lb|lbs|pounds?|g|kg|ml|l|cloves?|cans?|packages?|pinch|pinches)\b\s*(.*)$/i;

export function parseIngredientLine(line: string, position = 0): IngredientInput {
  const cleaned = line.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return { name: '', position };
  }

  const match = cleaned.match(
    /^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+|[¼½¾⅓⅔⅛⅜⅝⅞])?\s*(.*)$/u,
  );
  if (!match) {
    return { name: cleaned, position };
  }

  const quantity = (match[1] ?? '').trim() || null;
  const remainder = (match[2] ?? '').trim();
  const unitMatch = remainder.match(UNIT_PATTERN);
  if (unitMatch) {
    return {
      quantity,
      unit: unitMatch[1],
      name: (unitMatch[2] ?? '').trim() || cleaned,
      position,
    };
  }

  return {
    quantity,
    unit: null,
    name: remainder || cleaned,
    position,
  };
}
