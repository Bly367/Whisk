/**
 * Text normalization for OCR and pasted recipe content.
 * Fixes common OCR character confusions and merges fragmented lines.
 */

/**
 * Normalize OCR text by fixing common character confusions in recipe context.
 * - Fixes % → ½ when adjacent to measurements (teaspoon, cup, etc.)
 * - Fixes I/l → 1 before measurements
 * - Fixes common typos like "chii" → "chili"
 * - Preserves % in percentage context (e.g., "50%", "100% cocoa")
 */
export function normalizeOcrText(text: string): string {
  let result = text;

  // Fix lowercase l to 1 at start of quantity pattern (before cup/tsp or in fraction)
  // Do this BEFORE fraction replacement to preserve "1/2" format
  result = result.replace(/\bl\s+(?=(cup|teaspoon|tsp|tablespoon|tbsp)\b)/gi, '1 ');
  result = result.replace(/\bl\/(\d)/g, '1/$1');

  // Fix /2 patterns to ½ (handles "1/2" and OCR errors like "I/2")
  result = result.replace(/(\d|I)\/2\b/g, '½');

  // Fix % to ½ when followed by measurement words (but not in percentage context like "50%")
  // Negative lookbehind to avoid "50%", positive lookahead for measurement
  result = result.replace(/(?<!\d)%\s*(?=(teaspoons?|tsps?|tablespoons?|tbsps?|cups?)\b)/gi, '½ ');

  // Fix capital I to 1 when followed by measurement words
  result = result.replace(/\bI\s+(?=(cup|teaspoon|tsp|tablespoon|tbsp|oz|lb|gram|kg|ml|liter)\b)/gi, '1 ');

  // Fix common typo: chii → chili
  result = result.replace(/\bchii\b/gi, 'chili');

  return result;
}

/**
 * Merge ingredient fragment lines that are continuations of the previous line.
 * - Merges lowercase continuation words (minced, divided, rinsed and drained, etc.)
 * - Does not merge lines starting with uppercase or quantity patterns (new ingredients)
 * - Filters out empty lines
 */
export function mergeIngredientFragments(lines: string[]): string[] {
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue; // Skip empty lines

    const prevIndex = result.length - 1;
    const shouldMerge =
      prevIndex >= 0 &&
      isContinuationLine(line) &&
      !startsWithQuantity(line) &&
      !startsWithUppercase(line);

    if (shouldMerge) {
      // Merge with previous line
      const separator = result[prevIndex].endsWith(',') ? ' ' : ' ';
      result[prevIndex] += separator + line;
    } else {
      result.push(line);
    }
  }

  return result;
}

/**
 * Filter out orphan step fragments that shouldn't be separate steps.
 * - Removes single-word fragments that are clearly not instructions (minced, with, etc.)
 * - Removes quantity-only fragments (% teaspoon, 1 cup, etc.)
 * - Keeps valid single-word instructions (Mix, Serve, Enjoy)
 */
export function dedupeSteps(steps: string[]): string[] {
  return steps.filter((step) => {
    const trimmed = step.trim();
    if (!trimmed) return false;

    // Check if it's a quantity pattern (likely an ingredient fragment)
    if (isQuantityFragment(trimmed)) return false;

    // Check if it's a single word
    const words = trimmed.split(/\s+/);
    if (words.length === 1) {
      const word = words[0].toLowerCase();
      // Keep if it's a valid imperative verb
      if (isImperativeVerb(word)) return true;
      // Keep if it ends with punctuation (Serve!, Enjoy.)
      if (/[.!?]$/.test(word)) return true;
      // Filter out common non-instruction words
      return !isCommonFragment(word);
    }

    // Keep multi-word steps
    return true;
  });
}

// Helper: check if line looks like a continuation word/phrase
function isContinuationLine(line: string): boolean {
  const lower = line.toLowerCase().replace(/[,;]$/g, '').trim();
  const continuationPatterns = [
    'minced',
    'chopped',
    'diced',
    'sliced',
    'divided',
    'softened',
    'melted',
    'rinsed',
    'drained',
    'rinsed and drained',
    'freshly ground',
    'to taste',
    'optional',
    'for serving',
    'for garnish',
    'sifted',
  ];
  
  // Check exact matches or if it starts with a continuation pattern
  if (continuationPatterns.some((pattern) => lower === pattern || lower.startsWith(pattern))) {
    return true;
  }
  
  // Also consider single lowercase words as potential continuations
  const words = lower.split(/\s+/);
  if (words.length === 1 && /^[a-z]/.test(lower)) {
    return true;
  }
  
  return false;
}

// Helper: check if line starts with quantity pattern
function startsWithQuantity(line: string): boolean {
  return /^(\d+[\/.]\d+|\d+\s+\d+\/\d+|\d+\.?\d*)\s/.test(line);
}

// Helper: check if line starts with uppercase letter
function startsWithUppercase(line: string): boolean {
  return /^[A-Z]/.test(line);
}

// Helper: check if step is a quantity fragment
function isQuantityFragment(step: string): boolean {
  // Matches patterns like "% teaspoon chili powder", "1 cup flour", "2 cloves garlic"
  return /^[%½¼¾\d]+[\s\/]*(?:teaspoons?|tsps?|tablespoons?|tbsps?|cups?|oz|lb|cloves?|cans?)\b/i.test(
    step,
  );
}

// Helper: check if word is a valid imperative verb
function isImperativeVerb(word: string): boolean {
  const imperativeVerbs = [
    'mix',
    'stir',
    'add',
    'cook',
    'bake',
    'heat',
    'boil',
    'simmer',
    'blend',
    'whisk',
    'fold',
    'serve',
    'enjoy',
    'season',
    'taste',
    'strain',
    'drain',
  ];
  return imperativeVerbs.includes(word.toLowerCase().replace(/[.!?]$/, ''));
}

// Helper: check if word is a common non-instruction fragment
function isCommonFragment(word: string): boolean {
  const fragments = [
    'minced',
    'chopped',
    'diced',
    'sliced',
    'divided',
    'with',
    'and',
    'or',
    'the',
    'a',
    'an',
    'to',
    'of',
    'in',
    'on',
    'for',
  ];
  return fragments.includes(word.toLowerCase().replace(/[.,!?;:]$/, ''));
}
