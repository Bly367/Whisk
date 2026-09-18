import type {
  MealPlanTemplate,
  MealPlanTemplateWithEntries,
  MealSlot,
} from '@/data/contracts';
import type { DbClient } from '@/data/client';
import { mapMealPlanTemplate, mapMealPlanTemplateEntry } from '@/data/mappers';
import { withLocalPersist } from '@/data/sync/statusStore';
import { createId, nowIso } from '@/data/util';

type TemplateRow = Parameters<typeof mapMealPlanTemplate>[0];
type EntryRow = Parameters<typeof mapMealPlanTemplateEntry>[0];

type PlanEntrySource = {
  recipe_id: string | null;
  plan_date: string;
  slot: MealSlot;
  note: string | null;
  position: number;
};

function dayOffsetFromWeekStart(weekStart: string, planDate: string): number {
  const start = Date.parse(`${weekStart}T00:00:00.000Z`);
  const day = Date.parse(`${planDate}T00:00:00.000Z`);
  if (Number.isNaN(start) || Number.isNaN(day)) {
    return 0;
  }
  return Math.round((day - start) / (24 * 60 * 60 * 1000));
}

function hydrate(db: DbClient, template: MealPlanTemplate): MealPlanTemplateWithEntries {
  const entries = db
    .all<EntryRow>(
      `SELECT * FROM meal_plan_template_entries
       WHERE template_id = ?
       ORDER BY day_offset ASC, slot ASC, position ASC`,
      [template.id],
    )
    .map(mapMealPlanTemplateEntry);
  return { ...template, entries };
}

export function createMealPlanTemplateRepository(db: DbClient) {
  return {
    createFromMealPlan(input: {
      name: string;
      mealPlanId: string;
      weekStart: string;
      householdId?: string | null;
    }): MealPlanTemplateWithEntries {
      return withLocalPersist(() => {
        const plan = db.get<{ id: string }>(
          `SELECT id FROM meal_plans WHERE id = ? AND deleted_at IS NULL`,
          [input.mealPlanId],
        );
        if (!plan) {
          throw new Error(`Meal plan not found: ${input.mealPlanId}`);
        }
        const sources = db.all<PlanEntrySource>(
          `SELECT recipe_id, plan_date, slot, note, position
           FROM meal_plan_entries WHERE meal_plan_id = ?
           ORDER BY plan_date ASC, slot ASC, position ASC`,
          [input.mealPlanId],
        );
        const id = createId();
        const now = nowIso();
        return db.withTransaction(() => {
          db.run(
            `INSERT INTO meal_plan_templates (
              id, household_id, name, source_meal_plan_id, created_at, updated_at,
              deleted_at, local_revision, sync_status, remote_id
            ) VALUES (?, ?, ?, ?, ?, ?, NULL, 1, 'synced_local', NULL)`,
            [id, input.householdId ?? null, input.name.trim(), input.mealPlanId, now, now],
          );
          for (const source of sources) {
            db.run(
              `INSERT INTO meal_plan_template_entries (
                id, template_id, recipe_id, day_offset, slot, note, position, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                createId(),
                id,
                source.recipe_id,
                dayOffsetFromWeekStart(input.weekStart, source.plan_date),
                source.slot,
                source.note,
                source.position,
                now,
                now,
              ],
            );
          }
          const row = db.get<TemplateRow>(`SELECT * FROM meal_plan_templates WHERE id = ?`, [id]);
          if (!row) {
            throw new Error('Failed to create meal plan template');
          }
          return hydrate(db, mapMealPlanTemplate(row));
        });
      }, 'Could not save meal plan template');
    },

    getById(id: string): MealPlanTemplateWithEntries | null {
      const row = db.get<TemplateRow>(
        `SELECT * FROM meal_plan_templates WHERE id = ? AND deleted_at IS NULL`,
        [id],
      );
      return row ? hydrate(db, mapMealPlanTemplate(row)) : null;
    },

    list(householdId?: string | null): MealPlanTemplate[] {
      if (householdId !== undefined) {
        if (householdId === null) {
          return db
            .all<TemplateRow>(
              `SELECT * FROM meal_plan_templates
               WHERE deleted_at IS NULL AND household_id IS NULL
               ORDER BY updated_at DESC`,
            )
            .map(mapMealPlanTemplate);
        }
        return db
          .all<TemplateRow>(
            `SELECT * FROM meal_plan_templates
             WHERE deleted_at IS NULL AND household_id = ?
             ORDER BY updated_at DESC`,
            [householdId],
          )
          .map(mapMealPlanTemplate);
      }
      return db
        .all<TemplateRow>(
          `SELECT * FROM meal_plan_templates WHERE deleted_at IS NULL ORDER BY updated_at DESC`,
        )
        .map(mapMealPlanTemplate);
    },

    softDelete(id: string): void {
      withLocalPersist(() => {
        const result = db.run(
          `UPDATE meal_plan_templates SET deleted_at = ?, updated_at = ?,
             local_revision = local_revision + 1, sync_status = 'synced_local'
           WHERE id = ? AND deleted_at IS NULL`,
          [nowIso(), nowIso(), id],
        );
        if (result.changes === 0) {
          throw new Error(`Meal plan template not found: ${id}`);
        }
      }, 'Could not delete meal plan template');
    },
  };
}

export type MealPlanTemplateRepository = ReturnType<typeof createMealPlanTemplateRepository>;
