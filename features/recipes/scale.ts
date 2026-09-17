/**
 * Serving scale helpers — keep original quantities visible when scaled.
 */

export type UnitSystem = 'original' | 'metric' | 'imperial';

/** Parse a common kitchen quantity string into a number (supports mixed fractions). */
export function parseQuantity(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const text = raw.trim().toLowerCase().replace(/,/g, '');
  if (!text) return null;

  // Mixed number: "1 1/2"
  const mixed = text.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const num = Number(mixed[2]);
    const den = Number(mixed[3]);
    if (den === 0) return null;
    return whole + num / den;
  }

  // Simple fraction: "3/4"
  const frac = text.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const num = Number(frac[1]);
    const den = Number(frac[2]);
    if (den === 0) return null;
    return num / den;
  }

  const decimal = Number(text);
  if (!Number.isFinite(decimal)) return null;
  return decimal;
}

/** Format a scaled number with light fraction preference for common values. */
export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  const nearest = Math.round(abs * 1000) / 1000;
  const whole = Math.floor(nearest + 1e-9);
  const frac = nearest - whole;

  const fractions: [number, string][] = [
    [0, ''],
    [1 / 8, '1/8'],
    [1 / 4, '1/4'],
    [1 / 3, '1/3'],
    [3 / 8, '3/8'],
    [1 / 2, '1/2'],
    [5 / 8, '5/8'],
    [2 / 3, '2/3'],
    [3 / 4, '3/4'],
    [7 / 8, '7/8'],
  ];

  let best = fractions[0];
  let bestDelta = Math.abs(frac - best[0]);
  for (const candidate of fractions) {
    const delta = Math.abs(frac - candidate[0]);
    if (delta < bestDelta) {
      best = candidate;
      bestDelta = delta;
    }
  }

  if (bestDelta <= 0.03) {
    if (whole === 0 && best[1]) return `${sign}${best[1]}`;
    if (best[1]) return `${sign}${whole} ${best[1]}`;
    return `${sign}${whole}`;
  }

  const rounded = Math.round(nearest * 100) / 100;
  return `${sign}${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, '')}`;
}

export function scaleFactor(baseServings: number, targetServings: number): number {
  if (!Number.isFinite(baseServings) || baseServings <= 0) return 1;
  if (!Number.isFinite(targetServings) || targetServings <= 0) return 1;
  return targetServings / baseServings;
}

export type ScaledQuantity = {
  /** Display quantity after scaling (null when original was non-numeric). */
  scaled: string | null;
  /** Original quantity string from the recipe. */
  original: string | null;
  /** True when servings differ from the recipe base and quantity was scaled. */
  isScaled: boolean;
};

export function scaleQuantityDisplay(
  quantity: string | null | undefined,
  baseServings: number | null | undefined,
  targetServings: number,
): ScaledQuantity {
  const original = quantity?.trim() || null;
  const base = baseServings && baseServings > 0 ? baseServings : 1;
  const factor = scaleFactor(base, targetServings);
  const isScaled = Math.abs(factor - 1) > 1e-9;

  if (!original) {
    return { scaled: null, original: null, isScaled };
  }

  const parsed = parseQuantity(original);
  if (parsed === null || !isScaled) {
    return { scaled: original, original, isScaled: false };
  }

  return {
    scaled: formatQuantity(parsed * factor),
    original,
    isScaled: true,
  };
}

/**
 * Unit preference display.
 *
 * Metric / Imperial conversion is not shipped yet. Never remap unit labels
 * without converting the numeric quantity (that would lie about amounts).
 * Always return the recipe’s written unit until real conversion lands.
 */
export function preferUnit(
  unit: string | null | undefined,
  _system: UnitSystem = 'original',
): string | null {
  return unit?.trim() || null;
}

/** True when a unit system can safely change displayed amounts. */
export function isUnitSystemAvailable(system: UnitSystem): boolean {
  return system === 'original';
}
