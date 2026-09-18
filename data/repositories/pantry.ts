import type { PantryItem, PantryListQuery } from '@/data/contracts';
import type { DbClient } from '@/data/client';
import { mapPantryItem } from '@/data/mappers';
import { withLocalPersist } from '@/data/sync/statusStore';
import { createId, nowIso } from '@/data/util';

type PantryRow = Parameters<typeof mapPantryItem>[0];

export function createPantryRepository(db: DbClient) {
  return {
    create(input: {
      name: string;
      householdId?: string | null;
      quantity?: string | null;
      unit?: string | null;
      aisle?: string | null;
      notes?: string | null;
      expiresAt?: string | null;
    }): PantryItem {
      return withLocalPersist(() => {
        const id = createId();
        const now = nowIso();
        db.run(
          `INSERT INTO pantry_items (
            id, household_id, name, quantity, unit, aisle, notes, expires_at, depleted_at,
            created_at, updated_at, deleted_at, local_revision, sync_status, remote_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, 1, 'synced_local', NULL)`,
          [
            id,
            input.householdId ?? null,
            input.name.trim(),
            input.quantity ?? null,
            input.unit ?? null,
            input.aisle ?? null,
            input.notes ?? null,
            input.expiresAt ?? null,
            now,
            now,
          ],
        );
        const row = db.get<PantryRow>(`SELECT * FROM pantry_items WHERE id = ?`, [id]);
        if (!row) {
          throw new Error('Failed to create pantry item');
        }
        return mapPantryItem(row);
      }, 'Could not save pantry item');
    },

    getById(id: string): PantryItem | null {
      const row = db.get<PantryRow>(
        `SELECT * FROM pantry_items WHERE id = ? AND deleted_at IS NULL`,
        [id],
      );
      return row ? mapPantryItem(row) : null;
    },

    list(query: PantryListQuery = {}): PantryItem[] {
      const clauses: string[] = ['deleted_at IS NULL'];
      const params: (string | number | null)[] = [];

      if (query.householdId !== undefined) {
        if (query.householdId === null) {
          clauses.push('household_id IS NULL');
        } else {
          clauses.push('household_id = ?');
          params.push(query.householdId);
        }
      }
      if (!query.includeDepleted) {
        clauses.push('depleted_at IS NULL');
      }
      if (query.search?.trim()) {
        clauses.push('name LIKE ? COLLATE NOCASE');
        params.push(`%${query.search.trim()}%`);
      }

      return db
        .all<PantryRow>(
          `SELECT * FROM pantry_items
           WHERE ${clauses.join(' AND ')}
           ORDER BY name COLLATE NOCASE ASC`,
          params,
        )
        .map(mapPantryItem);
    },

    update(
      id: string,
      patch: Partial<{
        name: string;
        quantity: string | null;
        unit: string | null;
        aisle: string | null;
        notes: string | null;
        expiresAt: string | null;
        householdId: string | null;
      }>,
    ): PantryItem {
      return withLocalPersist(() => {
        const existing = db.get<PantryRow>(
          `SELECT * FROM pantry_items WHERE id = ? AND deleted_at IS NULL`,
          [id],
        );
        if (!existing) {
          throw new Error(`Pantry item not found: ${id}`);
        }
        const now = nowIso();
        db.run(
          `UPDATE pantry_items SET
            name = ?,
            quantity = ?,
            unit = ?,
            aisle = ?,
            notes = ?,
            expires_at = ?,
            household_id = ?,
            updated_at = ?,
            local_revision = local_revision + 1,
            sync_status = 'synced_local'
           WHERE id = ?`,
          [
            patch.name !== undefined ? patch.name.trim() : existing.name,
            patch.quantity !== undefined ? patch.quantity : existing.quantity,
            patch.unit !== undefined ? patch.unit : existing.unit,
            patch.aisle !== undefined ? patch.aisle : existing.aisle,
            patch.notes !== undefined ? patch.notes : existing.notes,
            patch.expiresAt !== undefined ? patch.expiresAt : existing.expires_at,
            patch.householdId !== undefined ? patch.householdId : existing.household_id,
            now,
            id,
          ],
        );
        const row = db.get<PantryRow>(`SELECT * FROM pantry_items WHERE id = ?`, [id]);
        if (!row) {
          throw new Error('Failed to update pantry item');
        }
        return mapPantryItem(row);
      }, 'Could not update pantry item');
    },

    consume(id: string): PantryItem {
      return withLocalPersist(() => {
        const existing = db.get<PantryRow>(
          `SELECT * FROM pantry_items WHERE id = ? AND deleted_at IS NULL`,
          [id],
        );
        if (!existing) {
          throw new Error(`Pantry item not found: ${id}`);
        }
        const now = nowIso();
        db.run(
          `UPDATE pantry_items SET
            depleted_at = ?,
            updated_at = ?,
            local_revision = local_revision + 1,
            sync_status = 'synced_local'
           WHERE id = ?`,
          [now, now, id],
        );
        const row = db.get<PantryRow>(`SELECT * FROM pantry_items WHERE id = ?`, [id]);
        if (!row) {
          throw new Error('Failed to consume pantry item');
        }
        return mapPantryItem(row);
      }, 'Could not consume pantry item');
    },

    softDelete(id: string): void {
      withLocalPersist(() => {
        const result = db.run(
          `UPDATE pantry_items SET deleted_at = ?, updated_at = ?, local_revision = local_revision + 1,
             sync_status = 'synced_local' WHERE id = ? AND deleted_at IS NULL`,
          [nowIso(), nowIso(), id],
        );
        if (result.changes === 0) {
          throw new Error(`Pantry item not found: ${id}`);
        }
      }, 'Could not delete pantry item');
    },
  };
}

export type PantryRepository = ReturnType<typeof createPantryRepository>;
