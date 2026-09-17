import { createExpoDbClient, type DbClient } from '@/data/client';
import { DATABASE_NAME, MIGRATION_V1, SCHEMA_VERSION } from '@/data/schema';

let cachedClient: DbClient | null = null;

export function migrate(db: DbClient): void {
  db.exec('PRAGMA foreign_keys = ON');
  const row = db.get<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  if (version >= SCHEMA_VERSION) {
    return;
  }

  db.withTransaction(() => {
    if (version === 0) {
      db.exec(MIGRATION_V1);
      version = 1;
    }
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });
}

/**
 * Open (or reuse) the app database and apply migrations.
 * Prefer the client cached by `migrateDbIfNeeded` (SQLiteProvider boot) so
 * repositories share one connection with the provider.
 */
export function getDatabase(): DbClient {
  if (cachedClient) {
    return cachedClient;
  }

  // Lazy require keeps Jest / Node tests free of native expo-sqlite.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SQLite = require('expo-sqlite') as typeof import('expo-sqlite');
  const native = SQLite.openDatabaseSync(DATABASE_NAME);
  const client = createExpoDbClient(native);
  migrate(client);
  cachedClient = client;
  return client;
}

/** Test / DI helper: set the active client (or clear with null). */
export function setDatabaseForTests(client: DbClient | null): void {
  cachedClient = client;
}

/**
 * SQLiteProvider `onInit`: migrate and cache this connection as the app write path.
 */
export async function migrateDbIfNeeded(db: import('expo-sqlite').SQLiteDatabase): Promise<void> {
  const client = createExpoDbClient(db);
  migrate(client);
  cachedClient = client;
}
