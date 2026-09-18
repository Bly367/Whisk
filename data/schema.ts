/** Schema version and migration SQL for Whisk local SQLite. */

export const DATABASE_NAME = 'whisk.db';
/** Phase 2 data extensions (households, pantry, templates, leftovers, compat). */
export const SCHEMA_VERSION = 2;

/**
 * Initial schema (v1). Soft-delete via deleted_at; drafts via recipes.status.
 * Indexes support list screens without N+1 ingredient/tag lookups.
 */
export const MIGRATION_V1 = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  source_url TEXT,
  source_name TEXT,
  image_uri TEXT,
  servings REAL,
  prep_minutes INTEGER,
  cook_minutes INTEGER,
  rating REAL,
  instructions_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  is_favorite INTEGER NOT NULL DEFAULT 0,
  cooked_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  local_revision INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('synced_local', 'pending', 'needs_attention'))
);

CREATE INDEX IF NOT EXISTS idx_recipes_updated ON recipes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_title ON recipes(title COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_recipes_status_deleted ON recipes(status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_recipes_cooked ON recipes(cooked_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_rating ON recipes(rating DESC);

CREATE TABLE IF NOT EXISTS ingredients (
  id TEXT PRIMARY KEY NOT NULL,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity TEXT,
  unit TEXT,
  note TEXT,
  aisle TEXT,
  group_name TEXT,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ingredients_recipe ON ingredients(recipe_id, position);
CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients(name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE,
  created_at TEXT NOT NULL,
  UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS recipe_tags (
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_tags_tag ON recipe_tags(tag_id);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual', 'smart')),
  rules_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS collection_recipes (
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, recipe_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_recipes_recipe ON collection_recipes(recipe_id);

CREATE TABLE IF NOT EXISTS meal_plans (
  id TEXT PRIMARY KEY NOT NULL,
  week_start TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('synced_local', 'pending', 'needs_attention'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meal_plans_week
  ON meal_plans(week_start) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS meal_plan_entries (
  id TEXT PRIMARY KEY NOT NULL,
  meal_plan_id TEXT NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  recipe_id TEXT REFERENCES recipes(id) ON DELETE SET NULL,
  plan_date TEXT NOT NULL,
  slot TEXT NOT NULL CHECK (slot IN ('breakfast', 'lunch', 'dinner', 'snack')),
  note TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meal_entries_plan_date
  ON meal_plan_entries(meal_plan_id, plan_date, slot, position);

CREATE TABLE IF NOT EXISTS grocery_lists (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  meal_plan_id TEXT REFERENCES meal_plans(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('synced_local', 'pending', 'needs_attention'))
);

CREATE TABLE IF NOT EXISTS grocery_items (
  id TEXT PRIMARY KEY NOT NULL,
  list_id TEXT NOT NULL REFERENCES grocery_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity TEXT,
  unit TEXT,
  aisle TEXT,
  is_completed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  recipe_id TEXT REFERENCES recipes(id) ON DELETE SET NULL,
  recipe_title TEXT,
  merge_key TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_grocery_items_list
  ON grocery_items(list_id, is_completed, position)
  WHERE deleted_at IS NULL;
`;

/**
 * Phase 2 schema (v2). Idempotent CREATE IF NOT EXISTS + tenant columns on
 * existing domain tables. Applied after v1 for empty DBs and MVP upgrades.
 */
export const MIGRATION_V2 = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  owner_user_id TEXT,
  invite_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  local_revision INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('synced_local', 'pending', 'needs_attention')),
  remote_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_households_updated ON households(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_households_owner ON households(owner_user_id);

CREATE TABLE IF NOT EXISTS household_members (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id TEXT,
  display_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member', 'viewer')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invited', 'removed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_household_members_household
  ON household_members(household_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_household_members_user
  ON household_members(household_id, user_id)
  WHERE user_id IS NOT NULL AND status != 'removed';

CREATE TABLE IF NOT EXISTS pantry_items (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT REFERENCES households(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  quantity TEXT,
  unit TEXT,
  aisle TEXT,
  notes TEXT,
  expires_at TEXT,
  depleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  local_revision INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('synced_local', 'pending', 'needs_attention')),
  remote_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_pantry_items_household
  ON pantry_items(household_id, name COLLATE NOCASE)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pantry_items_name
  ON pantry_items(name COLLATE NOCASE)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS meal_plan_templates (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT REFERENCES households(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  source_meal_plan_id TEXT REFERENCES meal_plans(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  local_revision INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('synced_local', 'pending', 'needs_attention')),
  remote_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_meal_plan_templates_household
  ON meal_plan_templates(household_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS meal_plan_template_entries (
  id TEXT PRIMARY KEY NOT NULL,
  template_id TEXT NOT NULL REFERENCES meal_plan_templates(id) ON DELETE CASCADE,
  recipe_id TEXT REFERENCES recipes(id) ON DELETE SET NULL,
  day_offset INTEGER NOT NULL,
  slot TEXT NOT NULL CHECK (slot IN ('breakfast', 'lunch', 'dinner', 'snack')),
  note TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_template_entries_template
  ON meal_plan_template_entries(template_id, day_offset, slot, position);

CREATE TABLE IF NOT EXISTS leftovers_links (
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT REFERENCES households(id) ON DELETE SET NULL,
  source_recipe_id TEXT REFERENCES recipes(id) ON DELETE SET NULL,
  source_meal_plan_entry_id TEXT REFERENCES meal_plan_entries(id) ON DELETE SET NULL,
  leftover_recipe_id TEXT REFERENCES recipes(id) ON DELETE SET NULL,
  target_meal_plan_entry_id TEXT REFERENCES meal_plan_entries(id) ON DELETE SET NULL,
  label TEXT,
  servings_remaining REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  local_revision INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('synced_local', 'pending', 'needs_attention')),
  remote_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_leftovers_source_recipe
  ON leftovers_links(source_recipe_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leftovers_household
  ON leftovers_links(household_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS compat_import_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('paprika', 'json', 'markdown', 'generic')),
  status TEXT NOT NULL DEFAULT 'preview'
    CHECK (status IN ('preview', 'committed', 'cancelled', 'failed')),
  source_label TEXT,
  preview_json TEXT NOT NULL DEFAULT '{}',
  confidence REAL,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  committed_at TEXT,
  local_revision INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_compat_import_jobs_status
  ON compat_import_jobs(status, created_at DESC);

CREATE TABLE IF NOT EXISTS compat_export_packs (
  id TEXT PRIMARY KEY NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('paprika', 'json', 'markdown', 'generic')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'failed')),
  payload_json TEXT,
  recipe_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  local_revision INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_compat_export_packs_created
  ON compat_export_packs(created_at DESC);
`;

/** Columns added to MVP tables for tenant/sync readiness (applied in migrate). */
export const MIGRATION_V2_TENANT_COLUMNS: {
  table: string;
  column: string;
  definition: string;
}[] = [
  { table: 'recipes', column: 'household_id', definition: 'TEXT' },
  { table: 'recipes', column: 'remote_id', definition: 'TEXT' },
  { table: 'meal_plans', column: 'household_id', definition: 'TEXT' },
  { table: 'meal_plans', column: 'remote_id', definition: 'TEXT' },
  { table: 'grocery_lists', column: 'household_id', definition: 'TEXT' },
  { table: 'grocery_lists', column: 'remote_id', definition: 'TEXT' },
];
