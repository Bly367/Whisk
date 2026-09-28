import { parseIngredientLine } from '@/import/parse/ingredients';
import type { CookStep, IngredientInput } from '@/data/contracts';

export type CleanCaptionResult = {
  title: string;
  text: string;
  notes: string;
  groups: Map<string, string>;
  ingredients: IngredientInput[];
  steps: CookStep[];
};

const SECTION = /^(?:ingredients?|instructions?|directions?|method|steps?|how to make)\s*:??$/i;
const QUANTITY = /^(?:\d+(?:\s+\d+\/\d+|\s*(?:to|[–-])\s*\d+|\/\d+|\.\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞]|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a|an)\s/i;
const MEASUREMENT = /\b(?:cups?|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|lb|lbs?|pounds?|g|kg|ml|l|cloves?|cans?|sticks?|bunch(?:es)?|sprigs?|slices?|fillets?|stalks?|rind)\b/i;
const STEP = /^(?:(?:then|next|finally)\s+)?(?:add|air fry|bake|boil|bring|chop|combine|cook|crack|dice|drizzle|finish|flip|fold|heat|make|marinate|melt|mix|pat|place|pour|preheat|reduce|remove|roast|season|serve|simmer|slice|stir|toss|whisk|blend|let|sear|sprinkle|top|garnish|transfer|cover|brown|knead|roll|shape)\b/i;
const LEADING_SOCIAL_ADJECTIVE = /^(?:small|medium|large|fresh|unsalted|dried|low[- ]sodium|grated|chopped|diced|minced|sliced|cubed)\s+/i;
const NUMBER_WORDS: Record<string, string> = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12' };

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#x([\da-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&amp;/gi, '&');
}

function normalizeForMatch(value: string): string {
  return value.replace(/[‘’]/g, "'").replace(/[„“”«»]/g, '"');
}

function cleanPunctuation(line: string): string {
  return line
    .replace(/^[\s\u200b]+|[\s\u200b]+$/g, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/(?:\s+#[-\w]+)+\s*$/g, '')
    .trim();
}

function isCta(value: string): boolean {
  const line = normalizeForMatch(value).trim();
  return /(?:^|\s)(?:follow\s+(?:me|us|@\w+)?\s*(?:for|on)\b|save\s*(?:this|it)?\s*(?:recipe|post|reel|video)?\s*(?:for later|so you)\b|save for later\b|share\s+(?:this|with)\b|send this to\b|like and\s+(?:share|subscribe|follow)\b|comment\b.*(?:recipe|send|sent|DM|link)\b|recipe\s+(?:below|in (?:the )?comments|on my (?:blog|website|site))\b|link in (?:my )?bio\b|full recipe\b|tag (?:a|your) friend\b|turn on (?:post )?notifications\b)/i.test(line);
}

function isCookingStep(line: string): boolean {
  return STEP.test(line) || /^(?:save some|follow the package directions)\b/i.test(line);
}

function sectionName(line: string): string | null {
  const withoutDecoration = line.replace(/^(?:[•*\-]|\p{Extended_Pictographic}|\u200d|\ufe0f|\s)+/gu, '').trim();
  return SECTION.test(withoutDecoration) ? withoutDecoration : null;
}

function isNumberedStep(line: string): boolean {
  return /^(?:\d+[.)]|Step\s+\d+:?|\d\ufe0f?\u20e3)\s*/iu.test(line);
}

function titleFrom(line: string, sourceName: string): string {
  const title = line
    .split(/[.!?](?:\s|$)/)[0]
    .replace(/[\p{Extended_Pictographic}\u200d\ufe0e\ufe0f]/gu, '')
    .replace(/\.\.\.+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^["']+|["']+$/g, '')
    .trim();
  if (!title) return `Recipe from ${sourceName}`;
  return title.length <= 80 ? title : title.slice(0, 80).replace(/\s+\S*$/, '');
}

function isIngredientLike(line: string): boolean {
  const value = line.replace(/^[-*•]\s*/, '').trim();
  const quantity = QUANTITY.test(value);
  if (quantity && /^(?:a|an)\s/i.test(value) && !MEASUREMENT.test(value.replace(/^(?:a|an)\s+/i, ''))) return false;
  return quantity || MEASUREMENT.test(value) || /^(?:(?:chopped|sliced|diced|minced|fresh|grated)\s+)?(?:oil|salt|pepper|sesame|kimchi|basil|parsley|lemon|juice|scallion|green onions?)\b/i.test(value);
}

function isGroupHeader(line: string, next: string | undefined): boolean {
  const value = line.replace(/^[-*•]\s*/, '').trim();
  if (!next || value.length > 80 || value.includes(',') || /\d/.test(value) || sectionName(value) || STEP.test(value) || isNumberedStep(value) || STEP.test(next) || isNumberedStep(next) || sectionName(next)) return false;
  if (value.endsWith(':') || /^for\s+/i.test(value)) return true;
  return /^(?:[A-Z][a-z]*(?:\s+[A-Z][a-z]*){0,2}|[A-Z]{1,}(?:\s+[A-Z]{1,}){0,2})$/.test(value) && QUANTITY.test(next.replace(/^[-*•]\s*/, '').trim());
}

function splitEachLine(line: string): string[] {
  const value = line.replace(/^[-*•]\s*/, '').trim();
  const each = value.match(/^(.+?)\s+each:\s*(.+)$/i);
  if (!each) return [value];
  return each[2].split(/,|\band\b/i).map((name) => `${each[1]} ${name.trim()}`.trim()).filter(Boolean);
}

function socialIngredientLine(line: string): IngredientInput[] {
  const value = line.replace(/^[-*•]\s*/, '').trim();
  return splitEachLine(value).map((part, index) => {
    let normalized = part;
    const juice = normalized.match(/^juice\s+of\s+(\d+\/\d+)\s+(.+)$/i);
    if (juice) normalized = `${juice[1]} ${juice[2]}`;
    normalized = normalized
      .replace(/^(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i, (word) => NUMBER_WORDS[word.toLowerCase()] ?? word)
      .replace(/^half\s+a?\s*/i, '0.5 ')
      .replace(/^½\b/, '0.5')
      .replace(/^¼\b/, '0.25');
    const afterNameUnit = normalized.match(/^(\d+(?:\s+\d+\/\d+|\s*\/\d+|\s*(?:to|[–-])\s*\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])\s+(.+?)\s+(cloves?|fillets?|stalks?)\b(.*)$/i);
    if (afterNameUnit) normalized = `${afterNameUnit[1]} ${afterNameUnit[3]} ${afterNameUnit[2]}${afterNameUnit[4]}`;
    const metric = normalized.match(/^(\d+(?:\s+\d+\/\d+|\/\d+|\.\d+)?)\s+(oz|ounces?|lb|lbs?)\s+\((\d+(?:\.\d+)?\s*(?:g|kg|ml|l))\)\s+(.+)$/i);
    const parsed = metric
      ? { ...parseIngredientLine(`${metric[1]} ${metric[2]} ${metric[4]}`, index), note: metric[3] }
      : parseIngredientLine(normalized, index);
    const trailingNote = parsed.name.match(/\s*\(([^()]*)\)\s*$/);
    if (trailingNote) parsed.name = parsed.name.slice(0, trailingNote.index).trim();
    const comma = parsed.name.match(/^(.*?),\s*(.+)$/);
    if (comma) {
      parsed.name = comma[1].trim();
      const preparation = `${comma[2].trim()}${trailingNote ? ` (${trailingNote[1].trim()})` : ''}`;
      parsed.note = [parsed.note, preparation].filter(Boolean).join('; ') || null;
    }
    else if (trailingNote) parsed.note = [parsed.note, trailingNote[1].trim()].filter(Boolean).join('; ') || null;
    const leading: string[] = [];
    while (LEADING_SOCIAL_ADJECTIVE.test(parsed.name)) {
      const match = parsed.name.match(LEADING_SOCIAL_ADJECTIVE);
      if (!match) break;
      leading.push(match[0].trim());
      parsed.name = parsed.name.slice(match[0].length).trim();
    }
    if (leading.length) parsed.note = [parsed.note, leading.filter((word) => !/^(?:small|medium|large|fresh|unsalted|dried|low[- ]sodium)$/i.test(word)).join(' ')].filter(Boolean).join('; ') || null;
    if (/^lemon$/i.test(parsed.name) && /juice/i.test(part)) parsed.name = 'lemon juice';
    return parsed;
  });
}

export function cleanSocialCaption(input: string, sourceName: string): CleanCaptionResult {
  const groups = new Map<string, string>();
  const notes: string[] = [];
  const withoutPrefix = decodeEntities(input).replace(/^\s*[\d.,]+\s*[KMB]?\s+likes?,\s*[\d.,]+\s*[KMB]?\s+comments?\s*-\s*[^:]+:\s*/i, '');
  const lines: string[] = [];
  for (const raw of withoutPrefix.split(/\r?\n/)) {
    const line = cleanPunctuation(raw.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, ''));
    if (!line || /^[\p{P}\p{S}\s.]+$/u.test(line) || /^(?:#[-\w]+\s*)+$/i.test(line)) continue;
    const chunks = line.split(/(?<=[.!?])\s+/);
    const kept: string[] = [];
    for (const chunk of chunks) {
      if (isCta(chunk)) notes.push(chunk.trim());
      else kept.push(chunk.trim());
    }
    if (kept.length) lines.push(kept.join(' ').replace(/\*$/, '').trim());
  }
  const titleLine = lines.find((line) => !SECTION.test(line) && !isIngredientLike(line) && !/^[\d.,]+\s*[KMB]?\s+likes?/i.test(line)) ?? '';
  const title = titleFrom(titleLine, sourceName);
  const bodyLines = lines[0] === titleLine ? lines.slice(1) : lines;
  const ingredientLines: { line: string; group: string | null }[] = [];
  const stepLines: string[] = [];
  let inIngredients = false;
  let group: string | null = null;
  for (let index = 0; index < bodyLines.length; index += 1) {
    const line = bodyLines[index];
    const next = bodyLines[index + 1];
    const section = sectionName(line);
    if (section) {
      inIngredients = /^(?:ingredients?)/i.test(section);
      group = null;
      if (/^(?:instructions?|directions?|method|steps?|how to make)/i.test(section)) inIngredients = false;
      continue;
    }
    if (isGroupHeader(line, next)) {
      group = line.replace(/:$/, '').trim();
      inIngredients = true;
      continue;
    }
    if (isNumberedStep(line)) {
      stepLines.push(line.replace(/^(?:\d+[.)]|Step\s+\d+:?|\d\ufe0f?\u20e3)\s*/iu, '').trim());
      inIngredients = false;
      continue;
    }
    if (/^\*?Sub:/i.test(line)) {
      notes.push(line.replace(/^\*?/, '').trim());
      continue;
    }
    if (inIngredients && isCookingStep(line)) {
      stepLines.push(line);
      inIngredients = false;
      continue;
    }
    if (inIngredients && line.length > 30 && /[.!?]$/.test(line) && !isIngredientLike(line)) {
      notes.push(line);
      continue;
    }
    if (inIngredients || isIngredientLike(line)) {
      if (isIngredientLike(line) || (inIngredients && line.length <= 80 && !/[.!?]$/.test(line))) {
        ingredientLines.push({ line, group });
        inIngredients = true;
        continue;
      }
    }
    if (isCookingStep(line)) stepLines.push(line);
    else if (line.length > 20) notes.push(line);
  }
  const ingredients = ingredientLines.flatMap(({ line, group: itemGroup }) => socialIngredientLine(line).map((ingredient) => ({ ...ingredient, groupName: itemGroup })));
  for (const ingredient of ingredients) {
    if (ingredient.groupName) groups.set(ingredient.name.toLowerCase(), ingredient.groupName);
  }
  const steps: CookStep[] = stepLines.map((text, position) => ({ id: `caption-step-${position}`, text: text.replace(/^(\w)/, (_, first) => first.toUpperCase()), position }));
  const text = [title, ingredients.length ? 'Ingredients:' : '', ...ingredientLines.map(({ line }) => line), steps.length ? 'Instructions:' : '', ...steps.map((step) => step.text)].filter(Boolean).join('\n');
  return { title, text, notes: notes.join('\n'), groups, ingredients, steps };
}
