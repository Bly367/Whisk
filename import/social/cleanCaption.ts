import { parseIngredientLine } from '@/import/parse/ingredients';
import type { IngredientInput } from '@/data/contracts';

export type CleanCaptionResult = {
  title: string;
  text: string;
  notes: string;
  groups: Map<string, string>;
  ingredients: IngredientInput[];
};

const CTA = /comment\s+[„“"'‘«]?\w+[”“"'’»]?|(?:sent|send) (?:it )?to (?:you|your) (?:via )?DMs?|DM me|link in (?:my )?bio|full recipe (?:is )?(?:now )?(?:on|at|in)|recipe in (?:the )?comments|follow (?:me|for)|save (?:this|for later)|tag a friend/i;
const SECTION = /^(?:ingredients?|instructions?|directions?|method|steps?|how to make)\s*:??$/i;
const INGREDIENT = /^(?:[-*•]\s*)?(?:\d+(?:[./]\d+)?(?:\s*[–-]\s*\d+(?:[./]\d+)?)?|[¼½¾⅓⅔⅛⅜⅝⅞]|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a|an)\s+(?:medium|large|small|cups?|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|lb|lbs?|pounds?|g|kg|ml|l|cloves?|cans?|sticks?|bunch(?:es)?|sprigs?|slices?|fillets?|stalks?|rind\b)|^(?:[-*•]\s*)?(?:oil|salt|pepper|sesame seeds?|chopped scallion|fresh basil|lemon zest|kimchi)\b/i;

const cleanPunctuation = (line: string) => line
  .replace(/^[\s\u200b]+|[\s\u200b]+$/g, '')
  .replace(/https?:\/\/\S+/gi, '')
  .replace(/(?:\s+#[-\w]+)+\s*$/g, '')
  .trim();

function titleFrom(line: string, sourceName: string): string {
  const beforeCta = line.split(/(?=comment\s+|link in |full recipe |DM me)/i)[0]
    .split(/[.!?](?:\s|$)/)[0]
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
    .replace(/\.\.\.+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!beforeCta) return `Recipe from ${sourceName}`;
  const withoutQuotes = beforeCta.replace(/^["']+|["']+$/g, '').trim();
  return withoutQuotes.length <= 80 ? withoutQuotes : `${withoutQuotes.slice(0, 80).replace(/\s+\S*$/, '')}`;
}

export function cleanSocialCaption(input: string, sourceName: string): CleanCaptionResult {
  const groups = new Map<string, string>();
  const notes: string[] = [];
  const sourceLines = input.replace(/&quot;|&#34;/gi, '"').replace(/&#x201e;|&#x201c;|&#x201d;/gi, '"').replace(/[„“”‘’«»]/g, '"').replace(/^[\d.,KkMm]+ likes?, [\d.,KkMm]+ comments? - \S+ on [^:]+:\s*/i, '').split(/\r?\n/);
  const lines: string[] = [];
  for (const raw of sourceLines) {
    let line = cleanPunctuation(raw.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, ''));
    if (!line || /^[\p{P}\p{S}\s.]+$/u.test(line) || /^(?:#[-\w]+\s*)+$/i.test(line)) continue;
    if (CTA.test(line)) {
      const parts = line.split(/(?=comment\s+|link in |full recipe |DM me|follow |save |tag a friend)/i);
      const keep = parts.shift()?.trim();
      if (keep) lines.push(keep);
      notes.push(...parts.filter(Boolean).map((part) => part.trim()));
      continue;
    }
    if (line.startsWith('*Sub:') || /^Note:/i.test(line)) {
      notes.push(line.replace(/^\*?Sub:\s*|^Note:\s*/i, '').replace(/\*$/, '').trim());
      continue;
    }
    if (line) lines.push(line.replace(/\*$/, '').trim());
  }
  const titleLine = lines.find((line) => !SECTION.test(line) && !INGREDIENT.test(line) && !/^(?:144K|\d+[\d.,KkMm]*) likes?/i.test(line)) ?? '';
  const title = titleFrom(titleLine, sourceName);
  let inIngredients = false;
  let inSteps = false;
  let group: string | null = null;
  const ingredientLines: string[] = [];
  const stepLines: string[] = [];
  let sawIngredient = false;
  const bodyLines = lines[0] === titleLine ? lines.slice(1) : lines;
  for (const line of bodyLines) {
    if (SECTION.test(line)) {
      inSteps = /^(?:instructions?|directions?|method|steps?|how to make)/i.test(line);
      inIngredients = !inSteps;
      continue;
    }
    if (/^(?:\d+[.)]|Step\s+\d+:?|\d️⃣)\s*[A-Z]/u.test(line)) inSteps = true;
    if (inSteps) {
      stepLines.push(line.replace(/^(?:\d+[.)]|Step\s+\d+:?|\d️⃣)\s*/iu, '').trim());
      continue;
    }
    if (/^[A-Z][\w ]{0,24}:$/.test(line) || /^(?:Main|Sauce|For the Orzo)$/i.test(line)) {
      group = line.replace(/:$/, '').trim();
      inIngredients = true;
      continue;
    }
    if (INGREDIENT.test(line) || inIngredients || sawIngredient) {
      if (INGREDIENT.test(line) || sawIngredient || /^[-*•]?\s*\d/.test(line)) {
        ingredientLines.push(line);
        sawIngredient = true;
        if (group) groups.set(line.toLowerCase(), group);
      } else {
        notes.push(line);
      }
    } else if (line.length > 20) {
      notes.push(line);
    }
  }
  const numberWords: Record<string, string> = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12' };
  const ingredients = ingredientLines.map((line, position) => {
    const normalized = line.replace(/^(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i, (word) => numberWords[word.toLowerCase()] ?? word).replace(/^½\b/, '0.5').replace(/^¼\b/, '0.25');
    return { ...parseIngredientLine(normalized, position), groupName: groups.get(line.toLowerCase()) ?? null };
  });
  for (const ingredient of ingredients) {
    const key = ingredient.name.toLowerCase();
    const matchingGroup = [...groups.entries()].find(([line]) => line.includes(key) || key.includes(line));
    if (matchingGroup) ingredient.groupName = matchingGroup[1];
    if (ingredient.groupName) groups.set(ingredient.name.toLowerCase(), ingredient.groupName);
  }
  const text = [title, ingredientLines.length ? 'Ingredients:' : '', ...ingredientLines, stepLines.length ? 'Instructions:' : '', ...stepLines].filter(Boolean).join('\n');
  return { title, text, notes: notes.join('\n'), groups, ingredients };
}
