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

function parseQuantity(raw: string | null | undefined): number | null {
  if (raw == null || raw.trim() === '') return null;
  const cleaned = raw.trim().replace(/,/g, '');
  // Support simple fractions like 1/2 or 1 1/2
  const mixed = cleaned.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  }
  const frac = cleaned.match(/^(\d+)\/(\d+)$/);
  if (frac) {
    return Number(frac[1]) / Number(frac[2]);
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function formatQuantity(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const rounded = Math.round(n * 100) / 100;
  return String(rounded);
}

function canMergeQuantities(
  a: string | null,
  b: string | null,
): { ok: true; sum: string } | { ok: false } {
  const na = parseQuantity(a);
  const nb = parseQuantity(b);
  if (na == null && nb == null) {
    return { ok: true, sum: '' };
  }
  if (na == null || nb == null) {
    // One side has no quantity — keep separate to avoid hiding amounts
    return { ok: false };
  }
  return { ok: true, sum: formatQuantity(na + nb) };
}

function provenanceTitle(sources: GrocerySourceLine[]): string | null {
  const titles = [
    ...new Set(sources.map((s) => s.recipeTitle?.trim()).filter((t): t is string => !!t)),
  ];
  if (titles.length === 0) return null;
  return titles.join(' · ');
}

/**
 * Merge compatible lines (same normalized name + unit, numeric quantities).
 * Incompatible pairs stay separate. Multi-recipe provenance is preserved for unmerge.
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

    // Try to fold the whole group; if any pair is incompatible, emit unmerged lines
    let quantity: string | null = group[0].quantity;
    let mergeOk = true;
    for (let i = 1; i < group.length; i++) {
      const result = canMergeQuantities(quantity, group[i].quantity);
      if (!result.ok) {
        mergeOk = false;
        break;
      }
      quantity = result.sum === '' ? null : result.sum;
    }

    if (!mergeOk) {
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
