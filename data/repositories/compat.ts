import type {
  CompatExportPack,
  CompatFormat,
  CompatImportJob,
} from '@/data/contracts';
import type { DbClient } from '@/data/client';
import { mapCompatExportPack, mapCompatImportJob } from '@/data/mappers';
import { withLocalPersist } from '@/data/sync/statusStore';
import { createId, nowIso } from '@/data/util';

type ImportRow = Parameters<typeof mapCompatImportJob>[0];
type ExportRow = Parameters<typeof mapCompatExportPack>[0];

export function createCompatRepository(db: DbClient) {
  return {
    createImportJob(input: {
      format: CompatFormat;
      sourceLabel?: string | null;
      preview: Record<string, unknown>;
      confidence?: number | null;
    }): CompatImportJob {
      return withLocalPersist(() => {
        const id = createId();
        const now = nowIso();
        db.run(
          `INSERT INTO compat_import_jobs (
            id, format, status, source_label, preview_json, confidence, error_message,
            created_at, updated_at, committed_at, local_revision
          ) VALUES (?, ?, 'preview', ?, ?, ?, NULL, ?, ?, NULL, 1)`,
          [
            id,
            input.format,
            input.sourceLabel ?? null,
            JSON.stringify(input.preview),
            input.confidence ?? null,
            now,
            now,
          ],
        );
        const row = db.get<ImportRow>(`SELECT * FROM compat_import_jobs WHERE id = ?`, [id]);
        if (!row) {
          throw new Error('Failed to create compat import job');
        }
        return mapCompatImportJob(row);
      }, 'Could not save import preview');
    },

    getImportJob(id: string): CompatImportJob | null {
      const row = db.get<ImportRow>(`SELECT * FROM compat_import_jobs WHERE id = ?`, [id]);
      return row ? mapCompatImportJob(row) : null;
    },

    markImportCommitted(id: string): CompatImportJob {
      return withLocalPersist(() => {
        const existing = db.get<ImportRow>(`SELECT * FROM compat_import_jobs WHERE id = ?`, [id]);
        if (!existing) {
          throw new Error(`Compat import job not found: ${id}`);
        }
        const now = nowIso();
        db.run(
          `UPDATE compat_import_jobs SET
            status = 'committed',
            committed_at = ?,
            updated_at = ?,
            local_revision = local_revision + 1
           WHERE id = ?`,
          [now, now, id],
        );
        const row = db.get<ImportRow>(`SELECT * FROM compat_import_jobs WHERE id = ?`, [id]);
        if (!row) {
          throw new Error('Failed to commit compat import job');
        }
        return mapCompatImportJob(row);
      }, 'Could not commit import job');
    },

    createExportPack(input: {
      format: CompatFormat;
      recipeIds: string[];
      payload?: Record<string, unknown> | null;
      status?: 'draft' | 'ready' | 'failed';
    }): CompatExportPack {
      return withLocalPersist(() => {
        const id = createId();
        const now = nowIso();
        const status = input.status ?? (input.payload ? 'ready' : 'draft');
        db.run(
          `INSERT INTO compat_export_packs (
            id, format, status, payload_json, recipe_ids_json, created_at, updated_at, local_revision
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            id,
            input.format,
            status,
            input.payload ? JSON.stringify(input.payload) : null,
            JSON.stringify(input.recipeIds),
            now,
            now,
          ],
        );
        const row = db.get<ExportRow>(`SELECT * FROM compat_export_packs WHERE id = ?`, [id]);
        if (!row) {
          throw new Error('Failed to create compat export pack');
        }
        return mapCompatExportPack(row);
      }, 'Could not save export pack');
    },

    getExportPack(id: string): CompatExportPack | null {
      const row = db.get<ExportRow>(`SELECT * FROM compat_export_packs WHERE id = ?`, [id]);
      return row ? mapCompatExportPack(row) : null;
    },
  };
}

export type CompatRepository = ReturnType<typeof createCompatRepository>;
