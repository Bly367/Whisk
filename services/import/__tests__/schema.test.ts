import { describe, expect, it } from 'vitest';
import { normalizeRecipeDraftResponse, parseRecipeDraftResponse } from '../schema';

describe('recipe draft response normalization', () => {
  it('accepts payloads with nulls, empty image urls, and empty ingredients', () => {
    const parsed = parseRecipeDraftResponse({
      title: 'Pasta Night',
      description: null,
      imageUrl: '',
      sourceAttribution: null,
      prepTime: null,
      cookTime: 20,
      servings: 0,
      ingredients: [
        { amount: '2', unit: 'cups', name: 'pasta' },
        { amount: '', unit: '', name: '' },
      ],
      steps: ['Boil water.', '', 'Cook pasta.'],
      tags: ['dinner', null, ''],
      evidence: [{ kind: 'page-text', value: 'some text', sourceUrl: '//cdn.example.com/a.jpg' }],
      warnings: [],
      confidence: { title: 'medium', nonsense: 'nope' },
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.description).toBeUndefined();
    expect(parsed.data.imageUrl).toBeUndefined();
    expect(parsed.data.servings).toBe(1);
    expect(parsed.data.ingredients).toHaveLength(1);
    expect(parsed.data.steps).toEqual(['Boil water.', 'Cook pasta.']);
    expect(parsed.data.evidence[0].sourceUrl).toBe('https://cdn.example.com/a.jpg');
  });

  it('keeps valid absolute image urls', () => {
    const normalized = normalizeRecipeDraftResponse({
      title: 'Soup',
      imageUrl: 'https://cdn.example.com/soup.jpg?w=800',
      servings: 2,
      ingredients: [],
      steps: [],
    }) as { imageUrl?: string };
    expect(normalized.imageUrl).toBe('https://cdn.example.com/soup.jpg?w=800');
  });
});
