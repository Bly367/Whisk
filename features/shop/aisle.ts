/**
 * Lightweight aisle assignment for grocery grouping.
 * Prefer ingredient.aisle when set; otherwise keyword heuristics.
 */

export const AISLE_ORDER = [
  'Produce',
  'Meat & Seafood',
  'Dairy & Eggs',
  'Bakery',
  'Pantry',
  'Spices',
  'Frozen',
  'Beverages',
  'Other',
] as const;

export type AisleName = (typeof AISLE_ORDER)[number];

const KEYWORD_AISLES: { aisle: AisleName; patterns: RegExp }[] = [
  {
    aisle: 'Produce',
    patterns:
      /\b(lettuce|spinach|kale|onion|garlic|tomato|potato|carrot|celery|pepper|cucumber|avocado|lemon|lime|apple|banana|berry|berries|herb|parsley|cilantro|basil|ginger|mushroom|zucchini|broccoli|cabbage|fruit|vegetable)\b/i,
  },
  {
    aisle: 'Meat & Seafood',
    patterns:
      /\b(chicken|beef|pork|turkey|lamb|bacon|sausage|salmon|tuna|shrimp|fish|meat|steak|ground)\b/i,
  },
  {
    aisle: 'Dairy & Eggs',
    patterns:
      /\b(milk|cream|butter|cheese|yogurt|egg|eggs|sour cream|mozzarella|parmesan|cheddar)\b/i,
  },
  {
    aisle: 'Bakery',
    patterns: /\b(bread|tortilla|bun|roll|bagel|pita|naan|croissant)\b/i,
  },
  {
    aisle: 'Spices',
    patterns:
      /\b(salt|pepper|cumin|paprika|oregano|thyme|chili|cinnamon|spice|seasoning|vanilla)\b/i,
  },
  {
    aisle: 'Frozen',
    patterns: /\b(frozen|ice cream)\b/i,
  },
  {
    aisle: 'Beverages',
    patterns: /\b(water|juice|soda|coffee|tea|wine|beer|broth|stock)\b/i,
  },
  {
    aisle: 'Pantry',
    patterns:
      /\b(flour|sugar|rice|pasta|oil|vinegar|sauce|bean|beans|lentil|noodle|spaghetti|can|canned|honey|soy|mustard|mayo|broth|stock|quinoa|oat|cereal)\b/i,
  },
];

export function resolveAisle(name: string, hint?: string | null): AisleName {
  const trimmed = hint?.trim();
  if (trimmed) {
    const match = AISLE_ORDER.find((a) => a.toLowerCase() === trimmed.toLowerCase());
    if (match) return match;
    // Preserve custom aisle labels as Other bucket label via passthrough —
    // callers store the hint string; grouping still works.
    return trimmed as AisleName;
  }

  for (const { aisle, patterns } of KEYWORD_AISLES) {
    if (patterns.test(name)) return aisle;
  }
  return 'Other';
}

export function aisleSortIndex(aisle: string | null | undefined): number {
  if (!aisle) return AISLE_ORDER.length;
  const idx = AISLE_ORDER.findIndex((a) => a.toLowerCase() === aisle.toLowerCase());
  return idx === -1 ? AISLE_ORDER.length : idx;
}
