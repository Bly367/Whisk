/**
 * P2-W2 — Data extensions (test-first).
 *
 * Acceptance covered:
 * - Schema v2 migrations for households/membership, pantry, templates,
 *   leftovers links, and compat import/export models
 * - Migrations idempotent; empty DB and MVP→v2 upgrade paths
 * - Stable local ids + tenant fields ready for sync
 * - Repository contracts published for P2-W3–W6
 */
import BetterSqlite3 from 'better-sqlite3';

import type { DbClient, SqlValue } from '@/data/client';
import { migrate } from '@/data/database';
import { MIGRATION_V1, SCHEMA_VERSION } from '@/data/schema';
import { createRepositories } from '@/data/repositories';
import { createTestDbClient } from '@/data/testing/createTestDb';
import { useSyncStatusStore } from '@/data/sync/statusStore';

function wrapSqlite(sqlite: BetterSqlite3.Database): DbClient {
  return {
    exec(sql: string) {
      sqlite.exec(sql);
    },
    run(sql: string, params: SqlValue[] = []) {
      const info = sqlite.prepare(sql).run(...(params as SqlValue[]));
      return {
        changes: info.changes,
        lastInsertRowId: Number(info.lastInsertRowid),
      };
    },
    get<T>(sql: string, params: SqlValue[] = []) {
      return (sqlite.prepare(sql).get(...(params as SqlValue[])) as T | undefined) ?? null;
    },
    all<T>(sql: string, params: SqlValue[] = []) {
      return sqlite.prepare(sql).all(...(params as SqlValue[])) as T[];
    },
    withTransaction<T>(fn: () => T) {
      return sqlite.transaction(fn)();
    },
  };
}

/** MVP schema only (user_version = 1), no Phase 2 tables. */
function createMvpDbClient(): DbClient {
  const sqlite = new BetterSqlite3(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const client = wrapSqlite(sqlite);
  client.exec(MIGRATION_V1);
  client.exec('PRAGMA user_version = 1');
  return client;
}

describe('P2-W2 schema version + migrations', () => {
  it('publishes SCHEMA_VERSION 2 for Phase 2 data extensions', () => {
    expect(SCHEMA_VERSION).toBe(2);
  });

  it('migrates an empty database to SCHEMA_VERSION with Phase 2 tables', () => {
    const db = createTestDbClient();
    const version = db.get<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).toBe(2);

    for (const table of [
      'households',
      'household_members',
      'pantry_items',
      'meal_plan_templates',
      'meal_plan_template_entries',
      'leftovers_links',
      'compat_import_jobs',
      'compat_export_packs',
    ]) {
      const row = db.get<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
        [table],
      );
      expect(row?.name).toBe(table);
    }
  });

  it('upgrades an MVP (v1) database without destroying existing recipes', () => {
    const db = createMvpDbClient();
    db.run(
      `INSERT INTO recipes (
        id, title, instructions_json, status, is_favorite, created_at, updated_at,
        local_revision, sync_status
      ) VALUES (?, ?, '[]', 'published', 0, ?, ?, 1, 'synced_local')`,
      ['recipe-mvp', 'MVP Chili', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
    );

    migrate(db);

    const version = db.get<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).toBe(2);
    const recipe = db.get<{ title: string }>(`SELECT title FROM recipes WHERE id = ?`, [
      'recipe-mvp',
    ]);
    expect(recipe?.title).toBe('MVP Chili');
    const pantry = db.get<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'pantry_items'`,
    );
    expect(pantry?.name).toBe('pantry_items');
  });

  it('is idempotent: running migrate twice leaves schema at VERSION 2', () => {
    const db = createTestDbClient();
    migrate(db);
    migrate(db);
    const version = db.get<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).toBe(2);
  });

  it('adds tenant columns (household_id, remote_id) on sync-ready domain tables', () => {
    const db = createTestDbClient();
    for (const table of ['recipes', 'meal_plans', 'grocery_lists']) {
      const cols = db.all<{ name: string }>(`PRAGMA table_info(${table})`).map((c) => c.name);
      expect(cols).toContain('household_id');
      expect(cols).toContain('remote_id');
    }
  });
});

describe('P2-W2 household repository', () => {
  beforeEach(() => {
    useSyncStatusStore.getState().resetToLocalOk();
  });

  it('creates a household with stable local id and owner membership', () => {
    const db = createTestDbClient();
    const { households } = createRepositories(db);

    const household = households.create({
      name: 'Our Kitchen',
      ownerUserId: 'user-1',
      ownerDisplayName: 'Alex',
    });

    expect(household.id).toBeTruthy();
    expect(household.name).toBe('Our Kitchen');
    expect(household.ownerUserId).toBe('user-1');
    expect(household.localRevision).toBe(1);
    expect(household.syncStatus).toBe('synced_local');
    expect(household.remoteId).toBeNull();
    expect(household.members).toHaveLength(1);
    expect(household.members[0].role).toBe('owner');
    expect(household.members[0].userId).toBe('user-1');
    expect(useSyncStatusStore.getState().status).toBe('saved_locally');
  });

  it('adds members and lists by household without leaking other households', () => {
    const db = createTestDbClient();
    const { households } = createRepositories(db);

    const a = households.create({ name: 'A', ownerUserId: 'u-a', ownerDisplayName: 'A' });
    const b = households.create({ name: 'B', ownerUserId: 'u-b', ownerDisplayName: 'B' });

    households.addMember({
      householdId: a.id,
      userId: 'u-a2',
      displayName: 'Sam',
      role: 'member',
    });

    const loadedA = households.getById(a.id);
    expect(loadedA?.members.map((m) => m.userId).sort()).toEqual(['u-a', 'u-a2']);
    expect(households.getById(b.id)?.members).toHaveLength(1);
    expect(households.list().map((h) => h.id).sort()).toEqual([a.id, b.id].sort());
  });
});

describe('P2-W2 pantry repository', () => {
  beforeEach(() => {
    useSyncStatusStore.getState().resetToLocalOk();
  });

  it('creates, updates, consumes, and soft-deletes pantry items with tenant fields', () => {
    const db = createTestDbClient();
    const { households, pantry } = createRepositories(db);
    const household = households.create({ name: 'Home', ownerUserId: 'u1', ownerDisplayName: 'U' });

    const item = pantry.create({
      householdId: household.id,
      name: 'Eggs',
      quantity: '12',
      unit: 'count',
      aisle: 'Dairy',
    });

    expect(item.id).toBeTruthy();
    expect(item.householdId).toBe(household.id);
    expect(item.remoteId).toBeNull();
    expect(item.syncStatus).toBe('synced_local');

    const updated = pantry.update(item.id, { quantity: '6', notes: 'half used' });
    expect(updated.quantity).toBe('6');
    expect(updated.localRevision).toBe(2);

    const consumed = pantry.consume(item.id);
    expect(consumed.depletedAt).toBeTruthy();

    pantry.softDelete(item.id);
    expect(pantry.getById(item.id)).toBeNull();
    expect(pantry.list({ householdId: household.id })).toHaveLength(0);
  });

  it('scopes list queries by household_id', () => {
    const db = createTestDbClient();
    const { households, pantry } = createRepositories(db);
    const h1 = households.create({ name: 'H1', ownerUserId: 'a', ownerDisplayName: 'A' });
    const h2 = households.create({ name: 'H2', ownerUserId: 'b', ownerDisplayName: 'B' });

    pantry.create({ householdId: h1.id, name: 'Milk' });
    pantry.create({ householdId: h2.id, name: 'Butter' });

    expect(pantry.list({ householdId: h1.id }).map((i) => i.name)).toEqual(['Milk']);
    expect(pantry.list({ householdId: h2.id }).map((i) => i.name)).toEqual(['Butter']);
  });
});

describe('P2-W2 meal-plan templates repository', () => {
  beforeEach(() => {
    useSyncStatusStore.getState().resetToLocalOk();
  });

  it('saves a template from a meal plan with relative day offsets', () => {
    const db = createTestDbClient();
    const { recipes, mealPlans, templates, households } = createRepositories(db);
    const household = households.create({ name: 'Home', ownerUserId: 'u1', ownerDisplayName: 'U' });
    const recipe = recipes.create({ title: 'Tacos' });
    const plan = mealPlans.getOrCreateForWeek('2026-09-14');
    mealPlans.addEntry({
      mealPlanId: plan.id,
      recipeId: recipe.id,
      planDate: '2026-09-15',
      slot: 'dinner',
      note: 'Taco Tuesday',
    });

    const template = templates.createFromMealPlan({
      name: 'Weeknight rotation',
      householdId: household.id,
      mealPlanId: plan.id,
      weekStart: '2026-09-14',
    });

    expect(template.id).toBeTruthy();
    expect(template.householdId).toBe(household.id);
    expect(template.sourceMealPlanId).toBe(plan.id);
    expect(template.entries).toHaveLength(1);
    expect(template.entries[0].dayOffset).toBe(1);
    expect(template.entries[0].slot).toBe('dinner');
    expect(template.entries[0].recipeId).toBe(recipe.id);
    expect(template.remoteId).toBeNull();
  });

  it('lists templates and soft-deletes without removing source meal plan', () => {
    const db = createTestDbClient();
    const { mealPlans, templates } = createRepositories(db);
    const plan = mealPlans.getOrCreateForWeek('2026-09-21');
    const template = templates.createFromMealPlan({
      name: 'Empty week',
      mealPlanId: plan.id,
      weekStart: '2026-09-21',
    });

    templates.softDelete(template.id);
    expect(templates.getById(template.id)).toBeNull();
    expect(mealPlans.getById(plan.id)).not.toBeNull();
  });
});

describe('P2-W2 leftovers links repository', () => {
  beforeEach(() => {
    useSyncStatusStore.getState().resetToLocalOk();
  });

  it('links leftovers to a source recipe/entry without destroying the source', () => {
    const db = createTestDbClient();
    const { recipes, mealPlans, leftovers } = createRepositories(db);
    const recipe = recipes.create({ title: 'Roast Chicken' });
    const plan = mealPlans.getOrCreateForWeek('2026-09-14');
    const entry = mealPlans.addEntry({
      mealPlanId: plan.id,
      recipeId: recipe.id,
      planDate: '2026-09-14',
      slot: 'dinner',
    });

    const link = leftovers.create({
      sourceRecipeId: recipe.id,
      sourceMealPlanEntryId: entry.id,
      label: 'Chicken leftovers',
      servingsRemaining: 2,
    });

    expect(link.id).toBeTruthy();
    expect(link.sourceRecipeId).toBe(recipe.id);
    expect(link.sourceMealPlanEntryId).toBe(entry.id);
    expect(link.targetMealPlanEntryId).toBeNull();
    expect(recipes.getById(recipe.id)?.title).toBe('Roast Chicken');

    const target = mealPlans.addEntry({
      mealPlanId: plan.id,
      recipeId: recipe.id,
      planDate: '2026-09-16',
      slot: 'lunch',
      note: 'Leftovers',
    });
    const assigned = leftovers.assignToEntry(link.id, target.id);
    expect(assigned.targetMealPlanEntryId).toBe(target.id);
    expect(assigned.localRevision).toBe(2);
  });
});

describe('P2-W2 compat import/export models', () => {
  beforeEach(() => {
    useSyncStatusStore.getState().resetToLocalOk();
  });

  it('persists import job previews without committing recipes', () => {
    const db = createTestDbClient();
    const { recipes, compat } = createRepositories(db);

    const job = compat.createImportJob({
      format: 'paprika',
      sourceLabel: 'recipes.paprikarecipes',
      preview: { recipes: [{ title: 'Soup', confidence: 0.8 }] },
      confidence: 0.8,
    });

    expect(job.id).toBeTruthy();
    expect(job.format).toBe('paprika');
    expect(job.status).toBe('preview');
    expect(job.preview).toEqual({ recipes: [{ title: 'Soup', confidence: 0.8 }] });
    expect(recipes.list()).toHaveLength(0);

    const committed = compat.markImportCommitted(job.id);
    expect(committed.status).toBe('committed');
    expect(committed.committedAt).toBeTruthy();
  });

  it('creates export packs with format and recipe id list', () => {
    const db = createTestDbClient();
    const { recipes, compat } = createRepositories(db);
    const a = recipes.create({ title: 'A' });
    const b = recipes.create({ title: 'B' });

    const pack = compat.createExportPack({
      format: 'json',
      recipeIds: [a.id, b.id],
      payload: { version: 1, recipes: [{ id: a.id }, { id: b.id }] },
    });

    expect(pack.format).toBe('json');
    expect(pack.status).toBe('ready');
    expect(pack.recipeIds).toEqual([a.id, b.id]);
    expect(pack.payload).toEqual({
      version: 1,
      recipes: [{ id: a.id }, { id: b.id }],
    });
  });
});

describe('P2-W2 published contracts', () => {
  it('exports Phase 2 repository factories from @/data', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const data = require('@/data') as typeof import('@/data');
    expect(typeof data.createHouseholdRepository).toBe('function');
    expect(typeof data.createPantryRepository).toBe('function');
    expect(typeof data.createMealPlanTemplateRepository).toBe('function');
    expect(typeof data.createLeftoversRepository).toBe('function');
    expect(typeof data.createCompatRepository).toBe('function');
    expect(data.SCHEMA_VERSION).toBe(2);
    expect(typeof data.MIGRATION_V2).toBe('string');
  });
});
