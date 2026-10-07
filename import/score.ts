import type { ImportDraft } from '@/import/types';
export const PASS_MIN_INGREDIENTS = 3;
export const PASS_MIN_STEPS = 2;
export const AUTO_SAVE_MIN_INGREDIENTS = 2;
export const AUTO_SAVE_MIN_STEPS = 1;
export function scoreDraft(draft: ImportDraft) {
  const ingredients = draft.ingredients.filter((x) => x.name.trim()).length;
  const steps = draft.instructions.filter((x) => x.text.trim()).length;
  const hasTitle = Boolean(draft.title.trim());
  const score = ingredients * 2 + steps * 2 + (hasTitle ? 2 : 0);
  return {
    ingredients,
    steps,
    hasTitle,
    score,
    passes: hasTitle && ingredients >= PASS_MIN_INGREDIENTS && steps >= PASS_MIN_STEPS,
    saveable: hasTitle && ingredients >= AUTO_SAVE_MIN_INGREDIENTS && steps >= AUTO_SAVE_MIN_STEPS,
  };
}
