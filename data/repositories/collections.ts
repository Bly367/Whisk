import type { Collection, CollectionKind } from '@/data/contracts';
import type { DbClient } from '@/data/client';
import { mapCollection } from '@/data/mappers';
import { withLocalPersist } from '@/data/sync/statusStore';
import { createId, nowIso } from '@/data/util';

export function createCollectionRepository(db: DbClient) {
  return {
    create(input: {
      name: string;
      kind?: CollectionKind;
      rulesJson?: string | null;
      recipeIds?: string[];
    }): Collection {
      return withLocalPersist(() => {
        const id = createId();
        const now = nowIso();
        return db.withTransaction(() => {
          db.run(
            `INSERT INTO collections (id, name, kind, rules_json, created_at, updated_at, deleted_at)
             VALUES (?, ?, ?, ?, ?, ?, NULL)`,
            [id, input.name.trim(), input.kind ?? 'manual', input.rulesJson ?? null, now, now],
          );
          input.recipeIds?.forEach((recipeId, position) => {
            db.run(
              `INSERT OR IGNORE INTO collection_recipes (collection_id, recipe_id, position)
               VALUES (?, ?, ?)`,
              [id, recipeId, position],
            );
          });
          const row = db.get<Parameters<typeof mapCollection>[0]>(
            `SELECT * FROM collections WHERE id = ?`,
            [id],
          );
          if (!row) {
            throw new Error('Failed to create collection');
          }
          return mapCollection(row);
        });
      }, 'Could not save collection');
    },

    list(includeDeleted = false): Collection[] {
      const sql = includeDeleted
        ? `SELECT * FROM collections ORDER BY name COLLATE NOCASE ASC`
        : `SELECT * FROM collections WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE ASC`;
      return db.all<Parameters<typeof mapCollection>[0]>(sql).map(mapCollection);
    },

    getById(id: string): Collection | null {
      const row = db.get<Parameters<typeof mapCollection>[0]>(
        `SELECT * FROM collections WHERE id = ? AND deleted_at IS NULL`,
        [id],
      );
      return row ? mapCollection(row) : null;
    },

    listRecipeIds(collectionId: string): string[] {
      return db
        .all<{ recipe_id: string }>(
          `SELECT recipe_id FROM collection_recipes
           WHERE collection_id = ?
           ORDER BY position ASC`,
          [collectionId],
        )
        .map((r) => r.recipe_id);
    },

    addRecipe(collectionId: string, recipeId: string, position?: number): void {
      withLocalPersist(() => {
        const pos =
          position ??
          db.get<{ c: number }>(
            `SELECT COUNT(*) AS c FROM collection_recipes WHERE collection_id = ?`,
            [collectionId],
          )?.c ??
          0;
        db.run(
          `INSERT OR IGNORE INTO collection_recipes (collection_id, recipe_id, position)
           VALUES (?, ?, ?)`,
          [collectionId, recipeId, pos],
        );
        db.run(`UPDATE collections SET updated_at = ? WHERE id = ?`, [nowIso(), collectionId]);
      }, 'Could not add recipe to collection');
    },

    removeRecipe(collectionId: string, recipeId: string): void {
      withLocalPersist(() => {
        db.run(`DELETE FROM collection_recipes WHERE collection_id = ? AND recipe_id = ?`, [
          collectionId,
          recipeId,
        ]);
        db.run(`UPDATE collections SET updated_at = ? WHERE id = ?`, [nowIso(), collectionId]);
      }, 'Could not remove recipe from collection');
    },

    softDelete(id: string): void {
      withLocalPersist(() => {
        const result = db.run(
          `UPDATE collections SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
          [nowIso(), nowIso(), id],
        );
        if (result.changes === 0) {
          throw new Error(`Collection not found: ${id}`);
        }
      }, 'Could not delete collection');
    },

    restore(id: string): Collection {
      return withLocalPersist(() => {
        db.run(`UPDATE collections SET deleted_at = NULL, updated_at = ? WHERE id = ?`, [
          nowIso(),
          id,
        ]);
        const row = db.get<Parameters<typeof mapCollection>[0]>(
          `SELECT * FROM collections WHERE id = ?`,
          [id],
        );
        if (!row) {
          throw new Error(`Collection not found: ${id}`);
        }
        return mapCollection(row);
      }, 'Could not restore collection');
    },
  };
}

export type CollectionRepository = ReturnType<typeof createCollectionRepository>;
