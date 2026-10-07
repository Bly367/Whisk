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
};

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
  const grounded = recipe && groundParsedRecipe(recipe, sourceText);
  if (!grounded) return null;
  const titleHint = options.titleHint?.trim() || suitableTitleFromText(options.sharedText ?? '');
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
  const foundationResult = await foundation(text);
  if (foundationResult.ok) {
    const draft = toDraft(foundationResult.recipe, text, options);
    if (draft) return draft;
  }

  const apiKey = await (options.readApiKey ?? readOpenAIKey)();
  if (apiKey) {
    const openAI = options.openAI ?? parseRecipeWithOpenAI;
    const result = await openAI(text, { apiKey });
    if (result.ok) {
      const draft = toDraft(result.recipe, text, options);
      if (draft) return draft;
    }
  }

  const draft = toDraft(heuristicRecipe(text, options), text, options);
  if (draft && options.heuristicKind === 'social') {
    const cleaned = cleanSocialCaption(text, options.sourceName ?? 'shared post');
    draft.notes = cleaned.notes || null;
    draft.sourceEvidence = cleaned.text.slice(0, 4000);
  }
  return draft;
}
