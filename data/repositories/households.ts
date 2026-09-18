import type {
  Household,
  HouseholdMember,
  HouseholdMemberRole,
  HouseholdWithMembers,
} from '@/data/contracts';
import type { DbClient } from '@/data/client';
import { mapHousehold, mapHouseholdMember } from '@/data/mappers';
import { withLocalPersist } from '@/data/sync/statusStore';
import { createId, nowIso } from '@/data/util';

type HouseholdRow = Parameters<typeof mapHousehold>[0];
type MemberRow = Parameters<typeof mapHouseholdMember>[0];

function hydrate(db: DbClient, household: Household): HouseholdWithMembers {
  const members = db
    .all<MemberRow>(
      `SELECT * FROM household_members
       WHERE household_id = ? AND status != 'removed'
       ORDER BY
         CASE role WHEN 'owner' THEN 0 WHEN 'member' THEN 1 ELSE 2 END,
         created_at ASC`,
      [household.id],
    )
    .map(mapHouseholdMember);
  return { ...household, members };
}

export function createHouseholdRepository(db: DbClient) {
  return {
    create(input: {
      name: string;
      ownerUserId?: string | null;
      ownerDisplayName?: string | null;
      inviteCode?: string | null;
    }): HouseholdWithMembers {
      return withLocalPersist(() => {
        const id = createId();
        const now = nowIso();
        const ownerUserId = input.ownerUserId ?? null;
        return db.withTransaction(() => {
          db.run(
            `INSERT INTO households (
              id, name, owner_user_id, invite_code, created_at, updated_at,
              deleted_at, local_revision, sync_status, remote_id
            ) VALUES (?, ?, ?, ?, ?, ?, NULL, 1, 'synced_local', NULL)`,
            [id, input.name.trim(), ownerUserId, input.inviteCode ?? null, now, now],
          );
          if (ownerUserId) {
            db.run(
              `INSERT INTO household_members (
                id, household_id, user_id, display_name, role, status, created_at, updated_at
              ) VALUES (?, ?, ?, ?, 'owner', 'active', ?, ?)`,
              [
                createId(),
                id,
                ownerUserId,
                input.ownerDisplayName ?? null,
                now,
                now,
              ],
            );
          }
          const row = db.get<HouseholdRow>(`SELECT * FROM households WHERE id = ?`, [id]);
          if (!row) {
            throw new Error('Failed to create household');
          }
          return hydrate(db, mapHousehold(row));
        });
      }, 'Could not save household');
    },

    getById(id: string): HouseholdWithMembers | null {
      const row = db.get<HouseholdRow>(
        `SELECT * FROM households WHERE id = ? AND deleted_at IS NULL`,
        [id],
      );
      return row ? hydrate(db, mapHousehold(row)) : null;
    },

    list(): Household[] {
      return db
        .all<HouseholdRow>(
          `SELECT * FROM households WHERE deleted_at IS NULL ORDER BY updated_at DESC`,
        )
        .map(mapHousehold);
    },

    addMember(input: {
      householdId: string;
      userId?: string | null;
      displayName?: string | null;
      role?: HouseholdMemberRole;
      status?: 'active' | 'invited';
    }): HouseholdMember {
      return withLocalPersist(() => {
        const household = db.get<HouseholdRow>(
          `SELECT * FROM households WHERE id = ? AND deleted_at IS NULL`,
          [input.householdId],
        );
        if (!household) {
          throw new Error(`Household not found: ${input.householdId}`);
        }
        const id = createId();
        const now = nowIso();
        const role = input.role ?? 'member';
        return db.withTransaction(() => {
          db.run(
            `INSERT INTO household_members (
              id, household_id, user_id, display_name, role, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              input.householdId,
              input.userId ?? null,
              input.displayName ?? null,
              role,
              input.status ?? 'active',
              now,
              now,
            ],
          );
          db.run(
            `UPDATE households SET updated_at = ?, local_revision = local_revision + 1,
              sync_status = 'synced_local' WHERE id = ?`,
            [now, input.householdId],
          );
          const row = db.get<MemberRow>(`SELECT * FROM household_members WHERE id = ?`, [id]);
          if (!row) {
            throw new Error('Failed to add household member');
          }
          return mapHouseholdMember(row);
        });
      }, 'Could not add household member');
    },

    softDelete(id: string): void {
      withLocalPersist(() => {
        const result = db.run(
          `UPDATE households SET deleted_at = ?, updated_at = ?, local_revision = local_revision + 1,
             sync_status = 'synced_local' WHERE id = ? AND deleted_at IS NULL`,
          [nowIso(), nowIso(), id],
        );
        if (result.changes === 0) {
          throw new Error(`Household not found: ${id}`);
        }
      }, 'Could not delete household');
    },
  };
}

export type HouseholdRepository = ReturnType<typeof createHouseholdRepository>;
