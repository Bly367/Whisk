import { draftFromPastedText } from '@/import/parse/pasteText';
import { draftFromTranscript } from '@/import/parse/transcript';
import { cleanSocialCaption } from '@/import/social/cleanCaption';
import { parseRecipeWithFoundationModels } from '@/modules/whisk-recipe-parse';
import { readOpenAIKey } from '@/import/parse/openaiKey';
import { parseRecipeWithOpenAI, type OpenAIParseResult } from '@/import/parse/openaiParse';
import {
  groundParsedRecipe,
  parsedRecipeFromDraft,
  parsedRecipeToDraft,
  suitableTitleFromText,
  type ParsedRecipe,
} from '@/import/parse/structured';
import type { ImportDraft, ImportSourceKind } from '@/import/types';

export type ParseRecipeTextOptions = {
  sourceUrl?: string | null;
  sourceName?: string | null;
  sourceKind?: ImportSourceKind;
  adapterId?: string;
  titleHint?: string | null;
  sharedText?: string | null;
  segments?: { start: number; end: number; text: string }[];
  heuristicKind?: 'paste' | 'transcript' | 'social';
  foundation?: typeof parseRecipeWithFoundationModels;
  openAI?: (sourceText: string, options: { apiKey: string }) => Promise<OpenAIParseResult>;
  readApiKey?: typeof readOpenAIKey;
  heuristic?: (sourceText: string) => ParsedRecipe | null;
  foundationTimeoutMs?: number;
};

export const FOUNDATION_TIMEOUT_MS = 12_000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  // The native Foundation request cannot be cancelled; this only stops waiting for it.
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); })]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function heuristicRecipe(sourceText: string, options: ParseRecipeTextOptions): ParsedRecipe | null {
  if (options.heuristic) return options.heuristic(sourceText);
  if (options.heuristicKind === 'social') {
    const cleaned = cleanSocialCaption(sourceText, options.sourceName ?? 'shared post');
    return {
      title: cleaned.title,
      ingredients: cleaned.ingredients.map(({ quantity, unit, name, note }) => ({ quantity, unit, name, note })),
      steps: cleaned.steps.map((step) => step.text),
      parser: 'heuristic',
    };
  }
  const draft = options.heuristicKind === 'transcript'
    ? draftFromTranscript({
        text: sourceText,
        sharedText: options.sharedText ?? undefined,
        segments: options.segments,
        sourceUrl: options.sourceUrl,
        sourceName: options.sourceName,
      })
    : draftFromPastedText({
        text: sourceText,
        titleHint: options.titleHint,
        sourceUrl: options.sourceUrl,
        sourceName: options.sourceName,
        adapterId: 'heuristic',
      });
  return draft ? parsedRecipeFromDraft(draft) : null;
}

function toDraft(recipe: ParsedRecipe | null, sourceText: string, options: ParseRecipeTextOptions): ImportDraft | null {
  const groundingText = options.heuristicKind === 'transcript' && options.sharedText
    ? `${sourceText}\n${options.sharedText}` : sourceText;
  const grounded = recipe && groundParsedRecipe(recipe, groundingText);
  if (!grounded) return null;
  const sharedTitle = suitableTitleFromText(options.sharedText ?? '');
  const titleHint = options.titleHint?.trim() || sharedTitle;
  return parsedRecipeToDraft(grounded, {
    sourceText,
    titleHint,
    sourceUrl: options.sourceUrl,
    sourceName: options.sourceName,
    sourceKind: options.sourceKind,
    adapterId: options.adapterId,
  });
}

export async function parseRecipeText(
  sourceText: string,
  options: ParseRecipeTextOptions = {},
): Promise<ImportDraft | null> {
  const text = sourceText.trim();
  if (!text) return null;

  const foundation = options.foundation ?? parseRecipeWithFoundationModels;
  let fallbackSteps: ParsedRecipe | null = null;
  try {
    const foundationResult = await withTimeout(foundation(text), options.foundationTimeoutMs ?? FOUNDATION_TIMEOUT_MS);
    if (foundationResult?.ok) {
      const grounded = groundParsedRecipe(foundationResult.recipe, options.heuristicKind === 'transcript' && options.sharedText ? `${text}\n${options.sharedText}` : text);
      if (grounded?.ingredients.length) return toDraft(grounded, text, options);
      if (grounded) fallbackSteps = grounded;
    }
  } catch { /* fall through to the next parser */ }

  let apiKey: string | null = null;
  try { apiKey = await (options.readApiKey ?? readOpenAIKey)(); } catch { /* heuristic remains available */ }
  if (apiKey) {
    const openAI = options.openAI ?? parseRecipeWithOpenAI;
    try {
      const result = await openAI(text, { apiKey });
      if (result.ok) {
        const grounded = groundParsedRecipe(result.recipe, options.heuristicKind === 'transcript' && options.sharedText ? `${text}\n${options.sharedText}` : text);
        if (grounded?.ingredients.length) return toDraft(grounded, text, options);
        if (grounded) fallbackSteps = grounded;
      }
    } catch { /* heuristic remains available */ }
  }

  const draft = toDraft(heuristicRecipe(text, options), text, options);
  if (draft && options.heuristicKind === 'social') {
    const cleaned = cleanSocialCaption(text, options.sourceName ?? 'shared post');
    draft.notes = cleaned.notes || null;
    draft.sourceEvidence = cleaned.text.slice(0, 4000);
  }
  return draft ?? (fallbackSteps ? toDraft(fallbackSteps, text, options) : null);
}
