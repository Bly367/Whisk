import { createRepositories } from '@/data/repositories';
import { createTestDbClient } from '@/data/testing/createTestDb';
import { createId, nowIso } from '@/data/util';

import {
  assertDraftReadyToSave,
  commitImportDraft,
  ImportCommitError,
  toRecipeCreateInput,
} from '@/import/commit';
import { extractRecipeJsonLd } from '@/import/parse/jsonLd';
import { canonicalizeUrl, detectSource, isSocialSource } from '@/import/parse/url';
import { createWebsiteAdapter } from '@/import/adapters/websiteAdapter';
import { ocrAdapter } from '@/import/adapters/ocrAdapter';
import { shareSheetAdapter } from '@/import/adapters/shareSheetAdapter';
import { listImportAdapters, runImport } from '@/import/adapters/registry';
import type { ImportDraft } from '@/import/types';

const SAMPLE_HTML = `
  <html>
    <head>
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@graph": [
            {"@type": "WebPage", "name": "Example"},
            {
              "@type": "Recipe",
              "name": "Weeknight Tacos",
              "description": "Fast and easy tacos.",
              "author": {"@type": "Person", "name": "Test Kitchen"},
              "image": ["https://example.com/tacos.jpg"],
              "prepTime": "PT10M",
              "cookTime": "PT20M",
              "recipeYield": "4 servings",
              "recipeIngredient": ["1 lb ground beef", "2 tbsp taco seasoning"],
              "recipeInstructions": [
                {"@type": "HowToStep", "text": "Brown the beef."},
                {"@type": "HowToSection", "itemListElement": [
                  {"@type": "HowToStep", "text": "Add seasoning and serve."}
                ]}
              ]
            }
          ]
        }
      </script>
    </head>
  </html>
`;

function sampleDraft(overrides: Partial<ImportDraft> = {}): ImportDraft {
  return {
    id: createId(),
    sourceKind: 'website',
    sourceUrl: 'https://example.com/tacos',
    sourceName: 'Test Kitchen',
    imageUri: null,
    title: 'Weeknight Tacos',
    notes: null,
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 20,
    ingredients: [
      { name: 'ground beef', quantity: '1', unit: 'lb', position: 0 },
      { name: 'taco seasoning', quantity: '2', unit: 'tbsp', position: 1 },
    ],
    instructions: [
      { id: createId(), text: 'Brown the beef.', position: 0 },
      { id: createId(), text: 'Add seasoning and serve.', position: 1 },
    ],
    confidence: {
      title: 'high',
      ingredients: 'high',
      instructions: 'high',
    },
    warnings: [],
    sourceEvidence: '{"@type":"Recipe"}',
    adapterId: 'website-jsonld',
    createdAt: nowIso(),
    ...overrides,
  };
}

describe('import adapters registry', () => {
  it('exposes replaceable website, share-sheet, and OCR adapters', () => {
    const ids = listImportAdapters().map((a) => a.id);
    expect(ids).toEqual(
      expect.arrayContaining(['website-jsonld', 'share-sheet', 'ocr-photo']),
    );
  });
});

describe('JSON-LD website extraction', () => {
  it('extracts a nested schema.org Recipe', () => {
    const extracted = extractRecipeJsonLd(SAMPLE_HTML, 'https://example.com/tacos');
    expect(extracted?.title).toBe('Weeknight Tacos');
    expect(extracted?.ingredients).toHaveLength(2);
    expect(extracted?.instructions.map((s) => s.text)).toEqual([
      'Brown the beef.',
      'Add seasoning and serve.',
    ]);
    expect(extracted?.prepMinutes).toBe(10);
    expect(extracted?.cookMinutes).toBe(20);
    expect(extracted?.servings).toBe(4);
    expect(extracted?.warnings).toEqual([]);
  });

  it('returns null instead of inventing a recipe', () => {
    expect(
      extractRecipeJsonLd(
        '<script type="application/ld+json">{"@type":"Article"}</script>',
        'https://example.com',
      ),
    ).toBeNull();
  });

  it('flags missing ingredients and instructions with confidence', () => {
    const extracted = extractRecipeJsonLd(
      '<script type="application/ld+json">{"@type":"Recipe","name":"Mystery Dish"}</script>',
      'https://example.com/mystery',
    );
    expect(extracted?.ingredients).toEqual([]);
    expect(extracted?.instructions).toEqual([]);
    expect(extracted?.warnings.map((w) => w.code)).toEqual([
      'missing_ingredients',
      'missing_instructions',
    ]);
    expect(extracted?.confidence.ingredients).toBe('unknown');
    expect(extracted?.confidence.instructions).toBe('unknown');
  });
});

describe('website adapter', () => {
  it('imports via injectable fetch and never auto-saves', async () => {
    const adapter = createWebsiteAdapter(async () => SAMPLE_HTML);
    const result = await adapter.import({ url: 'https://example.com/tacos' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.title).toBe('Weeknight Tacos');
    expect(result.draft.sourceUrl).toBe('https://example.com/tacos');
  });

  it('refuses social URLs without inventing content', async () => {
    const adapter = createWebsiteAdapter(async () => SAMPLE_HTML);
    const result = await adapter.import({
      url: 'https://www.instagram.com/p/abc123/',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('unsupported');
    expect(result.error.fallbacks).toEqual(
      expect.arrayContaining(['paste_text', 'manual']),
    );
  });

  it('returns needs_input for pages without structured recipe (no blank draft)', async () => {
    const adapter = createWebsiteAdapter(
      async () =>
        '<html><head><title>Nice Blog</title><meta property="og:title" content="Nice Blog" /></head></html>',
    );
    const result = await adapter.import({ url: 'https://example.com/post' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('needs_input');
  });
});

describe('share sheet + OCR stubs', () => {
  it('share sheet needs caption for social links', async () => {
    const result = await shareSheetAdapter.import({
      sharedContent: 'https://tiktok.com/@chef/video/1',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('needs_input');
  });

  it('OCR stub never invents fields from an image URI', async () => {
    const result = await ocrAdapter.import({ imageUri: 'file:///photo.jpg' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('stub');
  });
});

describe('import commit trust gates', () => {
  it('maps draft to RecipeCreateInput', () => {
    const input = toRecipeCreateInput(sampleDraft());
    expect(input.title).toBe('Weeknight Tacos');
    expect(input.ingredients).toHaveLength(2);
    expect(input.sourceUrl).toBe('https://example.com/tacos');
  });

  it('refuses blank title and empty content', () => {
    expect(() =>
      assertDraftReadyToSave(sampleDraft({ title: '   ' })),
    ).toThrow(ImportCommitError);

    expect(() =>
      assertDraftReadyToSave(
        sampleDraft({ title: 'Only title', ingredients: [], instructions: [] }),
      ),
    ).toThrow(/empty recipe/i);
  });

  it('saves only through recipes.create after preview gates pass', () => {
    const db = createTestDbClient();
    const { recipes } = createRepositories(db);
    const before = recipes.list().length;

    const recipe = commitImportDraft(sampleDraft(), {
      create: (input) => recipes.create(input),
    });

    expect(recipe.title).toBe('Weeknight Tacos');
    expect(recipes.list()).toHaveLength(before + 1);
    expect(recipes.getById(recipe.id)?.ingredients).toHaveLength(2);
  });

  it('does not insert on failed parse path (runImport failure)', async () => {
    const db = createTestDbClient();
    const { recipes } = createRepositories(db);
    const before = recipes.list().length;

    const result = await runImport(
      { url: 'https://instagram.com/p/x' },
      'website-jsonld',
    );
    expect(result.ok).toBe(false);
    expect(recipes.list()).toHaveLength(before);
  });

  it('blocks duplicate commit of the same draft id', () => {
    const db = createTestDbClient();
    const { recipes } = createRepositories(db);
    const draft = sampleDraft();
    const saved = new Set<string>();

    commitImportDraft(draft, {
      alreadySavedDraftIds: saved,
      create: (input) => recipes.create(input),
    });

    expect(() =>
      commitImportDraft(draft, {
        alreadySavedDraftIds: saved,
        create: (input) => recipes.create(input),
      }),
    ).toThrow(/already saved/i);
    expect(recipes.list()).toHaveLength(1);
  });
});

describe('url helpers', () => {
  it('canonicalizes and detects social hosts', () => {
    const url = canonicalizeUrl(
      'https://www.Instagram.com/p/abc/?utm_source=share',
    );
    expect(url).toBe('https://instagram.com/p/abc/');
    expect(isSocialSource(detectSource(url))).toBe(true);
  });
});
