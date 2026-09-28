import { createId, nowIso } from '@/data/util';
import type { ImportDraft } from '@/import/types';
import { parseIngredientLine } from '@/import/parse/ingredients';

const IMPERATIVE = /^(?:add|bake|boil|bring|chop|combine|cook|crack|dice|drizzle|finish|flip|fold|heat|make|melt|mix(?:\s+in)?|pat|place|pour(?:\s+in)?|preheat|reduce|season|serve|simmer|slice|stir(?:\s+in)?|toss|whisk(?:\s+in)?|blend|let|sear|chill|scoop|spoon|put|get|grab|throw|drain|cut|fry|air fry|roast|grill|sprinkle|top|garnish|transfer|cover|remove|brown|knead|roll|shape|marinate|adding|start)\b/i;
const FILLER = /^(hey guys|follow for more|comment recipe|comment RECIPE|like and subscribe)[!. ]*$/i;
const NUMBER_WORDS: Record<string, string> = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12' };
const NUMBER = '(?:\\d+(?:\\s+and\\s+\\d+\\/\\d+)?(?:\\.\\d+)?|\\d+\\/\\d+|a\\s+(?:quarter|half)|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|half|quarter)';
const UNIT = '(?:cups?|tbsp|tablespoons?|tsp|teaspoons?|ounces?|oz|pounds?|lbs?|grams?|g|kg|ml|l|cloves?|pinch(?:es)?|cans?|handful|breasts?|sticks?|bunch(?:es)?|sprigs?|slices?|fillets?)';
const HEAD_JUNK = /^(?:minutes?|seconds?|degrees?|pan|skillet|bowl|sheet|tray|lid|oven|spoon)\b/i;
const VERB_OR_PRONOUN = /^(?:i|i'm|we|we're|you|you're|your|it|this|that|start|sizzle|make|making|adding|going|go|is|are)\b/i;
const LIST_CONTEXT = /\b(?:you(?:'ll| will) need|for the sauce|mix together|in goes|adding|crack in|glug of|finish it with|sprinkle with|serve it with)\b/i;

function normalizeQuantity(value: string): string {
  const compact = value.toLowerCase().replace(/\s+/g, ' ').trim();
  if (compact === 'a quarter' || compact === 'quarter') return '0.25';
  if (compact === 'a half' || compact === 'half') return '0.5';
  if (compact === 'a' || compact === 'an') return '1';
  const mixed = compact.match(/^(\d+)\s+and\s+(\d+)\/(\d+)$/);
  if (mixed) return String(Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]));
  return NUMBER_WORDS[compact] ?? compact;
}

function cleanIngredientName(value: string): string {
  return value.replace(/^and\s+/i, '').replace(/^of\s+/i, '').replace(/^(?:(?:some|a few|fresh|grated|minced|diced|sliced|crumbled|little|big|red|a|an)\s+)+/i, '').replace(/^(?:a\s+)?(?:big\s+)?(?:glug|splash)\s+/i, '').replace(/^(?:a|an|one)\s+(?=can\b)/i, '').replace(/^can\s+/i, '').replace(/\s+(?:in|on|at|until|for|and let|and cook|and serve|then|maybe)\b.*$/i, '').replace(/[.!?]+$/, '').trim();
}

function isIngredientName(value: string): boolean {
  const name = cleanIngredientName(value);
  return Boolean(name) && !HEAD_JUNK.test(name) && !VERB_OR_PRONOUN.test(name);
}

function ingredientLines(sentence: string): string[] {
  const lines: string[] = [];
  const withUnit = new RegExp(`(${NUMBER})\\s+(${UNIT})(?:\\s+of)?\\s+([a-z][a-z' -]*?)(?=\\s*(?:,|\\band\\b|\\.|$))`, 'gi');
  for (const match of sentence.matchAll(withUnit)) lines.push(`${normalizeQuantity(match[1])} ${match[2]} ${match[3]}`);
  const bareQuantity = new RegExp(`(${NUMBER})\\s+([a-z][a-z' -]*?)(?=\\s*(?:,|\\band\\b|\\.|$))`, 'gi');
  for (const match of sentence.matchAll(bareQuantity)) {
    if (LIST_CONTEXT.test(sentence) && !new RegExp(`^(?:${UNIT})\\b|\\b(?:${UNIT})\\b`, 'i').test(match[2])) lines.push(`${normalizeQuantity(match[1])} ${match[2]}`);
  }
  const afterNameUnit = new RegExp(`(${NUMBER})\\s+([a-z]+(?:\\s+[a-z]+)?\\s+(?:fillets?|cloves?))`, 'gi');
  for (const match of sentence.matchAll(afterNameUnit)) lines.push(`${normalizeQuantity(match[1])} ${match[2]}`);
  if (LIST_CONTEXT.test(sentence)) {
    const listStart = sentence.search(LIST_CONTEXT);
    const tail = sentence.slice(Math.max(0, listStart)).replace(/^[^,]*?\b(?:need|sauce|together|goes|adding|glug of|with)\b\s*/i, '');
    for (const part of tail.split(/,|\band\b/i)) {
      const candidate = cleanIngredientName(part.replace(/^(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+/i, ''));
      if (isIngredientName(candidate) && !new RegExp(`^${NUMBER}`, 'i').test(candidate) && !new RegExp(`\\b(?:${UNIT}|start|go|your|quarter|half)\\b`, 'i').test(candidate)) lines.push(/^(?:a|an)\s+/i.test(part.trim()) ? `1 ${candidate}` : candidate);
    }
  }
  return lines;
}

function stripDiscourse(value: string): string {
  let result = value.trim();
  let previous = '';
  while (result !== previous) {
    previous = result;
    result = result.replace(/^(?:okay|alright|so|then|now|first|next|and then|finally)\s+/i, '').replace(/^(?:for the sauce|once[^,]*|while[^,]*),\s*/i, '').replace(/^(?:we're|we are|I'm|I am|you're|you are)\s+gonna\s+/i, '').replace(/^(?:go ahead and|I like to|make sure you)\s+/i, '').replace(/^and\s+(?=(?:add|bake|bring|crack|cook|drizzle|finish|flip|make|pat|pour|pop|reduce|serve|simmer|sprinkle|stir|whisk|air fry)\b)/i, '').trim();
  }
  return result;
}

function stepCandidates(sentence: string): string[] {
  return sentence.split(/,\s+(?=(?:and\s+)?(?:add|air fry|bring|crack|cook|drizzle|finish|flip|make|pat|pour|pop|reduce|serve|simmer|sprinkle|stir|whisk)\b)/i).flatMap((part) => part.split(/\s+and\s+(?=(?:crack|pour|stir|whisk|serve|sprinkle|finish|pop)\b)/i)).map(stripDiscourse).filter((part) => IMPERATIVE.test(part));
}

export function draftFromTranscript(options: { segments?: { text: string }[]; text: string; sharedText?: string; sourceUrl?: string | null; sourceName?: string | null }): ImportDraft | null {
  const text = [options.text, options.sharedText].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const sentences = ((options.segments?.map((s) => s.text).join(' ') ?? text).split(/(?<=[.!?])\s+/)).map((s) => s.trim()).filter((s) => s && !FILLER.test(s));
  if (!sentences.length) return null;
  const titleMatch = text.match(/(?:making|this is my|today we're making|best)\s+(?:my\s+)?([^.!?]+?)(?:\s+you'll ever make)?[.!?]/i);
  const title = titleMatch?.[1] ? titleMatch[1].trim().replace(/^\w/, (c) => c.toUpperCase()) : options.sourceName ? `Recipe from ${options.sourceName}` : 'Recipe from shared video';
  const quantityLines = sentences.flatMap(ingredientLines);
  const steps = sentences.flatMap(stepCandidates);
  const ingredients = quantityLines.map((line, position) => {
    const parsed = parseIngredientLine(line.replace(/\s+of\s+/i, ' '), position);
    return { ...parsed, name: cleanIngredientName(parsed.name).replace(/\s+clove$/i, '') };
  }).filter((x) => x.name.trim() && isIngredientName(x.name));
  if (!ingredients.length && !steps.length) return null;
  return { id: createId(), sourceKind: 'share_sheet', sourceUrl: options.sourceUrl ?? null, sourceName: options.sourceName ?? null, imageUri: null, title, notes: null, servings: null, prepMinutes: null, cookMinutes: null, ingredients, instructions: steps.map((text, position) => ({ id: createId(), text, position })), confidence: { title: titleMatch ? 'medium' : 'low', ingredients: ingredients.length ? 'medium' : 'unknown', instructions: steps.length ? 'medium' : 'unknown' }, warnings: [{ code: 'low_confidence', message: 'Automatically drafted from spoken text. Review before serving.' }], sourceEvidence: text.slice(0, 4000), adapterId: 'transcript', createdAt: nowIso() };
}
