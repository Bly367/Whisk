import type { IngredientInput } from '@/data/contracts';

const UNIT_PATTERN =
  /^(fl\s+oz|tsp|teaspoons?|tbsp|tablespoons?|cups?|oz|ounces?|lb|lbs|pounds?|grams?|g|kg|ml|l|cloves?|cans?|packages?|pinch|pinches|sticks?|bunch(?:es)?|sprigs?|slices?|fillets?|stalks?|rind)\b\s*(.*)$/i;

export function parseIngredientLine(line: string, position = 0): IngredientInput {
  // Strip emoji bullets and common list markers
  const cleaned = line
    .replace(/^(?:🔸|🔹|▪️|•|-|\*)\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) {
    return { name: '', position };
  }

  const match = cleaned.match(/^(\d+\s+\d+\/\d+|\d+\s*(?:to|[–-])\s*\d+|\d+\/\d+|\d+(?:\.\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])?\s*(.*)$/u);
  if (!match) {
    return { name: cleaned, position };
  }

  const quantity = (match[1] ?? '').trim() || null;
  const remainder = (match[2] ?? '').trim();
  const metricNote = remainder.match(/^([^()]+?)\s*\((\d+(?:\.\d+)?\s*(?:g|kg|ml|l))\)\s*(.*)$/i);
  const leadingMetric = remainder.match(/^\((\d+(?:\.\d+)?\s*(?:g|kg|ml|l))\)\s*(.*)$/i);
  const effectiveMetric = metricNote ?? (leadingMetric ? { 2: leadingMetric[1] } : undefined);
  const remainderWithoutMetric = (metricNote ? `${metricNote[1]} ${metricNote[3]}`.trim() : leadingMetric ? leadingMetric[2] : remainder).trim();
  const unitMatch = remainderWithoutMetric.match(UNIT_PATTERN);
  if (unitMatch) {
    return {
      quantity,
      unit: unitMatch[1],
      name: (unitMatch[2] ?? '').trim() || cleaned,
      note: effectiveMetric?.[2] ?? null,
      position,
    };
  }

  return {
    quantity,
    unit: null,
    name: remainderWithoutMetric || cleaned,
    note: effectiveMetric?.[2] ?? null,
    position,
  };
}
