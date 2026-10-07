import { requireOptionalNativeModule } from 'expo-modules-core';

import type { ParsedRecipe } from '@/import/parse/structured';

export type FoundationParseResult =
  | { ok: true; recipe: ParsedRecipe }
  | { ok: false; reason: 'unavailable' | 'unsupported' | 'parse_failed' | 'thrown' };

type WhiskRecipeParseNativeModule = {
  isFoundationModelsAvailable(): boolean;
  parseRecipeWithFoundationModels(sourceText: string): Promise<{
    title: string;
    ingredients: ParsedRecipe['ingredients'];
    steps: string[];
  }>;
};
export const FOUNDATION_MAX_INPUT_CHARS = 6000;
function trimFoundationInput(text: string) {
  if (text.length <= FOUNDATION_MAX_INPUT_CHARS) return text;
  const cut = text.slice(0, FOUNDATION_MAX_INPUT_CHARS);
  return cut.slice(0, Math.max(cut.lastIndexOf('\n'), cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'), 1));
}

function nativeModule(): WhiskRecipeParseNativeModule | null {
  return requireOptionalNativeModule<WhiskRecipeParseNativeModule>('WhiskRecipeParse');
}

export function isFoundationModelsAvailable(): boolean {
  try {
    const module = nativeModule();
    return Boolean(module?.isFoundationModelsAvailable());
  } catch {
    return false;
  }
}

export async function parseRecipeWithFoundationModels(sourceText: string): Promise<FoundationParseResult> {
  try {
    const module = nativeModule();
    if (!module || !module.isFoundationModelsAvailable()) return { ok: false, reason: 'unavailable' };
    const recipe = await module.parseRecipeWithFoundationModels(trimFoundationInput(sourceText));
    if (!recipe.title && !recipe.ingredients.length && !recipe.steps.length) return { ok: false, reason: 'parse_failed' };
    return { ok: true, recipe: { ...recipe, parser: 'foundation' } };
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'ERR_UNAVAILABLE') return { ok: false, reason: 'unavailable' };
    if (code === 'ERR_PARSE_FAILED') return { ok: false, reason: 'parse_failed' };
    return { ok: false, reason: 'thrown' };
  }
}
