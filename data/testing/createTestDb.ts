import BetterSqlite3 from 'better-sqlite3';

import type { DbClient, SqlValue } from '@/data/client';
import { migrate } from '@/data/database';

/** Node/Jest SQLite client that runs the same schema SQL as the app. */
export function createTestDbClient(): DbClient {
  const sqlite = new BetterSqlite3(':memory:');
  sqlite.pragma('foreign_keys = ON');

  const client: DbClient = {
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
      const trx = sqlite.transaction(fn);
      return trx();
    },
  };

  migrate(client);
  return client;
}
