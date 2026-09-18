import type { MealPlan, MealPlanEntry, MealPlanWithEntries, MealSlot } from '@/data/contracts';
import type { DbClient } from '@/data/client';
import { mapMealPlan, mapMealPlanEntry } from '@/data/mappers';
import { withLocalPersist } from '@/data/sync/statusStore';
import { createId, nowIso } from '@/data/util';

type MealPlanRow = Parameters<typeof mapMealPlan>[0];
type EntryRow = Parameters<typeof mapMealPlanEntry>[0];

function hydrate(db: DbClient, plan: MealPlan): MealPlanWithEntries {
  const entries = db
    .all<EntryRow>(
      `SELECT * FROM meal_plan_entries
       WHERE meal_plan_id = ?
       ORDER BY plan_date ASC, slot ASC, position ASC`,
      [plan.id],
    )
    .map(mapMealPlanEntry);
  return { ...plan, entries };
}

function setMealPlanTenantFields(
  db: DbClient,
  id: string,
  fields: { householdId?: string | null },
): MealPlanWithEntries {
  return withLocalPersist(() => {
    const existing = db.get<MealPlanRow>(
      `SELECT * FROM meal_plans WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    if (!existing) {
      throw new Error(`Meal plan not found: ${id}`);
    }
    const now = nowIso();
    db.run(
      `UPDATE meal_plans SET
        household_id = ?,
        updated_at = ?,
        sync_status = 'synced_local'
       WHERE id = ?`,
      [
        fields.householdId !== undefined ? fields.householdId : existing.household_id ?? null,
        now,
        id,
      ],
    );
    const row = db.get<MealPlanRow>(`SELECT * FROM meal_plans WHERE id = ?`, [id]);
    if (!row) {
      throw new Error('Failed to update meal plan tenant fields');
    }
    return hydrate(db, mapMealPlan(row));
  }, 'Could not update meal plan tenant fields');
}

export function createMealPlanRepository(db: DbClient) {
  return {
    getOrCreateForWeek(
      weekStart: string,
      options?: { householdId?: string | null },
    ): MealPlanWithEntries {
      const existing = db.get<MealPlanRow>(
        `SELECT * FROM meal_plans WHERE week_start = ? AND deleted_at IS NULL`,
        [weekStart],
      );
      if (existing) {
        if (options && options.householdId !== undefined) {
          return setMealPlanTenantFields(db, existing.id, { householdId: options.householdId });
        }
        return hydrate(db, mapMealPlan(existing));
      }
      return withLocalPersist(() => {
        const id = createId();
        const now = nowIso();
        db.run(
          `INSERT INTO meal_plans (
            id, week_start, created_at, updated_at, deleted_at, sync_status,
            household_id, remote_id
          ) VALUES (?, ?, ?, ?, NULL, 'synced_local', ?, NULL)`,
          [id, weekStart, now, now, options?.householdId ?? null],
        );
        const row = db.get<MealPlanRow>(`SELECT * FROM meal_plans WHERE id = ?`, [id]);
        if (!row) {
          throw new Error('Failed to create meal plan');
        }
        return hydrate(db, mapMealPlan(row));
      }, 'Could not save meal plan');
    },

    setTenantFields(
      id: string,
      fields: { householdId?: string | null },
    ): MealPlanWithEntries {
      return setMealPlanTenantFields(db, id, fields);
    },

    getById(id: string): MealPlanWithEntries | null {
      const row = db.get<MealPlanRow>(
        `SELECT * FROM meal_plans WHERE id = ? AND deleted_at IS NULL`,
        [id],
      );
      return row ? hydrate(db, mapMealPlan(row)) : null;
    },

    list(): MealPlan[] {
      return db
        .all<MealPlanRow>(
          `SELECT * FROM meal_plans WHERE deleted_at IS NULL ORDER BY week_start DESC`,
        )
        .map(mapMealPlan);
    },

    addEntry(input: {
      mealPlanId: string;
      recipeId?: string | null;
      planDate: string;
      slot: MealSlot;
      note?: string | null;
      position?: number;
    }): MealPlanEntry {
      return withLocalPersist(() => {
        const id = createId();
        const now = nowIso();
        return db.withTransaction(() => {
          db.run(
            `INSERT INTO meal_plan_entries (
              id, meal_plan_id, recipe_id, plan_date, slot, note, position, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              input.mealPlanId,
              input.recipeId ?? null,
              input.planDate,
              input.slot,
              input.note ?? null,
              input.position ?? 0,
              now,
              now,
            ],
          );
          db.run(
            `UPDATE meal_plans SET updated_at = ?, sync_status = 'synced_local' WHERE id = ?`,
            [now, input.mealPlanId],
          );
          const row = db.get<EntryRow>(`SELECT * FROM meal_plan_entries WHERE id = ?`, [id]);
          if (!row) {
            throw new Error('Failed to add meal plan entry');
          }
          return mapMealPlanEntry(row);
        });
      }, 'Could not save meal plan entry');
    },

    updateEntry(
      id: string,
      patch: Partial<{
        recipeId: string | null;
        planDate: string;
        slot: MealSlot;
        note: string | null;
        position: number;
      }>,
    ): MealPlanEntry {
      return withLocalPersist(() => {
        const existing = db.get<EntryRow>(`SELECT * FROM meal_plan_entries WHERE id = ?`, [id]);
        if (!existing) {
          throw new Error(`Meal plan entry not found: ${id}`);
        }
        const now = nowIso();
        return db.withTransaction(() => {
          db.run(
            `UPDATE meal_plan_entries SET
              recipe_id = ?,
              plan_date = ?,
              slot = ?,
              note = ?,
              position = ?,
              updated_at = ?
             WHERE id = ?`,
            [
              patch.recipeId !== undefined ? patch.recipeId : existing.recipe_id,
              patch.planDate !== undefined ? patch.planDate : existing.plan_date,
              patch.slot !== undefined ? patch.slot : existing.slot,
              patch.note !== undefined ? patch.note : existing.note,
              patch.position !== undefined ? patch.position : existing.position,
              now,
              id,
            ],
          );
          db.run(
            `UPDATE meal_plans SET updated_at = ?, sync_status = 'synced_local' WHERE id = ?`,
            [now, existing.meal_plan_id],
          );
          const row = db.get<EntryRow>(`SELECT * FROM meal_plan_entries WHERE id = ?`, [id]);
          if (!row) {
            throw new Error('Failed to update meal plan entry');
          }
          return mapMealPlanEntry(row);
        });
      }, 'Could not update meal plan entry');
    },

    removeEntry(id: string): void {
      const existing = db.get<EntryRow>(`SELECT * FROM meal_plan_entries WHERE id = ?`, [id]);
      if (!existing) {
        return;
      }
      withLocalPersist(() => {
        db.withTransaction(() => {
          db.run(`DELETE FROM meal_plan_entries WHERE id = ?`, [id]);
          db.run(
            `UPDATE meal_plans SET updated_at = ?, sync_status = 'synced_local' WHERE id = ?`,
            [nowIso(), existing.meal_plan_id],
          );
        });
      }, 'Could not remove meal plan entry');
    },

    softDelete(id: string): void {
      withLocalPersist(() => {
        const result = db.run(
          `UPDATE meal_plans SET deleted_at = ?, updated_at = ?, sync_status = 'synced_local'
           WHERE id = ? AND deleted_at IS NULL`,
          [nowIso(), nowIso(), id],
        );
        if (result.changes === 0) {
          throw new Error(`Meal plan not found: ${id}`);
        }
      }, 'Could not delete meal plan');
    },
  };
}

export type MealPlanRepository = ReturnType<typeof createMealPlanRepository>;
