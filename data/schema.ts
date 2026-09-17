/** Schema version and migration SQL for Whisk local SQLite. */

export const DATABASE_NAME = 'whisk.db';
export const SCHEMA_VERSION = 1;

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
