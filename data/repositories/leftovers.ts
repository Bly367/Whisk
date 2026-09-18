import type { LeftoversLink } from '@/data/contracts';
import type { DbClient } from '@/data/client';
import { mapLeftoversLink } from '@/data/mappers';
import { withLocalPersist } from '@/data/sync/statusStore';
import { createId, nowIso } from '@/data/util';

type LeftoversRow = Parameters<typeof mapLeftoversLink>[0];

export function createLeftoversRepository(db: DbClient) {
  return {
    create(input: {
      sourceRecipeId?: string | null;
      sourceMealPlanEntryId?: string | null;
      leftoverRecipeId?: string | null;
      targetMealPlanEntryId?: string | null;
      householdId?: string | null;
      label?: string | null;
      servingsRemaining?: number | null;
    }): LeftoversLink {
      return withLocalPersist(() => {
        const id = createId();
        const now = nowIso();
        db.run(
          `INSERT INTO leftovers_links (
            id, household_id, source_recipe_id, source_meal_plan_entry_id,
            leftover_recipe_id, target_meal_plan_entry_id, label, servings_remaining,
            created_at, updated_at, deleted_at, local_revision, sync_status, remote_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, 'synced_local', NULL)`,
          [
            id,
            input.householdId ?? null,
            input.sourceRecipeId ?? null,
            input.sourceMealPlanEntryId ?? null,
            input.leftoverRecipeId ?? null,
            input.targetMealPlanEntryId ?? null,
            input.label ?? null,
            input.servingsRemaining ?? null,
            now,
            now,
          ],
        );
        const row = db.get<LeftoversRow>(`SELECT * FROM leftovers_links WHERE id = ?`, [id]);
        if (!row) {
          throw new Error('Failed to create leftovers link');
        }
        return mapLeftoversLink(row);
      }, 'Could not save leftovers link');
    },

    getById(id: string): LeftoversLink | null {
      const row = db.get<LeftoversRow>(
        `SELECT * FROM leftovers_links WHERE id = ? AND deleted_at IS NULL`,
        [id],
      );
      return row ? mapLeftoversLink(row) : null;
    },

    list(query: { householdId?: string | null; sourceRecipeId?: string } = {}): LeftoversLink[] {
      const clauses: string[] = ['deleted_at IS NULL'];
      const params: (string | null)[] = [];
      if (query.householdId !== undefined) {
        if (query.householdId === null) {
          clauses.push('household_id IS NULL');
        } else {
          clauses.push('household_id = ?');
          params.push(query.householdId);
        }
      }
      if (query.sourceRecipeId) {
        clauses.push('source_recipe_id = ?');
        params.push(query.sourceRecipeId);
      }
      return db
        .all<LeftoversRow>(
          `SELECT * FROM leftovers_links
           WHERE ${clauses.join(' AND ')}
           ORDER BY updated_at DESC`,
          params,
        )
        .map(mapLeftoversLink);
    },

    assignToEntry(id: string, targetMealPlanEntryId: string): LeftoversLink {
      return withLocalPersist(() => {
        const existing = db.get<LeftoversRow>(
          `SELECT * FROM leftovers_links WHERE id = ? AND deleted_at IS NULL`,
          [id],
        );
        if (!existing) {
          throw new Error(`Leftovers link not found: ${id}`);
        }
        const entry = db.get<{ id: string }>(
          `SELECT id FROM meal_plan_entries WHERE id = ?`,
          [targetMealPlanEntryId],
        );
        if (!entry) {
          throw new Error(`Meal plan entry not found: ${targetMealPlanEntryId}`);
        }
        const now = nowIso();
        db.run(
          `UPDATE leftovers_links SET
            target_meal_plan_entry_id = ?,
            updated_at = ?,
            local_revision = local_revision + 1,
            sync_status = 'synced_local'
           WHERE id = ?`,
          [targetMealPlanEntryId, now, id],
        );
        const row = db.get<LeftoversRow>(`SELECT * FROM leftovers_links WHERE id = ?`, [id]);
        if (!row) {
          throw new Error('Failed to assign leftovers link');
        }
        return mapLeftoversLink(row);
      }, 'Could not assign leftovers link');
    },

    softDelete(id: string): void {
      withLocalPersist(() => {
        const result = db.run(
          `UPDATE leftovers_links SET deleted_at = ?, updated_at = ?,
             local_revision = local_revision + 1, sync_status = 'synced_local'
           WHERE id = ? AND deleted_at IS NULL`,
          [nowIso(), nowIso(), id],
        );
        if (result.changes === 0) {
          throw new Error(`Leftovers link not found: ${id}`);
        }
      }, 'Could not delete leftovers link');
    },
  };
}

export type LeftoversRepository = ReturnType<typeof createLeftoversRepository>;
