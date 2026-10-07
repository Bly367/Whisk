import {
  scoreDraft,
  AUTO_SAVE_MIN_INGREDIENTS,
  AUTO_SAVE_MIN_STEPS,
  PASS_MIN_INGREDIENTS,
  PASS_MIN_STEPS,
} from '@/import/score';
import type { ImportDraft } from '@/import/types';

const draft = (ingredients: number, steps: number, title = 'Pasta'): ImportDraft => ({
  id: 'draft',
  sourceKind: 'share_sheet',
  sourceUrl: null,
  sourceName: 'TikTok',
  imageUri: null,
  title,
  notes: null,
  servings: null,
  prepMinutes: null,
  cookMinutes: null,
  ingredients: Array.from({ length: ingredients }, (_, i) => ({
    id: `i${i}`,
    name: `ingredient ${i}`,
    quantity: null,
    unit: null,
    preparation: null,
    position: i,
  })),
  instructions: Array.from({ length: steps }, (_, i) => ({
    id: `s${i}`,
    text: `Step ${i}`,
    position: i,
  })),
  confidence: {},
  warnings: [],
  sourceEvidence: null,
  adapterId: 'test',
  createdAt: new Date().toISOString(),
});

it('exports and applies the pass and auto-save thresholds', () => {
  expect([
    PASS_MIN_INGREDIENTS,
    PASS_MIN_STEPS,
    AUTO_SAVE_MIN_INGREDIENTS,
    AUTO_SAVE_MIN_STEPS,
  ]).toEqual([3, 2, 2, 1]);
  expect(scoreDraft(draft(3, 2)).passes).toBe(true);
  expect(scoreDraft(draft(2, 1)).saveable).toBe(true);
  expect(scoreDraft(draft(1, 1)).saveable).toBe(false);
});
