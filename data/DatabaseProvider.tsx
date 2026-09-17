import type { ReactNode } from 'react';
import { SQLiteProvider } from 'expo-sqlite';

import { migrateDbIfNeeded } from '@/data/database';
import { DATABASE_NAME } from '@/data/schema';

type Props = {
  children: ReactNode;
};

/**
 * Opens Whisk SQLite, runs migrations, and provides the DB to the tree.
 */
export function DatabaseProvider({ children }: Props) {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded}>
      {children}
    </SQLiteProvider>
  );
}
