import {
  normalizeOcrText,
  mergeIngredientFragments,
  dedupeSteps,
} from '@/import/parse/normalize';
import { draftFromPastedText } from '@/import/parse/pasteText';

describe('normalizeOcrText', () => {
  it('fixes % to ½ when adjacent to measurements', () => {
    expect(normalizeOcrText('% teaspoon chili powder')).toBe('½ teaspoon chili powder');
    expect(normalizeOcrText('% cup sugar')).toBe('½ cup sugar');
    expect(normalizeOcrText('Add % tsp salt')).toBe('Add ½ tsp salt');
  });

  it('fixes /2 and similar patterns to ½', () => {
    expect(normalizeOcrText('1/2 cup flour')).toBe('½ cup flour');
    expect(normalizeOcrText('I/2 teaspoon')).toBe('½ teaspoon');
  });

  it('fixes I to 1 when followed by cup/tsp/tbsp', () => {
    expect(normalizeOcrText('I cup canned red beans')).toBe('1 cup canned red beans');
    expect(normalizeOcrText('I teaspoon salt')).toBe('1 teaspoon salt');
    expect(normalizeOcrText('I tbsp olive oil')).toBe('1 tbsp olive oil');
  });

  it('fixes lowercase l to 1 in quantity context', () => {
    expect(normalizeOcrText('l cup flour')).toBe('1 cup flour');
    expect(normalizeOcrText('l/2 cup')).toBe('½ cup');
  });

  it('fixes common typos: chii → chili', () => {
    expect(normalizeOcrText('% teaspoon chii powder')).toBe('½ teaspoon chili powder');
    expect(normalizeOcrText('Add chii flakes')).toBe('Add chili flakes');
  });

  it('does not change % in non-measurement context', () => {
    expect(normalizeOcrText('Increase by 50%')).toBe('Increase by 50%');
    expect(normalizeOcrText('Use 100% cocoa')).toBe('Use 100% cocoa');
  });

  it('does not change capital I at start of sentence', () => {
    expect(normalizeOcrText('I love this recipe')).toBe('I love this recipe');
  });

  it('fixes multiple issues in one string', () => {
    expect(normalizeOcrText('I cup flour, % tsp salt, chii powder')).toBe(
      '1 cup flour, ½ tsp salt, chili powder',
    );
  });
});

describe('mergeIngredientFragments', () => {
  it('merges standalone "minced" with previous garlic line', () => {
    const lines = ['2 cloves garlic,', 'minced'];
    expect(mergeIngredientFragments(lines)).toEqual(['2 cloves garlic, minced']);
  });

  it('merges "rinsed and drained" with previous canned item', () => {
    const lines = ['1 cup canned red beans,', 'rinsed and drained'];
    expect(mergeIngredientFragments(lines)).toEqual(['1 cup canned red beans, rinsed and drained']);
  });

  it('merges lowercase continuation line with previous ingredient', () => {
    const lines = ['2 tablespoons olive oil', 'divided'];
    expect(mergeIngredientFragments(lines)).toEqual(['2 tablespoons olive oil divided']);
  });

  it('does not merge lines that start with uppercase (new ingredients)', () => {
    const lines = ['2 cups flour', 'Salt to taste'];
    expect(mergeIngredientFragments(lines)).toEqual(['2 cups flour', 'Salt to taste']);
  });

  it('does not merge lines with quantity patterns (new ingredients)', () => {
    const lines = ['2 cups flour', '1 cup sugar'];
    expect(mergeIngredientFragments(lines)).toEqual(['2 cups flour', '1 cup sugar']);
  });

  it('merges multiple single-word continuations', () => {
    const lines = ['2 cups all-purpose flour,', 'sifted,', 'divided'];
    expect(mergeIngredientFragments(lines)).toEqual(['2 cups all-purpose flour, sifted, divided']);
  });

  it('handles empty lines', () => {
    const lines = ['2 cups flour', '', '1 cup sugar'];
    expect(mergeIngredientFragments(lines)).toEqual(['2 cups flour', '1 cup sugar']);
  });
});

describe('dedupeSteps', () => {
  it('filters out single-word orphan steps', () => {
    const steps = [
      'Cut slit in top of potato; squeeze sides to open.',
      'minced',
      'Spoon bean mixture into slit of potato.',
    ];
    expect(dedupeSteps(steps)).toEqual([
      'Cut slit in top of potato; squeeze sides to open.',
      'Spoon bean mixture into slit of potato.',
    ]);
  });

  it('keeps single words that are valid instructions', () => {
    const steps = ['Mix well.', 'Serve.', 'Enjoy!'];
    expect(dedupeSteps(steps)).toEqual(['Mix well.', 'Serve.', 'Enjoy!']);
  });

  it('filters out quantity-only fragments', () => {
    const steps = [
      'Brown the beef.',
      '% teaspoon chili powder',
      'Add seasoning and serve.',
    ];
    expect(dedupeSteps(steps)).toEqual(['Brown the beef.', 'Add seasoning and serve.']);
  });

  it('keeps steps that have imperative verbs', () => {
    const steps = ['Mix', 'Stir', 'Add sugar', 'Bake'];
    expect(dedupeSteps(steps)).toEqual(['Mix', 'Stir', 'Add sugar', 'Bake']);
  });

  it('filters prepositions and adjectives that leaked as steps', () => {
    const steps = ['Chop vegetables', 'with', 'Serve hot'];
    expect(dedupeSteps(steps)).toEqual(['Chop vegetables', 'Serve hot']);
  });

  it('handles empty array', () => {
    expect(dedupeSteps([])).toEqual([]);
  });
});

describe('integration: Chili Cheese Baked Potato OCR fix', () => {
  it('fixes fragmented OCR text from screenshot example', () => {
    // Simulates the problematic OCR text from the screenshot
    const ocrText = `Chili Cheese Baked Potato

Ingredients:
4 large baking potatoes
I cup canned red beans,
rinsed and drained
% teaspoon chili powder
% teaspoon kosher salt
2 cloves garlic,
minced

Instructions:
• Cut slit in top of potato; squeeze sides to open.
Spoon bean mixture into slit of potato. Sprinkle
with cheese and sour cream and enjoy.`;

    const draft = draftFromPastedText({
      text: ocrText,
      titleHint: null,
      sourceUrl: null,
      adapterId: 'test',
    });

    expect(draft).not.toBeNull();
    if (!draft) return;

    // Title should be extracted correctly
    expect(draft.title).toBe('Chili Cheese Baked Potato');

    // Ingredients should be merged and normalized
    expect(draft.ingredients.length).toBeGreaterThanOrEqual(4);
    
    // "I cup" should be fixed to "1 cup"
    const beansIngredient = draft.ingredients.find((ing) =>
      ing.name.toLowerCase().includes('beans'),
    );
    expect(beansIngredient).toBeDefined();
    expect(beansIngredient?.quantity).toBe('1');
    expect(beansIngredient?.name).toContain('rinsed and drained');

    // "% teaspoon" should be fixed to "½ teaspoon"
    const chiliIngredient = draft.ingredients.find((ing) =>
      ing.name.toLowerCase().includes('chili'),
    );
    expect(chiliIngredient).toBeDefined();
    expect(chiliIngredient?.quantity).toBe('½');

    // "2 cloves garlic, minced" should be one ingredient, not two
    const garlicIngredient = draft.ingredients.find((ing) =>
      ing.name.toLowerCase().includes('garlic'),
    );
    expect(garlicIngredient).toBeDefined();
    expect(garlicIngredient?.name).toContain('minced');

    // Instructions should not contain orphan words like "minced"
    const instructionTexts = draft.instructions.map((s) => s.text.toLowerCase());
    expect(instructionTexts).not.toContain('minced');
    expect(instructionTexts).not.toContain('rinsed and drained');
    
    // Should have valid multi-word instructions
    expect(draft.instructions.length).toBeGreaterThan(0);
    const firstStep = draft.instructions[0]?.text;
    expect(firstStep).toContain('Cut');
  });
});
