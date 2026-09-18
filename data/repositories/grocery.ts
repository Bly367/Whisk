import type { GroceryItem, GroceryList, GroceryListWithItems } from '@/data/contracts';
import type { DbClient } from '@/data/client';
import { mapGroceryItem, mapGroceryList } from '@/data/mappers';
import { withLocalPersist } from '@/data/sync/statusStore';
import { createId, fromBool, nowIso } from '@/data/util';

type ListRow = Parameters<typeof mapGroceryList>[0];
type ItemRow = Parameters<typeof mapGroceryItem>[0];

function hydrate(db: DbClient, list: GroceryList): GroceryListWithItems {
  const items = db
    .all<ItemRow>(
      `SELECT * FROM grocery_items
       WHERE list_id = ? AND deleted_at IS NULL
       ORDER BY is_completed ASC, aisle COLLATE NOCASE ASC, position ASC, name COLLATE NOCASE ASC`,
      [list.id],
    )
    .map(mapGroceryItem);
  return { ...list, items };
}

export function createGroceryRepository(db: DbClient) {
  return {
    create(input: {
      name: string;
      mealPlanId?: string | null;
      householdId?: string | null;
      items?: {
        name: string;
        quantity?: string | null;
        unit?: string | null;
        aisle?: string | null;
        recipeId?: string | null;
        recipeTitle?: string | null;
        mergeKey?: string | null;
        position?: number;
      }[];
    }): GroceryListWithItems {
      return withLocalPersist(() => {
        const id = createId();
        const now = nowIso();
        return db.withTransaction(() => {
          db.run(
            `INSERT INTO grocery_lists (
              id, name, meal_plan_id, created_at, updated_at, deleted_at, sync_status,
              household_id, remote_id
            ) VALUES (?, ?, ?, ?, ?, NULL, 'synced_local', ?, NULL)`,
            [id, input.name.trim(), input.mealPlanId ?? null, now, now, input.householdId ?? null],
          );
          input.items?.forEach((item, index) => {
            db.run(
              `INSERT INTO grocery_items (
                id, list_id, name, quantity, unit, aisle, is_completed, completed_at,
                recipe_id, recipe_title, merge_key, position, created_at, updated_at, deleted_at
              ) VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, ?, ?, ?, NULL)`,
              [
                createId(),
                id,
                item.name.trim(),
                item.quantity ?? null,
                item.unit ?? null,
                item.aisle ?? null,
                item.recipeId ?? null,
                item.recipeTitle ?? null,
                item.mergeKey ?? null,
                item.position ?? index,
                now,
                now,
              ],
            );
          });
          const row = db.get<ListRow>(`SELECT * FROM grocery_lists WHERE id = ?`, [id]);
          if (!row) {
            throw new Error('Failed to create grocery list');
          }
          return hydrate(db, mapGroceryList(row));
        });
      }, 'Could not save grocery list');
    },

    setTenantFields(id: string, fields: { householdId?: string | null }): GroceryListWithItems {
      return withLocalPersist(() => {
        const existing = db.get<ListRow>(
          `SELECT * FROM grocery_lists WHERE id = ? AND deleted_at IS NULL`,
          [id],
        );
        if (!existing) {
          throw new Error(`Grocery list not found: ${id}`);
        }
        const now = nowIso();
        db.run(
          `UPDATE grocery_lists SET
            household_id = ?,
            updated_at = ?,
            sync_status = 'synced_local'
           WHERE id = ?`,
          [
            fields.householdId !== undefined ? fields.householdId : (existing.household_id ?? null),
            now,
            id,
          ],
        );
        const row = db.get<ListRow>(`SELECT * FROM grocery_lists WHERE id = ?`, [id]);
        if (!row) {
          throw new Error('Failed to update grocery list tenant fields');
        }
        return hydrate(db, mapGroceryList(row));
      }, 'Could not update grocery list tenant fields');
    },

    getById(id: string): GroceryListWithItems | null {
      const row = db.get<ListRow>(
        `SELECT * FROM grocery_lists WHERE id = ? AND deleted_at IS NULL`,
        [id],
      );
      return row ? hydrate(db, mapGroceryList(row)) : null;
    },

    list(): GroceryList[] {
      return db
        .all<ListRow>(
          `SELECT * FROM grocery_lists WHERE deleted_at IS NULL ORDER BY updated_at DESC`,
        )
        .map(mapGroceryList);
    },

    addItem(
      listId: string,
      input: {
        name: string;
        quantity?: string | null;
        unit?: string | null;
        aisle?: string | null;
        recipeId?: string | null;
        recipeTitle?: string | null;
        mergeKey?: string | null;
        position?: number;
      },
    ): GroceryItem {
      return withLocalPersist(() => {
        const id = createId();
        const now = nowIso();
        return db.withTransaction(() => {
          db.run(
            `INSERT INTO grocery_items (
              id, list_id, name, quantity, unit, aisle, is_completed, completed_at,
              recipe_id, recipe_title, merge_key, position, created_at, updated_at, deleted_at
            ) VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, ?, ?, ?, NULL)`,
            [
              id,
              listId,
              input.name.trim(),
              input.quantity ?? null,
              input.unit ?? null,
              input.aisle ?? null,
              input.recipeId ?? null,
              input.recipeTitle ?? null,
              input.mergeKey ?? null,
              input.position ?? 0,
              now,
              now,
            ],
          );
          db.run(
            `UPDATE grocery_lists SET updated_at = ?, sync_status = 'synced_local' WHERE id = ?`,
            [now, listId],
          );
          const row = db.get<ItemRow>(`SELECT * FROM grocery_items WHERE id = ?`, [id]);
          if (!row) {
            throw new Error('Failed to add grocery item');
          }
          return mapGroceryItem(row);
        });
      }, 'Could not save grocery item');
    },

    setCompleted(id: string, isCompleted: boolean): GroceryItem {
      return withLocalPersist(() => {
        const now = nowIso();
        const existing = db.get<ItemRow>(
          `SELECT * FROM grocery_items WHERE id = ? AND deleted_at IS NULL`,
          [id],
        );
        if (!existing) {
          throw new Error(`Grocery item not found: ${id}`);
        }
        return db.withTransaction(() => {
          db.run(
            `UPDATE grocery_items SET
              is_completed = ?,
              completed_at = ?,
              updated_at = ?
             WHERE id = ?`,
            [fromBool(isCompleted), isCompleted ? now : null, now, id],
          );
          db.run(
            `UPDATE grocery_lists SET updated_at = ?, sync_status = 'synced_local' WHERE id = ?`,
            [now, existing.list_id],
          );
          const row = db.get<ItemRow>(`SELECT * FROM grocery_items WHERE id = ?`, [id]);
          if (!row) {
            throw new Error('Failed to update grocery item');
          }
          return mapGroceryItem(row);
        });
      }, 'Could not update grocery item');
    },

    softDeleteItem(id: string): void {
      const existing = db.get<ItemRow>(
        `SELECT * FROM grocery_items WHERE id = ? AND deleted_at IS NULL`,
        [id],
      );
      if (!existing) {
        return;
      }
      withLocalPersist(() => {
        const now = nowIso();
        db.withTransaction(() => {
          db.run(`UPDATE grocery_items SET deleted_at = ?, updated_at = ? WHERE id = ?`, [
            now,
            now,
            id,
          ]);
          db.run(
            `UPDATE grocery_lists SET updated_at = ?, sync_status = 'synced_local' WHERE id = ?`,
            [now, existing.list_id],
          );
        });
      }, 'Could not delete grocery item');
    },

    /** Include soft-deleted rows (realtime LWW / restore). */
    getItemById(id: string): GroceryItem | null {
      const row = db.get<ItemRow>(`SELECT * FROM grocery_items WHERE id = ?`, [id]);
      return row ? mapGroceryItem(row) : null;
    },

    /**
     * Upsert a synced grocery item by stable id (P2-W3 realtime apply).
     * Preserves the remote `updatedAt` for conflict comparisons.
     */
    upsertSyncedItem(
      listId: string,
      input: {
        id: string;
        name: string;
        quantity?: string | null;
        unit?: string | null;
        aisle?: string | null;
        isCompleted?: boolean;
        completedAt?: string | null;
        recipeId?: string | null;
        recipeTitle?: string | null;
        mergeKey?: string | null;
        position?: number;
        updatedAt: string;
      },
    ): GroceryItem {
      return withLocalPersist(() => {
        const list = db.get<ListRow>(
          `SELECT * FROM grocery_lists WHERE id = ? AND deleted_at IS NULL`,
          [listId],
        );
        if (!list) {
          throw new Error(`Grocery list not found: ${listId}`);
        }
        const existing = db.get<ItemRow>(`SELECT * FROM grocery_items WHERE id = ?`, [input.id]);
        const createdAt = existing?.created_at ?? input.updatedAt;
        const isCompleted = input.isCompleted ?? false;
        return db.withTransaction(() => {
          if (existing) {
            db.run(
              `UPDATE grocery_items SET
                list_id = ?,
                name = ?,
                quantity = ?,
                unit = ?,
                aisle = ?,
                is_completed = ?,
                completed_at = ?,
                recipe_id = ?,
                recipe_title = ?,
                merge_key = ?,
                position = ?,
                updated_at = ?,
                deleted_at = NULL
               WHERE id = ?`,
              [
                listId,
                input.name.trim(),
                input.quantity ?? null,
                input.unit ?? null,
                input.aisle ?? null,
                fromBool(isCompleted),
                isCompleted ? (input.completedAt ?? input.updatedAt) : null,
                input.recipeId ?? null,
                input.recipeTitle ?? null,
                input.mergeKey ?? null,
                input.position ?? existing.position,
                input.updatedAt,
                input.id,
              ],
            );
          } else {
            db.run(
              `INSERT INTO grocery_items (
                id, list_id, name, quantity, unit, aisle, is_completed, completed_at,
                recipe_id, recipe_title, merge_key, position, created_at, updated_at, deleted_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
              [
                input.id,
                listId,
                input.name.trim(),
                input.quantity ?? null,
                input.unit ?? null,
                input.aisle ?? null,
                fromBool(isCompleted),
                isCompleted ? (input.completedAt ?? input.updatedAt) : null,
                input.recipeId ?? null,
                input.recipeTitle ?? null,
                input.mergeKey ?? null,
                input.position ?? 0,
                createdAt,
                input.updatedAt,
              ],
            );
          }
          db.run(
            `UPDATE grocery_lists SET updated_at = ?, sync_status = 'synced_local' WHERE id = ?`,
            [input.updatedAt, listId],
          );
          const row = db.get<ItemRow>(`SELECT * FROM grocery_items WHERE id = ?`, [input.id]);
          if (!row) {
            throw new Error('Failed to upsert grocery item');
          }
          return mapGroceryItem(row);
        });
      }, 'Could not apply grocery sync');
    },

    /** Apply remote reorder positions (P2-W3). */
    reorderItems(
      listId: string,
      positions: { itemId: string; position: number }[],
      updatedAtIso?: string,
    ): void {
      withLocalPersist(() => {
        const list = db.get<ListRow>(
          `SELECT * FROM grocery_lists WHERE id = ? AND deleted_at IS NULL`,
          [listId],
        );
        if (!list) {
          throw new Error(`Grocery list not found: ${listId}`);
        }
        const now = updatedAtIso ?? nowIso();
        db.withTransaction(() => {
          for (const entry of positions) {
            db.run(
              `UPDATE grocery_items SET position = ?, updated_at = ? WHERE id = ? AND list_id = ?`,
              [entry.position, now, entry.itemId, listId],
            );
          }
          db.run(
            `UPDATE grocery_lists SET updated_at = ?, sync_status = 'synced_local' WHERE id = ?`,
            [now, listId],
          );
        });
      }, 'Could not reorder grocery items');
    },

    /** Undo soft-delete or restore a completed item to active. */
    restoreItem(id: string): GroceryItem {
      return withLocalPersist(() => {
        const now = nowIso();
        const existing = db.get<ItemRow>(`SELECT * FROM grocery_items WHERE id = ?`, [id]);
        if (!existing) {
          throw new Error(`Grocery item not found: ${id}`);
        }
        return db.withTransaction(() => {
          db.run(
            `UPDATE grocery_items SET
              deleted_at = NULL,
              is_completed = 0,
              completed_at = NULL,
              updated_at = ?
             WHERE id = ?`,
            [now, id],
          );
          db.run(
            `UPDATE grocery_lists SET updated_at = ?, sync_status = 'synced_local' WHERE id = ?`,
            [now, existing.list_id],
          );
          const row = db.get<ItemRow>(`SELECT * FROM grocery_items WHERE id = ?`, [id]);
          if (!row) {
            throw new Error('Failed to restore grocery item');
          }
          return mapGroceryItem(row);
        });
      }, 'Could not restore grocery item');
    },

    softDeleteList(id: string): void {
      withLocalPersist(() => {
        const result = db.run(
          `UPDATE grocery_lists SET deleted_at = ?, updated_at = ?, sync_status = 'synced_local'
           WHERE id = ? AND deleted_at IS NULL`,
          [nowIso(), nowIso(), id],
        );
        if (result.changes === 0) {
          throw new Error(`Grocery list not found: ${id}`);
        }
      }, 'Could not delete grocery list');
    },

    /** Restore a soft-deleted grocery list (undo replace / delete). */
    restoreList(id: string): GroceryListWithItems {
      const existing = db.get<ListRow>(`SELECT * FROM grocery_lists WHERE id = ?`, [id]);
      if (!existing) {
        throw new Error(`Grocery list not found: ${id}`);
      }
      const now = nowIso();
      db.run(
        `UPDATE grocery_lists SET deleted_at = NULL, updated_at = ?, sync_status = 'synced_local'
         WHERE id = ?`,
        [now, id],
      );
      const row = db.get<ListRow>(`SELECT * FROM grocery_lists WHERE id = ?`, [id]);
      if (!row) {
        throw new Error('Failed to restore grocery list');
      }
      return hydrate(db, mapGroceryList(row));
    },
  };
}

export type GroceryRepository = ReturnType<typeof createGroceryRepository>;
