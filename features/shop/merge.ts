import { formatQuantityForUnit, parseQuantity } from '@/features/recipes/scale';

/**
 * Careful grocery merge/dedupe with recoverable provenance for unmerge.
 */

export type GrocerySourceLine = {
  name: string;
  quantity: string | null;
  unit: string | null;
  aisle: string | null;
  recipeId: string | null;
  recipeTitle: string | null;
};

export type MergedGroceryDraft = {
  name: string;
  quantity: string | null;
  unit: string | null;
  aisle: string | null;
  recipeId: string | null;
  recipeTitle: string | null;
  /** Base key; may embed encoded sources when merged from multiple lines. */
  mergeKey: string;
  sources: GrocerySourceLine[];
  wasMerged: boolean;
};

const SRC_SEP = '::src::';

export function normalizeIngredientName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeUnit(unit: string | null | undefined): string {
  if (!unit) return '';
  const u = unit.trim().toLowerCase().replace(/\./g, '');
  const aliases: Record<string, string> = {
    tbsp: 'tbsp',
    tablespoon: 'tbsp',
    tablespoons: 'tbsp',
    tsp: 'tsp',
    teaspoon: 'tsp',
    teaspoons: 'tsp',
    cup: 'cup',
    cups: 'cup',
    oz: 'oz',
    ounce: 'oz',
    ounces: 'oz',
    lb: 'lb',
    lbs: 'lb',
    pound: 'lb',
    pounds: 'lb',
    g: 'g',
    gram: 'g',
    grams: 'g',
    kg: 'kg',
    ml: 'ml',
    l: 'l',
    clove: 'clove',
    cloves: 'clove',
  };
  return aliases[u] ?? u;
}

export function buildMergeKey(name: string, unit?: string | null): string {
  return `${normalizeIngredientName(name)}|${normalizeUnit(unit)}`;
}

export function encodeMergeKey(baseKey: string, sources: GrocerySourceLine[]): string {
  if (sources.length <= 1) return baseKey;
  return `${baseKey}${SRC_SEP}${JSON.stringify(sources)}`;
}

export function parseMergeKey(mergeKey: string | null): {
  baseKey: string;
  sources: GrocerySourceLine[] | null;
} {
  if (!mergeKey) return { baseKey: '', sources: null };
  const idx = mergeKey.indexOf(SRC_SEP);
  if (idx === -1) return { baseKey: mergeKey, sources: null };
  const baseKey = mergeKey.slice(0, idx);
  try {
    const sources = JSON.parse(mergeKey.slice(idx + SRC_SEP.length)) as GrocerySourceLine[];
    return { baseKey, sources: Array.isArray(sources) ? sources : null };
  } catch {
    return { baseKey, sources: null };
  }
}

function mergedQuantity(group: GrocerySourceLine[]): string | null | undefined {
  let total = 0;
  let hasNumericQuantity = false;

  for (const line of group) {
    if (!line.quantity?.trim()) continue;
    const numericQuantity = parseQuantity(line.quantity);
    if (numericQuantity == null) return undefined;
    total += numericQuantity;
    hasNumericQuantity = true;
  }

  return hasNumericQuantity ? formatQuantityForUnit(total, normalizeUnit(group[0].unit)) : null;
}

function provenanceTitle(sources: GrocerySourceLine[]): string | null {
  const titles = [
    ...new Set(sources.map((s) => s.recipeTitle?.trim()).filter((t): t is string => !!t)),
  ];
  if (titles.length === 0) return null;
  return titles.join(' · ');
}

/**
 * Merge compatible lines (same normalized name + unit). Blank quantities merge with numeric
 * quantities without erasing the amount; written non-numeric quantities remain separate.
 */
export function mergeGroceryLines(lines: GrocerySourceLine[]): MergedGroceryDraft[] {
  const buckets = new Map<string, GrocerySourceLine[]>();

  for (const line of lines) {
    const key = buildMergeKey(line.name, line.unit);
    const list = buckets.get(key) ?? [];
    list.push(line);
    buckets.set(key, list);
  }

  const drafts: MergedGroceryDraft[] = [];

  for (const [baseKey, group] of buckets) {
    if (group.length === 1) {
      const only = group[0];
      drafts.push({
        name: only.name,
        quantity: only.quantity,
        unit: only.unit,
        aisle: only.aisle,
        recipeId: only.recipeId,
        recipeTitle: only.recipeTitle,
        mergeKey: baseKey,
        sources: [only],
        wasMerged: false,
      });
      continue;
    }

    const quantity = mergedQuantity(group);
    if (quantity === undefined) {
      for (const line of group) {
        drafts.push({
          name: line.name,
          quantity: line.quantity,
          unit: line.unit,
          aisle: line.aisle,
          recipeId: line.recipeId,
          recipeTitle: line.recipeTitle,
          mergeKey: baseKey,
          sources: [line],
          wasMerged: false,
        });
      }
      continue;
    }

    const unit = group.find((g) => g.unit)?.unit ?? null;
    const aisle = group.find((g) => g.aisle)?.aisle ?? null;
    const displayName = group[0].name;
    const recipeIds = [...new Set(group.map((g) => g.recipeId).filter(Boolean))];

    drafts.push({
      name: displayName,
      quantity,
      unit,
      aisle,
      recipeId: recipeIds.length === 1 ? recipeIds[0]! : null,
      recipeTitle: provenanceTitle(group),
      mergeKey: encodeMergeKey(baseKey, group),
      sources: group,
      wasMerged: true,
    });
  }

  return drafts;
}

/** Expand a stored merged item back into source drafts for unmerge UI. */
export function splitMergedDraft(params: {
  name: string;
  quantity: string | null;
  unit: string | null;
  aisle: string | null;
  recipeId: string | null;
  recipeTitle: string | null;
  mergeKey: string | null;
}): GrocerySourceLine[] | null {
  const { sources } = parseMergeKey(params.mergeKey);
  if (sources && sources.length > 1) return sources;
  return null;
}
