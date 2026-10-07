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
    const recipe = await module.parseRecipeWithFoundationModels(sourceText);
    if (!recipe.title && !recipe.ingredients.length && !recipe.steps.length) return { ok: false, reason: 'parse_failed' };
    return { ok: true, recipe: { ...recipe, parser: 'foundation' } };
  } catch {
    return { ok: false, reason: 'thrown' };
  }
}
