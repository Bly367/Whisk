import { Ingredient, Nutrition } from '../../types/recipe';

/** Per-100g macros unless noted via unit helpers. */
interface FoodEntry {
  aliases: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Grams when unit is a whole item (egg, clove, etc.). */
  gramsPerEach?: number;
  gramsPerCup?: number;
  gramsPerTbsp?: number;
  gramsPerTsp?: number;
}

const FOODS: FoodEntry[] = [
  { aliases: ['uncooked chicken breast', 'raw chicken breast', 'uncooked chicken', 'raw chicken'], calories: 120, protein: 22.5, carbs: 0, fat: 2.6, gramsPerEach: 120 },
  { aliases: ['chicken breast', 'chicken'], calories: 165, protein: 31, carbs: 0, fat: 3.6, gramsPerEach: 120 },
  { aliases: ['chicken thigh', 'thighs'], calories: 209, protein: 26, carbs: 0, fat: 12 },
  { aliases: ['ground turkey', 'turkey'], calories: 170, protein: 20, carbs: 0, fat: 9 },
  { aliases: ['ground beef', 'beef mince', 'minced beef', 'beef'], calories: 250, protein: 26, carbs: 0, fat: 15 },
  { aliases: ['steak', 'sirloin', 'ribeye'], calories: 271, protein: 25, carbs: 0, fat: 19 },
  { aliases: ['pork', 'pork chop'], calories: 242, protein: 27, carbs: 0, fat: 14 },
  { aliases: ['bacon'], calories: 541, protein: 37, carbs: 1.4, fat: 42, gramsPerEach: 12 },
  { aliases: ['salmon', 'fish'], calories: 208, protein: 20, carbs: 0, fat: 13 },
  { aliases: ['shrimp', 'prawn', 'prawns'], calories: 99, protein: 24, carbs: 0.2, fat: 0.3 },
  { aliases: ['tuna'], calories: 132, protein: 28, carbs: 0, fat: 1.3 },
  { aliases: ['tofu'], calories: 76, protein: 8, carbs: 1.9, fat: 4.8 },
  { aliases: ['tempeh'], calories: 193, protein: 19, carbs: 9, fat: 11 },
  { aliases: ['egg', 'eggs'], calories: 143, protein: 13, carbs: 0.7, fat: 9.5, gramsPerEach: 50 },
  { aliases: ['egg white', 'egg whites'], calories: 52, protein: 11, carbs: 0.7, fat: 0.2, gramsPerEach: 33 },
  { aliases: ['milk'], calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, gramsPerCup: 244 },
  { aliases: ['whole milk'], calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, gramsPerCup: 244 },
  { aliases: ['skim milk', 'nonfat milk'], calories: 34, protein: 3.4, carbs: 5, fat: 0.1, gramsPerCup: 245 },
  { aliases: ['almond milk'], calories: 17, protein: 0.6, carbs: 0.6, fat: 1.1, gramsPerCup: 240 },
  { aliases: ['oat milk'], calories: 43, protein: 1.5, carbs: 6.7, fat: 1.5, gramsPerCup: 240 },
  { aliases: ['heavy cream', 'whipping cream', 'cream'], calories: 340, protein: 2.8, carbs: 2.8, fat: 36, gramsPerCup: 238, gramsPerTbsp: 15 },
  { aliases: ['sour cream'], calories: 198, protein: 2.4, carbs: 4.6, fat: 19, gramsPerCup: 230, gramsPerTbsp: 12 },
  { aliases: ['greek yogurt', 'yogurt'], calories: 97, protein: 9, carbs: 3.6, fat: 5, gramsPerCup: 245 },
  { aliases: ['butter'], calories: 717, protein: 0.9, carbs: 0.1, fat: 81, gramsPerCup: 227, gramsPerTbsp: 14, gramsPerTsp: 5 },
  { aliases: ['olive oil', 'oil', 'vegetable oil', 'canola oil', 'avocado oil', 'sesame oil', 'coconut oil'], calories: 884, protein: 0, carbs: 0, fat: 100, gramsPerCup: 218, gramsPerTbsp: 14, gramsPerTsp: 4.5 },
  { aliases: ['cheese', 'cheddar', 'mozzarella', 'parmesan', 'feta', 'goat cheese'], calories: 402, protein: 25, carbs: 1.3, fat: 33, gramsPerCup: 113 },
  { aliases: ['cream cheese'], calories: 342, protein: 6, carbs: 4.1, fat: 34, gramsPerTbsp: 14 },
  { aliases: ['rice', 'white rice', 'jasmine rice', 'basmati'], calories: 130, protein: 2.7, carbs: 28, fat: 0.3, gramsPerCup: 185 },
  { aliases: ['brown rice'], calories: 123, protein: 2.7, carbs: 26, fat: 1, gramsPerCup: 195 },
  { aliases: ['quinoa'], calories: 120, protein: 4.4, carbs: 21, fat: 1.9, gramsPerCup: 185 },
  { aliases: ['oats', 'oatmeal', 'rolled oats'], calories: 389, protein: 17, carbs: 66, fat: 7, gramsPerCup: 90 },
  { aliases: ['pasta', 'spaghetti', 'noodles', 'penne', 'macaroni'], calories: 158, protein: 5.8, carbs: 31, fat: 0.9, gramsPerCup: 140 },
  { aliases: ['bread', 'toast', 'sourdough'], calories: 265, protein: 9, carbs: 49, fat: 3.2, gramsPerEach: 30 },
  { aliases: ['flour', 'all-purpose flour', 'all purpose flour', 'wheat flour'], calories: 364, protein: 10, carbs: 76, fat: 1, gramsPerCup: 125, gramsPerTbsp: 8 },
  { aliases: ['sugar', 'white sugar', 'granulated sugar', 'brown sugar'], calories: 387, protein: 0, carbs: 100, fat: 0, gramsPerCup: 200, gramsPerTbsp: 12.5, gramsPerTsp: 4 },
  { aliases: ['honey'], calories: 304, protein: 0.3, carbs: 82, fat: 0, gramsPerTbsp: 21, gramsPerTsp: 7 },
  { aliases: ['maple syrup'], calories: 260, protein: 0, carbs: 67, fat: 0.1, gramsPerTbsp: 20 },
  { aliases: ['potato', 'potatoes', 'yukon', 'russet'], calories: 77, protein: 2, carbs: 17, fat: 0.1, gramsPerEach: 170 },
  { aliases: ['sweet potato', 'sweet potatoes'], calories: 86, protein: 1.6, carbs: 20, fat: 0.1, gramsPerEach: 130 },
  { aliases: ['onion', 'onions', 'shallot', 'shallots'], calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1, gramsPerEach: 110, gramsPerCup: 160 },
  { aliases: ['garlic'], calories: 149, protein: 6.4, carbs: 33, fat: 0.5, gramsPerEach: 3, gramsPerTsp: 2.8 },
  { aliases: ['tomato', 'tomatoes', 'cherry tomato', 'cherry tomatoes'], calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, gramsPerEach: 123, gramsPerCup: 180 },
  { aliases: ['tomato sauce', 'marinara', 'passata'], calories: 29, protein: 1.3, carbs: 6.2, fat: 0.2, gramsPerCup: 245 },
  { aliases: ['tomato paste'], calories: 82, protein: 4.3, carbs: 19, fat: 0.5, gramsPerTbsp: 16 },
  { aliases: ['bell pepper', 'pepper', 'peppers', 'red pepper', 'green pepper'], calories: 31, protein: 1, carbs: 6, fat: 0.3, gramsPerEach: 120, gramsPerCup: 150 },
  { aliases: ['spinach'], calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, gramsPerCup: 30 },
  { aliases: ['kale'], calories: 49, protein: 4.3, carbs: 9, fat: 0.9, gramsPerCup: 67 },
  { aliases: ['broccoli'], calories: 34, protein: 2.8, carbs: 7, fat: 0.4, gramsPerCup: 91 },
  { aliases: ['carrot', 'carrots'], calories: 41, protein: 0.9, carbs: 10, fat: 0.2, gramsPerEach: 61, gramsPerCup: 128 },
  { aliases: ['celery'], calories: 16, protein: 0.7, carbs: 3, fat: 0.2, gramsPerCup: 101 },
  { aliases: ['cucumber'], calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1, gramsPerEach: 300 },
  { aliases: ['zucchini', 'courgette'], calories: 17, protein: 1.2, carbs: 3.1, fat: 0.3, gramsPerEach: 200, gramsPerCup: 124 },
  { aliases: ['mushroom', 'mushrooms'], calories: 22, protein: 3.1, carbs: 3.3, fat: 0.3, gramsPerCup: 70 },
  { aliases: ['avocado'], calories: 160, protein: 2, carbs: 8.5, fat: 15, gramsPerEach: 150 },
  { aliases: ['lemon', 'lime'], calories: 29, protein: 1.1, carbs: 9, fat: 0.3, gramsPerEach: 60 },
  { aliases: ['lemon juice', 'lime juice'], calories: 22, protein: 0.4, carbs: 6.9, fat: 0.2, gramsPerTbsp: 15, gramsPerCup: 244 },
  { aliases: ['apple'], calories: 52, protein: 0.3, carbs: 14, fat: 0.2, gramsPerEach: 182 },
  { aliases: ['banana'], calories: 89, protein: 1.1, carbs: 23, fat: 0.3, gramsPerEach: 118 },
  { aliases: ['berries', 'blueberry', 'blueberries', 'strawberry', 'strawberries', 'raspberry', 'raspberries'], calories: 57, protein: 0.7, carbs: 14, fat: 0.3, gramsPerCup: 148 },
  { aliases: ['beans', 'black beans', 'kidney beans', 'chickpeas', 'garbanzo', 'lentils', 'white beans'], calories: 127, protein: 8.7, carbs: 23, fat: 0.5, gramsPerCup: 170 },
  { aliases: ['peanut butter', 'almond butter'], calories: 588, protein: 25, carbs: 20, fat: 50, gramsPerTbsp: 16 },
  { aliases: ['peanuts', 'almonds', 'walnuts', 'cashews', 'nuts', 'pecans'], calories: 607, protein: 20, carbs: 21, fat: 54, gramsPerCup: 140 },
  { aliases: ['chia seeds', 'flax seeds', 'flaxseed', 'hemp seeds'], calories: 486, protein: 17, carbs: 42, fat: 31, gramsPerTbsp: 10 },
  { aliases: ['protein powder', 'whey', 'casein'], calories: 400, protein: 75, carbs: 10, fat: 5, gramsPerEach: 30, gramsPerTbsp: 7 },
  { aliases: ['broth', 'stock', 'chicken broth', 'vegetable broth', 'beef broth'], calories: 15, protein: 1, carbs: 1, fat: 0.5, gramsPerCup: 240 },
  { aliases: ['soy sauce', 'tamari'], calories: 53, protein: 8, carbs: 5, fat: 0.1, gramsPerTbsp: 16 },
  { aliases: ['vinegar', 'balsamic', 'apple cider vinegar', 'rice vinegar'], calories: 18, protein: 0, carbs: 0.9, fat: 0, gramsPerTbsp: 15 },
  { aliases: ['mustard'], calories: 66, protein: 4, carbs: 5, fat: 3, gramsPerTbsp: 15, gramsPerTsp: 5 },
  { aliases: ['mayo', 'mayonnaise'], calories: 680, protein: 1, carbs: 0.6, fat: 75, gramsPerTbsp: 14 },
  { aliases: ['ketchup'], calories: 112, protein: 1, carbs: 27, fat: 0.1, gramsPerTbsp: 17 },
  { aliases: ['coconut milk'], calories: 230, protein: 2.3, carbs: 6, fat: 24, gramsPerCup: 240 },
  { aliases: ['coconut'], calories: 354, protein: 3.3, carbs: 15, fat: 33 },
  { aliases: ['corn', 'sweet corn'], calories: 86, protein: 3.3, carbs: 19, fat: 1.2, gramsPerCup: 164 },
  { aliases: ['peas'], calories: 81, protein: 5.4, carbs: 14, fat: 0.4, gramsPerCup: 145 },
  { aliases: ['ginger'], calories: 80, protein: 1.8, carbs: 18, fat: 0.8, gramsPerTsp: 2 },
  { aliases: ['cilantro', 'parsley', 'basil', 'herbs', 'mint', 'dill'], calories: 36, protein: 3, carbs: 6, fat: 0.6, gramsPerCup: 16 },
  { aliases: ['salt', 'pepper', 'black pepper', 'paprika', 'cumin', 'chili powder', 'oregano', 'thyme', 'cinnamon', 'spice', 'spices', 'seasoning'], calories: 0, protein: 0, carbs: 0, fat: 0, gramsPerTsp: 2 },
  { aliases: ['water'], calories: 0, protein: 0, carbs: 0, fat: 0, gramsPerCup: 240, gramsPerTbsp: 15 },
];

const FRACTIONS: Record<string, number> = {
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

function parseAmount(raw: string): number | undefined {
  const value = raw.trim().toLowerCase();
  if (!value) return undefined;
  if (FRACTIONS[value] !== undefined) return FRACTIONS[value];

  const mixed = value.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  }

  const fraction = value.match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);

  const withGlyph = value.match(/^(\d+(?:\.\d+)?)\s*([¼½¾⅓⅔⅛⅜⅝⅞])$/);
  if (withGlyph) return Number(withGlyph[1]) + (FRACTIONS[withGlyph[2]] ?? 0);

  if (FRACTIONS[value[0]] !== undefined && value.length === 1) return FRACTIONS[value];

  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) ? number : undefined;
}

function normalizeUnit(unit: string): string {
  const value = unit.trim().toLowerCase().replace(/\./g, '');
  if (!value) return '';
  if (/^(tsp|teaspoons?)$/.test(value)) return 'tsp';
  if (/^(tbsp|tbs|tablespoons?)$/.test(value)) return 'tbsp';
  if (/^(cups?|c)$/.test(value)) return 'cup';
  if (/^(oz|ounces?)$/.test(value)) return 'oz';
  if (/^(lb|lbs|pounds?)$/.test(value)) return 'lb';
  if (/^(g|grams?)$/.test(value)) return 'g';
  if (/^(kg|kilograms?)$/.test(value)) return 'kg';
  if (/^(ml|milliliters?|millilitres?)$/.test(value)) return 'ml';
  if (/^(l|liters?|litres?)$/.test(value)) return 'l';
  if (/^(cloves?)$/.test(value)) return 'each';
  if (/^(slices?|pieces?|pcs?|whole|large|medium|small)$/.test(value)) return 'each';
  if (/^(cans?|packages?|packs?|bunches?|heads?)$/.test(value)) return 'each';
  if (/^(fl\s*oz|fluid ounces?)$/.test(value)) return 'fl_oz';
  return value;
}

function matchFood(name: string): FoodEntry | undefined {
  const normalized = name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let best: { entry: FoodEntry; score: number } | undefined;
  for (const entry of FOODS) {
    for (const alias of entry.aliases) {
      if (normalized === alias) return entry;
      if (normalized.includes(alias)) {
        const score = alias.length;
        if (!best || score > best.score) best = { entry, score };
      }
    }
  }
  return best?.entry;
}

function gramsForIngredient(
  amount: number | undefined,
  unit: string,
  food: FoodEntry,
): number | undefined {
  const qty = amount ?? (unit === 'each' || !unit ? 1 : undefined);
  if (qty === undefined) return undefined;

  switch (unit) {
    case 'g':
      return qty;
    case 'kg':
      return qty * 1000;
    case 'oz':
      return qty * 28.35;
    case 'lb':
      return qty * 453.6;
    case 'ml':
    case 'fl_oz':
      // Approximate 1 ml ~= 1 g for most kitchen liquids we care about.
      return unit === 'fl_oz' ? qty * 29.57 : qty;
    case 'l':
      return qty * 1000;
    case 'cup':
      return food.gramsPerCup ? qty * food.gramsPerCup : qty * 120;
    case 'tbsp':
      return food.gramsPerTbsp ? qty * food.gramsPerTbsp : qty * 15;
    case 'tsp':
      return food.gramsPerTsp ? qty * food.gramsPerTsp : qty * 5;
    case 'each':
    case '':
      return food.gramsPerEach ? qty * food.gramsPerEach : qty * 100;
    default:
      return food.gramsPerEach ? qty * food.gramsPerEach : undefined;
  }
}

function macrosForGrams(food: FoodEntry, grams: number): Nutrition {
  const factor = grams / 100;
  return {
    calories: food.calories * factor,
    protein: food.protein * factor,
    carbs: food.carbs * factor,
    fat: food.fat * factor,
  };
}

function addNutrition(a: Nutrition, b: Nutrition): Nutrition {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

function parseLooseIngredient(ingredient: Ingredient): {
  amount?: number;
  unit: string;
  name: string;
} {
  const amountFromField = parseAmount(ingredient.amount);
  const unitFromField = normalizeUnit(ingredient.unit);
  if (amountFromField !== undefined || unitFromField || !ingredient.name) {
    return {
      amount: amountFromField,
      unit: unitFromField,
      name: ingredient.name,
    };
  }

  // When amount/unit live inside the name (common after freeform edits).
  const match = ingredient.name
    .trim()
    .match(
      /^(\d+(?:\.\d+)?|\d+\s+\d+\/\d+|\d+\/\d+|[¼½¾⅓⅔⅛⅜⅝⅞])?\s*(fl\s+oz|tsp|teaspoons?|tbsp|tablespoons?|cups?|oz|ounces?|lb|pounds?|g|kg|ml|l|cloves?|cans?|packages?|slices?|pieces?)?\b\s*(.*)$/i,
    );
  if (!match) return { name: ingredient.name, unit: '' };
  return {
    amount: parseAmount(match[1] ?? ''),
    unit: normalizeUnit(match[2] ?? ''),
    name: match[3] || ingredient.name,
  };
}

export interface NutritionEstimate {
  nutrition: Nutrition;
  matchedIngredients: number;
  totalIngredients: number;
  estimated: true;
}

/**
 * Estimates per-serving macros from ingredient quantities.
 * Returns undefined when nothing usable can be matched.
 *
 * Callers that need totals for N servings should multiply with scaleNutrition(..., N).
 */
export function estimateNutritionFromIngredients(
  ingredients: Ingredient[],
  servings = 1,
): NutritionEstimate | undefined {
  if (!ingredients.length) return undefined;

  let total: Nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  let matched = 0;

  for (const ingredient of ingredients) {
    const parsed = parseLooseIngredient(ingredient);
    const food = matchFood(parsed.name);
    if (!food) continue;
    const grams = gramsForIngredient(parsed.amount, parsed.unit, food);
    if (!grams || grams <= 0) continue;
    total = addNutrition(total, macrosForGrams(food, grams));
    matched += 1;
  }

  if (!matched) return undefined;

  const divisor = Math.max(1, servings);
  return {
    nutrition: {
      calories: Math.round(total.calories / divisor),
      protein: Math.round(total.protein / divisor),
      carbs: Math.round(total.carbs / divisor),
      fat: Math.round(total.fat / divisor),
    },
    matchedIngredients: matched,
    totalIngredients: ingredients.length,
    estimated: true,
  };
}

/** Prefer author nutrition; otherwise estimate from ingredients. */
export function resolveRecipeNutrition(recipe: {
  nutrition?: Nutrition;
  ingredients: Ingredient[];
  servings: number;
}): { nutrition: Nutrition; estimated: boolean } | undefined {
  if (
    recipe.nutrition &&
    (recipe.nutrition.calories > 0 ||
      recipe.nutrition.protein > 0 ||
      recipe.nutrition.carbs > 0 ||
      recipe.nutrition.fat > 0)
  ) {
    return { nutrition: recipe.nutrition, estimated: false };
  }

  const estimate = estimateNutritionFromIngredients(recipe.ingredients, recipe.servings);
  if (!estimate) return undefined;
  return { nutrition: estimate.nutrition, estimated: true };
}
