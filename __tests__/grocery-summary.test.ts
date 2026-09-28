import {
  grocerySummaryPreviewLines,
  grocerySummaryReplaceMessage,
} from '@/components/plan/GrocerySummaryModal';
import type { GroceryGeneratePreview } from '@/features/shop/generateFromPlan';

const preview: GroceryGeneratePreview = {
  mealPlanId: 'plan-1',
  weekStart: '2026-10-26',
  listName: 'Week of Oct 26–Nov 1',
  recipeCount: 2,
  mergedCount: 0,
  rawLineCount: 2,
  drafts: [
    {
      name: 'onion',
      quantity: '3',
      unit: null,
      aisle: 'Produce',
      recipeId: 'chili',
      recipeTitle: 'Chili',
      mergeKey: 'onion|',
      sources: [],
      wasMerged: false,
    },
    {
      name: 'butter',
      quantity: '1/2',
      unit: 'cup',
      aisle: 'Dairy & Eggs',
      recipeId: 'pasta',
      recipeTitle: 'Pasta',
      mergeKey: 'butter|cup',
      sources: [],
      wasMerged: false,
    },
  ],
};

describe('grocery summary preview', () => {
  it('shows grocery ingredients rather than recipe-name rows', () => {
    expect(grocerySummaryPreviewLines(preview)).toEqual(['3 onion', '1/2 cup butter']);
  });

  it('explains replacement only when the week already has a grocery list', () => {
    expect(grocerySummaryReplaceMessage(preview, true)).toContain("replaces this week's list");
    expect(grocerySummaryReplaceMessage(preview, true)).toContain('2 recipes');
    expect(grocerySummaryReplaceMessage(preview, false)).toBe('Create list with 2 items.');
  });
});
