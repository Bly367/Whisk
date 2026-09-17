import type { Tag } from '@/data/contracts';
import type { DbClient } from '@/data/client';
import { mapTag } from '@/data/mappers';
import { createId, nowIso } from '@/data/util';

export function createTagRepository(db: DbClient) {
  return {
    list(): Tag[] {
      return db
        .all<{ id: string; name: string; created_at: string }>(
          `SELECT * FROM tags ORDER BY name COLLATE NOCASE ASC`,
        )
        .map(mapTag);
    },

    getById(id: string): Tag | null {
      const row = db.get<{ id: string; name: string; created_at: string }>(
        `SELECT * FROM tags WHERE id = ?`,
        [id],
      );
      return row ? mapTag(row) : null;
    },

    /** Find-or-create by case-insensitive name. */
    upsertByName(name: string): Tag {
      const trimmed = name.trim();
      if (!trimmed) {
        throw new Error('Tag name is required');
      }
      const existing = db.get<{ id: string; name: string; created_at: string }>(
        `SELECT * FROM tags WHERE name = ? COLLATE NOCASE`,
        [trimmed],
      );
      if (existing) {
        return mapTag(existing);
      }
      const id = createId();
      const createdAt = nowIso();
      db.run(`INSERT INTO tags (id, name, created_at) VALUES (?, ?, ?)`, [
        id,
        trimmed,
        createdAt,
      ]);
      return { id, name: trimmed, createdAt };
    },

    delete(id: string): void {
      db.run('DELETE FROM tags WHERE id = ?', [id]);
    },
  };
}

export type TagRepository = ReturnType<typeof createTagRepository>;
