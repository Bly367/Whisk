import { createId, nowIso } from '@/data/util';
import type { ImportDraft } from '@/import/types';
import { parseIngredientLine } from '@/import/parse/ingredients';

const IMPERATIVE =
  /^(add|bake|boil|bring|chop|combine|cook|dice|fold|heat|melt|mix|place|pour|preheat|season|serve|simmer|slice|stir|toss|whisk|blend|let)\b/i;
const FILLER =
  /^(hey guys|follow for more|comment recipe|comment RECIPE|like and subscribe)[!. ]*$/i;
const NUM = '(?:\\d+(?:[./]\\d+)?|a|an|one|two|three|four|five|half|quarter|a quarter)';
const UNIT =
  '(?:cups?|tbsp|tablespoons?|tsp|teaspoons?|grams?|ounces?|oz|pounds?|lb|cloves?|pinch|cans?)';
const NUMBER_WORDS: Record<string, string> = {
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
};

export function draftFromTranscript(options: {
  segments?: { text: string }[];
  text: string;
  sharedText?: string;
  sourceUrl?: string | null;
  sourceName?: string | null;
}): ImportDraft | null {
  const text = [options.text, options.sharedText]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const sentences = (options.segments?.map((s) => s.text) ?? text.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter((s) => s && !FILLER.test(s));
  if (!sentences.length) return null;
  const titleMatch = text.match(/(?:making|this is my)\s+(?:my\s+)?([^.!?]+)/i);
  const title = titleMatch?.[1]
    ? titleMatch[1].trim().replace(/^\w/, (c) => c.toUpperCase())
    : options.sourceName
      ? `Recipe from ${options.sourceName}`
      : 'Recipe from shared video';
  const quantityLines: string[] = [];
  const steps: string[] = [];
  for (const sentence of sentences) {
    if (IMPERATIVE.test(sentence)) steps.push(sentence);
    const matches = sentence.match(new RegExp(`${NUM}\\s+${UNIT}\\s+[a-z][^,.;]+`, 'gi'));
    if (matches) quantityLines.push(...matches);
  }
  const ingredients = quantityLines
    .flatMap((line) => line.split(/,\s+|\s+and\s+/i))
    .map((line, i) => {
      let normalized = line.replace(/^a quarter\s+/i, '0.25 ').replace(/^a half\s+/i, '0.5 ');
      normalized = normalized.replace(
        /^(one|two|three|four|five)\b/i,
        (word) => NUMBER_WORDS[word.toLowerCase()] ?? word,
      );
      normalized = normalized
        .replace(/\bgrams?\b/gi, 'g')
        .replace(/\btablespoons?\b/gi, 'tbsp')
        .replace(/\bteaspoons?\b/gi, 'tsp');
      return parseIngredientLine(normalized, i);
    })
    .filter((x) => x.name.trim());
  if (!ingredients.length && !steps.length) return null;
  return {
    id: createId(),
    sourceKind: 'share_sheet',
    sourceUrl: options.sourceUrl ?? null,
    sourceName: options.sourceName ?? null,
    imageUri: null,
    title,
    notes: null,
    servings: null,
    prepMinutes: null,
    cookMinutes: null,
    ingredients,
    instructions: steps.map((text, position) => ({ id: createId(), text, position })),
    confidence: {
      title: titleMatch ? 'medium' : 'low',
      ingredients: ingredients.length ? 'medium' : 'unknown',
      instructions: steps.length ? 'medium' : 'unknown',
    },
    warnings: [
      {
        code: 'low_confidence',
        message: 'Automatically drafted from spoken text. Review before serving.',
      },
    ],
    sourceEvidence: text.slice(0, 4000),
    adapterId: 'transcript',
    createdAt: nowIso(),
  };
}
