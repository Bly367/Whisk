/**
 * P2-W6 — Compatibility import/export (test-first).
 *
 * Acceptance covered:
 * - Paprika + common-format (JSON/Markdown) packs behind replaceable adapters
 * - Import preview + confidence before commit (MVP import rules)
 * - Export round-trip documented; no silent clobber of user edits
 * - Fixtures: ≥1 Paprika-class + ≥1 generic JSON/Markdown pack
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { createRepositories } from '@/data/repositories';
import { createTestDbClient } from '@/data/testing/createTestDb';
import { useSyncStatusStore } from '@/data/sync/statusStore';

const FIXTURES = path.join(__dirname, 'fixtures', 'compat');

function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8');
}

describe('P2-W6 compat adapter registry', () => {
  it('exposes replaceable paprika, json, and markdown adapters', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const compat = require('@/import/compat') as typeof import('@/import/compat');
    const ids = compat.listCompatAdapters().map((a) => a.id);
    expect(ids).toEqual(
      expect.arrayContaining(['compat-paprika', 'compat-json', 'compat-markdown']),
    );
  });
});

describe('P2-W6 Paprika-class fixture import', () => {
  beforeEach(() => {
    useSyncStatusStore.getState().resetToLocalOk();
  });

  it('parses a Paprika recipe JSON fixture into a preview with confidence (no recipe write)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const compat = require('@/import/compat') as typeof import('@/import/compat');
    const raw = readFixture('paprika-weeknight-tacos.json');
    const db = createTestDbClient();
    const repos = createRepositories(db);

    const result = await compat.previewCompatImport({
      format: 'paprika',
      sourceLabel: 'paprika-weeknight-tacos.json',
      payload: raw,
      compatRepo: repos.compat,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.job.status).toBe('preview');
    expect(result.job.format).toBe('paprika');
    expect(result.job.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0]?.title).toBe('Weeknight Tacos');
    expect(result.drafts[0]?.ingredients.length).toBeGreaterThanOrEqual(3);
    expect(result.drafts[0]?.instructions.length).toBeGreaterThanOrEqual(2);
    expect(result.drafts[0]?.confidence.title).toBe('high');
    expect(repos.recipes.list()).toHaveLength(0);
  });
});

describe('P2-W6 generic JSON / Markdown pack import', () => {
  beforeEach(() => {
    useSyncStatusStore.getState().resetToLocalOk();
  });

  it('parses a generic JSON pack fixture into preview drafts with confidence', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const compat = require('@/import/compat') as typeof import('@/import/compat');
    const raw = readFixture('generic-pack.json');
    const db = createTestDbClient();
    const repos = createRepositories(db);

    const result = await compat.previewCompatImport({
      format: 'json',
      sourceLabel: 'generic-pack.json',
      payload: raw,
      compatRepo: repos.compat,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.job.status).toBe('preview');
    expect(result.drafts[0]?.title).toBe('Lemon Pasta');
    expect(result.drafts[0]?.ingredients.map((i) => i.name)).toEqual(
      expect.arrayContaining(['spaghetti', 'lemon', 'olive oil']),
    );
    expect(repos.recipes.list()).toHaveLength(0);
  });

  it('parses a Markdown pack fixture into a preview draft', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const compat = require('@/import/compat') as typeof import('@/import/compat');
    const raw = readFixture('generic-pack.md');
    const db = createTestDbClient();
    const repos = createRepositories(db);

    const result = await compat.previewCompatImport({
      format: 'markdown',
      sourceLabel: 'generic-pack.md',
      payload: raw,
      compatRepo: repos.compat,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.drafts[0]?.title).toBe('Lemon Pasta');
    expect(result.drafts[0]?.instructions.length).toBeGreaterThanOrEqual(2);
    expect(result.job.confidence).not.toBeNull();
    expect(repos.recipes.list()).toHaveLength(0);
  });
});

describe('P2-W6 import commit + no silent clobber', () => {
  beforeEach(() => {
    useSyncStatusStore.getState().resetToLocalOk();
  });

  it('commits preview only after explicit confirm', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const compat = require('@/import/compat') as typeof import('@/import/compat');
    const raw = readFixture('paprika-weeknight-tacos.json');
    const db = createTestDbClient();
    const repos = createRepositories(db);

    const preview = await compat.previewCompatImport({
      format: 'paprika',
      sourceLabel: 'paprika-weeknight-tacos.json',
      payload: raw,
      compatRepo: repos.compat,
    });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(repos.recipes.list()).toHaveLength(0);

    const committed = compat.commitCompatImport({
      jobId: preview.job.id,
      drafts: preview.drafts,
      recipesRepo: repos.recipes,
      compatRepo: repos.compat,
    });

    expect(committed.recipes).toHaveLength(1);
    expect(committed.recipes[0]?.title).toBe('Weeknight Tacos');
    expect(repos.compat.getImportJob(preview.job.id)?.status).toBe('committed');
    expect(repos.recipes.list()).toHaveLength(1);
  });

  it('refuses to silently overwrite a user-edited recipe on re-import', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const compat = require('@/import/compat') as typeof import('@/import/compat');
    const raw = readFixture('paprika-weeknight-tacos.json');
    const db = createTestDbClient();
    const repos = createRepositories(db);

    const first = await compat.previewCompatImport({
      format: 'paprika',
      sourceLabel: 'paprika-weeknight-tacos.json',
      payload: raw,
      compatRepo: repos.compat,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const saved = compat.commitCompatImport({
      jobId: first.job.id,
      drafts: first.drafts,
      recipesRepo: repos.recipes,
      compatRepo: repos.compat,
    });
    const recipeId = saved.recipes[0]!.id;

    // User edits the imported recipe.
    repos.recipes.update(recipeId, {
      title: 'My Weeknight Tacos',
      notes: 'Family edit — keep this',
    });
    expect(repos.recipes.getById(recipeId)?.title).toBe('My Weeknight Tacos');

    const second = await compat.previewCompatImport({
      format: 'paprika',
      sourceLabel: 'paprika-weeknight-tacos.json',
      payload: raw,
      compatRepo: repos.compat,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    // Default commit must not clobber user edits.
    const result = compat.commitCompatImport({
      jobId: second.job.id,
      drafts: second.drafts,
      recipesRepo: repos.recipes,
      compatRepo: repos.compat,
      matchExistingBy: 'externalUid',
    });

    expect(result.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: 'user_edited',
          existingRecipeId: recipeId,
        }),
      ]),
    );
    expect(result.recipes).toHaveLength(0);
    expect(repos.recipes.getById(recipeId)?.title).toBe('My Weeknight Tacos');
    expect(repos.recipes.getById(recipeId)?.notes).toBe('Family edit — keep this');
  });

  it('allows explicit overwrite only when conflictPolicy is overwrite', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const compat = require('@/import/compat') as typeof import('@/import/compat');
    const raw = readFixture('paprika-weeknight-tacos.json');
    const db = createTestDbClient();
    const repos = createRepositories(db);

    const first = await compat.previewCompatImport({
      format: 'paprika',
      payload: raw,
      compatRepo: repos.compat,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const saved = compat.commitCompatImport({
      jobId: first.job.id,
      drafts: first.drafts,
      recipesRepo: repos.recipes,
      compatRepo: repos.compat,
    });
    const recipeId = saved.recipes[0]!.id;
    repos.recipes.update(recipeId, { title: 'Edited' });

    const second = await compat.previewCompatImport({
      format: 'paprika',
      payload: raw,
      compatRepo: repos.compat,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    const overwritten = compat.commitCompatImport({
      jobId: second.job.id,
      drafts: second.drafts,
      recipesRepo: repos.recipes,
      compatRepo: repos.compat,
      matchExistingBy: 'externalUid',
      conflictPolicy: 'overwrite',
    });

    expect(overwritten.recipes).toHaveLength(1);
    expect(overwritten.recipes[0]?.id).toBe(recipeId);
    expect(repos.recipes.getById(recipeId)?.title).toBe('Weeknight Tacos');
  });
});

describe('P2-W6 export packs + round-trip', () => {
  beforeEach(() => {
    useSyncStatusStore.getState().resetToLocalOk();
  });

  it('exports paprika and json packs from local recipes', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const compat = require('@/import/compat') as typeof import('@/import/compat');
    const db = createTestDbClient();
    const repos = createRepositories(db);
    const recipe = repos.recipes.create({
      title: 'Soup',
      notes: 'Simple',
      servings: 4,
      prepMinutes: 10,
      cookMinutes: 30,
      ingredients: [
        { name: 'stock', quantity: '4', unit: 'cups', position: 0 },
        { name: 'onion', quantity: '1', unit: null, position: 1 },
      ],
      instructions: [
        { id: 's1', text: 'Simmer stock.', position: 0 },
        { id: 's2', text: 'Add onion.', position: 1 },
      ],
      sourceUrl: 'https://example.com/soup',
      sourceName: 'Home',
    });

    const paprikaPack = compat.buildCompatExportPack({
      format: 'paprika',
      recipeIds: [recipe.id],
      recipesRepo: repos.recipes,
      compatRepo: repos.compat,
    });
    expect(paprikaPack.status).toBe('ready');
    expect(paprikaPack.format).toBe('paprika');
    expect(paprikaPack.payload).toEqual(
      expect.objectContaining({
        recipes: expect.arrayContaining([
          expect.objectContaining({
            name: 'Soup',
            ingredients: expect.stringContaining('stock'),
            directions: expect.stringContaining('Simmer'),
          }),
        ]),
      }),
    );

    const jsonPack = compat.buildCompatExportPack({
      format: 'json',
      recipeIds: [recipe.id],
      recipesRepo: repos.recipes,
      compatRepo: repos.compat,
    });
    expect(jsonPack.format).toBe('json');
    expect(jsonPack.payload).toEqual(
      expect.objectContaining({
        format: 'whisk-compat-json',
        recipes: expect.arrayContaining([expect.objectContaining({ title: 'Soup' })]),
      }),
    );
  });

  it('round-trips paprika export → re-import preview without mutating library by default', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const compat = require('@/import/compat') as typeof import('@/import/compat');
    const db = createTestDbClient();
    const repos = createRepositories(db);
    const recipe = repos.recipes.create({
      title: 'Round Trip Chili',
      servings: 6,
      ingredients: [{ name: 'beans', quantity: '2', unit: 'cans', position: 0 }],
      instructions: [{ id: '1', text: 'Simmer.', position: 0 }],
      sourceUrl: 'https://example.com/chili',
    });

    const pack = compat.buildCompatExportPack({
      format: 'paprika',
      recipeIds: [recipe.id],
      recipesRepo: repos.recipes,
      compatRepo: repos.compat,
    });

    const serialized = JSON.stringify(pack.payload);
    const preview = await compat.previewCompatImport({
      format: 'paprika',
      sourceLabel: 'round-trip',
      payload: serialized,
      compatRepo: repos.compat,
    });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.drafts[0]?.title).toBe('Round Trip Chili');
    expect(preview.drafts[0]?.ingredients.some((i) => i.name.includes('beans'))).toBe(true);

    // Preview alone must not change existing library.
    expect(repos.recipes.list()).toHaveLength(1);
    expect(repos.recipes.getById(recipe.id)?.title).toBe('Round Trip Chili');

    // Default re-commit with match skips rather than clobbering.
    const commit = compat.commitCompatImport({
      jobId: preview.job.id,
      drafts: preview.drafts,
      recipesRepo: repos.recipes,
      compatRepo: repos.compat,
      matchExistingBy: 'sourceUrl',
    });
    expect(commit.skipped.length + commit.recipes.length).toBe(1);
    expect(repos.recipes.getById(recipe.id)?.title).toBe('Round Trip Chili');
  });

  it('documents export round-trip policy in docs/compat-io.md', () => {
    const doc = fs.readFileSync(path.join(__dirname, '..', 'docs', 'compat-io.md'), 'utf8');
    expect(doc).toMatch(/round-?trip/i);
    expect(doc).toMatch(/clobber|overwrite|conflict/i);
    expect(doc).toMatch(/preview/i);
    expect(doc).toMatch(/paprika/i);
    expect(doc).toMatch(/https:/i);
    expect(doc).toMatch(/file:|javascript:|scheme/i);
  });
});

describe('P2-W6 untrusted URL scheme allowlist (SECURITY.md §5)', () => {
  beforeEach(() => {
    useSyncStatusStore.getState().resetToLocalOk();
  });

  it('rejects file: and javascript: on Paprika source_url / image_url at parse and commit', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const compat = require('@/import/compat') as typeof import('@/import/compat');
    const db = createTestDbClient();
    const repos = createRepositories(db);

    const hostile = JSON.stringify({
      uid: 'HOSTILE-UID-001',
      name: 'Hostile Scheme Soup',
      ingredients: '1 cup stock',
      directions: 'Simmer.',
      source_url: 'javascript:alert(1)',
      image_url: 'file:///etc/passwd',
    });

    const preview = await compat.previewCompatImport({
      format: 'paprika',
      sourceLabel: 'hostile.paprika.json',
      payload: hostile,
      compatRepo: repos.compat,
    });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;

    expect(preview.drafts[0]?.sourceUrl).toBeNull();
    expect(preview.drafts[0]?.imageUri).toBeNull();
    expect(preview.drafts[0]?.sourceUrl).not.toMatch(/^javascript:/i);
    expect(preview.drafts[0]?.imageUri).not.toMatch(/^file:/i);

    const committed = compat.commitCompatImport({
      jobId: preview.job.id,
      drafts: preview.drafts,
      recipesRepo: repos.recipes,
      compatRepo: repos.compat,
    });
    expect(committed.recipes).toHaveLength(1);
    const row = repos.recipes.getById(committed.recipes[0]!.id);
    expect(row?.sourceUrl == null || !/^javascript:/i.test(row.sourceUrl)).toBe(true);
    expect(row?.sourceUrl == null || !/^file:/i.test(row.sourceUrl)).toBe(true);
    expect(row?.imageUri).toBeNull();
    // Hostile schemes must not be stored; whisk-compat uid marker is ok when no https source.
    if (row?.sourceUrl) {
      expect(row.sourceUrl.startsWith('whisk-compat://')).toBe(true);
    }
  });

  it('keeps https source/image URLs and still rejects unexpected schemes on JSON packs', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const compat = require('@/import/compat') as typeof import('@/import/compat');
    const db = createTestDbClient();
    const repos = createRepositories(db);

    const pack = JSON.stringify({
      format: 'whisk-compat-json',
      version: 1,
      recipes: [
        {
          title: 'Safe HTTPS Pasta',
          sourceUrl: 'https://example.com/pasta',
          imageUri: 'https://example.com/pasta.jpg',
          ingredients: [{ name: 'pasta', quantity: '1', unit: 'lb' }],
          instructions: [{ text: 'Boil.', position: 0 }],
        },
        {
          title: 'Data URI Trap',
          sourceUrl: 'data:text/html,<script>1</script>',
          imageUri: 'data:image/png;base64,aaa',
          ingredients: [{ name: 'salt' }],
          instructions: [{ text: 'Season.', position: 0 }],
        },
      ],
    });

    const preview = await compat.previewCompatImport({
      format: 'json',
      payload: pack,
      compatRepo: repos.compat,
    });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;

    const safe = preview.drafts.find((d) => d.title === 'Safe HTTPS Pasta');
    const trap = preview.drafts.find((d) => d.title === 'Data URI Trap');
    expect(safe?.sourceUrl).toBe('https://example.com/pasta');
    expect(safe?.imageUri).toBe('https://example.com/pasta.jpg');
    expect(trap?.sourceUrl).toBeNull();
    expect(trap?.imageUri).toBeNull();

    const committed = compat.commitCompatImport({
      jobId: preview.job.id,
      drafts: preview.drafts,
      recipesRepo: repos.recipes,
      compatRepo: repos.compat,
    });
    expect(committed.recipes).toHaveLength(2);
    const stored = committed.recipes.map((r) => repos.recipes.getById(r.id)!);
    const safeRow = stored.find((r) => r.title === 'Safe HTTPS Pasta');
    const trapRow = stored.find((r) => r.title === 'Data URI Trap');
    expect(safeRow?.sourceUrl).toContain('https://example.com/pasta');
    expect(safeRow?.imageUri).toBe('https://example.com/pasta.jpg');
    expect(trapRow?.sourceUrl).toBeNull();
    expect(trapRow?.imageUri).toBeNull();
  });
});
