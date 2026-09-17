import type {
  IngredientInput,
  RecipeCreateInput,
  RecipeListItem,
  RecipeListQuery,
  RecipeUpdateInput,
  RecipeWithIngredients,
} from '@/data/contracts';
import type { DbClient } from '@/data/client';
import {
  mapIngredient,
  mapRecipe,
  type IngredientRow,
  type RecipeRow,
} from '@/data/mappers';
import {
  reportLocalPersistFailure,
  reportLocalPersistSuccess,
} from '@/data/sync/statusStore';
import { createId, fromBool, nowIso } from '@/data/util';

function replaceIngredients(
  db: DbClient,
  recipeId: string,
  ingredients: IngredientInput[],
): void {
  db.run('DELETE FROM ingredients WHERE recipe_id = ?', [recipeId]);
  ingredients.forEach((ing, index) => {
    db.run(
      `INSERT INTO ingredients (
        id, recipe_id, name, quantity, unit, note, aisle, group_name, position
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        createId(),
        recipeId,
        ing.name.trim(),
        ing.quantity ?? null,
        ing.unit ?? null,
        ing.note ?? null,
        ing.aisle ?? null,
        ing.groupName ?? null,
        ing.position ?? index,
      ],
    );
  });
}

function replaceTags(db: DbClient, recipeId: string, tagIds: string[]): void {
  db.run('DELETE FROM recipe_tags WHERE recipe_id = ?', [recipeId]);
  for (const tagId of tagIds) {
    db.run('INSERT OR IGNORE INTO recipe_tags (recipe_id, tag_id) VALUES (?, ?)', [
      recipeId,
      tagId,
    ]);
  }
}

function loadIngredients(db: DbClient, recipeId: string) {
  const rows = db.all<IngredientRow>(
    `SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY position ASC, name ASC`,
    [recipeId],
  );
  return rows.map(mapIngredient);
}

function loadTagIds(db: DbClient, recipeId: string): string[] {
  const rows = db.all<{ tag_id: string }>(
    `SELECT tag_id FROM recipe_tags WHERE recipe_id = ?`,
    [recipeId],
  );
  return rows.map((r) => r.tag_id);
}

function hydrate(db: DbClient, row: RecipeRow): RecipeWithIngredients {
  return {
    ...mapRecipe(row),
    ingredients: loadIngredients(db, row.id),
    tagIds: loadTagIds(db, row.id),
  };
}

function sortClause(sort: RecipeListQuery['sort']): string {
  switch (sort) {
    case 'oldest':
      return 'r.created_at ASC';
    case 'title_asc':
      return 'r.title COLLATE NOCASE ASC';
    case 'recently_cooked':
      return 'r.cooked_at IS NULL, r.cooked_at DESC, r.updated_at DESC';
    case 'rating':
      return 'r.rating IS NULL, r.rating DESC, r.title COLLATE NOCASE ASC';
    case 'newest':
    default:
      return 'r.updated_at DESC';
  }
}

export function createRecipeRepository(db: DbClient) {
  return {
    create(input: RecipeCreateInput): RecipeWithIngredients {
      const id = createId();
      const now = nowIso();
      const status = input.status ?? 'published';

      try {
        const recipe = db.withTransaction(() => {
          db.run(
            `INSERT INTO recipes (
              id, title, notes, source_url, source_name, image_uri,
              servings, prep_minutes, cook_minutes, rating, instructions_json,
              status, is_favorite, cooked_at, deleted_at,
              created_at, updated_at, local_revision, sync_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, 1, 'synced_local')`,
            [
              id,
              input.title.trim() || 'Untitled recipe',
              input.notes ?? null,
              input.sourceUrl ?? null,
              input.sourceName ?? null,
              input.imageUri ?? null,
              input.servings ?? null,
              input.prepMinutes ?? null,
              input.cookMinutes ?? null,
              input.rating ?? null,
              JSON.stringify(input.instructions ?? []),
              status,
              fromBool(input.isFavorite ?? false),
              now,
              now,
            ],
          );

          if (input.ingredients?.length) {
            replaceIngredients(db, id, input.ingredients);
          }
          if (input.tagIds?.length) {
            replaceTags(db, id, input.tagIds);
          }

          const row = db.get<RecipeRow>(`SELECT * FROM recipes WHERE id = ?`, [id]);
          if (!row) {
            throw new Error('Failed to persist recipe');
          }
          return hydrate(db, row);
        });
        reportLocalPersistSuccess();
        return recipe;
      } catch (error) {
        reportLocalPersistFailure(
          error instanceof Error ? error.message : 'Could not save recipe',
        );
        throw error;
      }
    },

    getById(id: string, options?: { includeDeleted?: boolean }): RecipeWithIngredients | null {
      const row = db.get<RecipeRow>(
        options?.includeDeleted
          ? `SELECT * FROM recipes WHERE id = ?`
          : `SELECT * FROM recipes WHERE id = ? AND deleted_at IS NULL`,
        [id],
      );
      return row ? hydrate(db, row) : null;
    },

    update(id: string, input: RecipeUpdateInput): RecipeWithIngredients {
      const existing = db.get<RecipeRow>(
        `SELECT * FROM recipes WHERE id = ? AND deleted_at IS NULL`,
        [id],
      );
      if (!existing) {
        throw new Error(`Recipe not found: ${id}`);
      }

      const now = nowIso();
      try {
        const recipe = db.withTransaction(() => {
          db.run(
            `UPDATE recipes SET
              title = ?,
              notes = ?,
              source_url = ?,
              source_name = ?,
              image_uri = ?,
              servings = ?,
              prep_minutes = ?,
              cook_minutes = ?,
              rating = ?,
              instructions_json = ?,
              status = ?,
              is_favorite = ?,
              cooked_at = ?,
              updated_at = ?,
              local_revision = local_revision + 1,
              sync_status = 'synced_local'
            WHERE id = ?`,
            [
              input.title !== undefined
                ? input.title.trim() || 'Untitled recipe'
                : existing.title,
              input.notes !== undefined ? input.notes : existing.notes,
              input.sourceUrl !== undefined ? input.sourceUrl : existing.source_url,
              input.sourceName !== undefined ? input.sourceName : existing.source_name,
              input.imageUri !== undefined ? input.imageUri : existing.image_uri,
              input.servings !== undefined ? input.servings : existing.servings,
              input.prepMinutes !== undefined ? input.prepMinutes : existing.prep_minutes,
              input.cookMinutes !== undefined ? input.cookMinutes : existing.cook_minutes,
              input.rating !== undefined ? input.rating : existing.rating,
              input.instructions !== undefined
                ? JSON.stringify(input.instructions)
                : existing.instructions_json,
              input.status !== undefined ? input.status : existing.status,
              input.isFavorite !== undefined
                ? fromBool(input.isFavorite)
                : existing.is_favorite,
              input.cookedAt !== undefined ? input.cookedAt : existing.cooked_at,
              now,
              id,
            ],
          );

          if (input.ingredients !== undefined) {
            replaceIngredients(db, id, input.ingredients);
          }
          if (input.tagIds !== undefined) {
            replaceTags(db, id, input.tagIds);
          }

          const row = db.get<RecipeRow>(`SELECT * FROM recipes WHERE id = ?`, [id]);
          if (!row) {
            throw new Error('Failed to update recipe');
          }
          return hydrate(db, row);
        });
        reportLocalPersistSuccess();
        return recipe;
      } catch (error) {
        reportLocalPersistFailure(
          error instanceof Error ? error.message : 'Could not save recipe',
        );
        throw error;
      }
    },

    /** Soft-delete into trash. */
    softDelete(id: string): void {
      const now = nowIso();
      try {
        const result = db.run(
          `UPDATE recipes SET deleted_at = ?, updated_at = ?, sync_status = 'synced_local',
            local_revision = local_revision + 1
           WHERE id = ? AND deleted_at IS NULL`,
          [now, now, id],
        );
        if (result.changes === 0) {
          throw new Error(`Recipe not found: ${id}`);
        }
        reportLocalPersistSuccess();
      } catch (error) {
        reportLocalPersistFailure(
          error instanceof Error ? error.message : 'Could not delete recipe',
        );
        throw error;
      }
    },

    restore(id: string): RecipeWithIngredients {
      const now = nowIso();
      try {
        const result = db.run(
          `UPDATE recipes SET deleted_at = NULL, updated_at = ?, sync_status = 'synced_local',
            local_revision = local_revision + 1
           WHERE id = ? AND deleted_at IS NOT NULL`,
          [now, id],
        );
        if (result.changes === 0) {
          throw new Error(`Trashed recipe not found: ${id}`);
        }
        const row = db.get<RecipeRow>(`SELECT * FROM recipes WHERE id = ?`, [id]);
        if (!row) {
          throw new Error('Failed to restore recipe');
        }
        reportLocalPersistSuccess();
        return hydrate(db, row);
      } catch (error) {
        reportLocalPersistFailure(
          error instanceof Error ? error.message : 'Could not restore recipe',
        );
        throw error;
      }
    },

    listTrash(): RecipeListItem[] {
      return this.list({ includeDeleted: true, status: 'any' }).filter(
        (r) => r.deletedAt !== null,
      );
    },

    /**
     * Efficient list: one recipe query + batched ingredient/tag aggregation
     * (no per-row queries).
     */
    list(query: RecipeListQuery = {}): RecipeListItem[] {
      const {
        search,
        tagIds,
        includeDeleted = false,
        status = 'any',
        sort = 'newest',
        limit,
        offset = 0,
      } = query;

      const where: string[] = [];
      const params: (string | number)[] = [];

      if (!includeDeleted) {
        where.push('r.deleted_at IS NULL');
      }
      if (status !== 'any') {
        where.push('r.status = ?');
        params.push(status);
      }
      if (search?.trim()) {
        const like = `%${search.trim().toLowerCase()}%`;
        where.push(`(
          LOWER(r.title) LIKE ?
          OR LOWER(COALESCE(r.notes, '')) LIKE ?
          OR LOWER(COALESCE(r.source_name, '')) LIKE ?
          OR LOWER(COALESCE(r.source_url, '')) LIKE ?
          OR EXISTS (
            SELECT 1 FROM ingredients i
            WHERE i.recipe_id = r.id AND LOWER(i.name) LIKE ?
          )
          OR EXISTS (
            SELECT 1 FROM recipe_tags rt
            JOIN tags t ON t.id = rt.tag_id
            WHERE rt.recipe_id = r.id AND LOWER(t.name) LIKE ?
          )
        )`);
        params.push(like, like, like, like, like, like);
      }
      if (tagIds?.length) {
        where.push(`(
          SELECT COUNT(DISTINCT rt.tag_id) FROM recipe_tags rt
          WHERE rt.recipe_id = r.id AND rt.tag_id IN (${tagIds.map(() => '?').join(',')})
        ) = ?`);
        params.push(...tagIds, tagIds.length);
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const limitSql =
        typeof limit === 'number' ? `LIMIT ${limit} OFFSET ${offset}` : '';

      type ListRow = RecipeRow & {
        ingredient_names: string | null;
        tag_names: string | null;
      };

      const rows = db.all<ListRow>(
        `SELECT
           r.*,
           (
             SELECT GROUP_CONCAT(i.name, char(31))
             FROM ingredients i
             WHERE i.recipe_id = r.id
           ) AS ingredient_names,
           (
             SELECT GROUP_CONCAT(t.name, char(31))
             FROM recipe_tags rt
             JOIN tags t ON t.id = rt.tag_id
             WHERE rt.recipe_id = r.id
           ) AS tag_names
         FROM recipes r
         ${whereSql}
         ORDER BY ${sortClause(sort)}
         ${limitSql}`,
        params,
      );

      return rows.map((row) => ({
        ...mapRecipe(row),
        ingredientNames: row.ingredient_names
          ? row.ingredient_names.split('\u001f')
          : [],
        tagNames: row.tag_names ? row.tag_names.split('\u001f') : [],
      }));
    },

    hardDelete(id: string): void {
      db.run('DELETE FROM recipes WHERE id = ?', [id]);
    },
  };
}

export type RecipeRepository = ReturnType<typeof createRecipeRepository>;
