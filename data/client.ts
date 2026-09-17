/**
 * Thin SQL executor interface so repositories stay testable
 * (expo-sqlite in app, better-sqlite3 in Jest).
 */

export type SqlValue = string | number | null | Uint8Array;

export type RunResult = {
  changes: number;
  lastInsertRowId: number;
};

export type DbClient = {
  exec(sql: string): void;
  run(sql: string, params?: SqlValue[]): RunResult;
  get<T>(sql: string, params?: SqlValue[]): T | null;
  all<T>(sql: string, params?: SqlValue[]): T[];
  withTransaction<T>(fn: () => T): T;
};

export function createExpoDbClient(db: import('expo-sqlite').SQLiteDatabase): DbClient {
  return {
    exec(sql: string) {
      db.execSync(sql);
    },
    run(sql: string, params: SqlValue[] = []) {
      const result = db.runSync(sql, params);
      return {
        changes: result.changes,
        lastInsertRowId: Number(result.lastInsertRowId),
      };
    },
    get<T>(sql: string, params: SqlValue[] = []) {
      return (db.getFirstSync(sql, params) as T | null) ?? null;
    },
    all<T>(sql: string, params: SqlValue[] = []) {
      return db.getAllSync(sql, params) as T[];
    },
    withTransaction<T>(fn: () => T) {
      let outcome: T;
      db.withTransactionSync(() => {
        outcome = fn();
      });
      return outcome!;
    },
  };
}
