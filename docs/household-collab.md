# Household collaboration (P2-W3)

Membership UX and **real-time grocery syncing** for shared households. Builds on published `@/data` contracts from P2-W1 (auth/sync) and P2-W2 (households + tenant fields).

## Invite / join

```ts
import { createHouseholdCollaboration, getRepositories } from '@/data';
// or: import { createHouseholdCollaboration } from '@/features/household';

const collab = createHouseholdCollaboration(getRepositories());
const home = collab.createHousehold({
  name: 'Our Kitchen',
  ownerUserId: user.id,
  ownerDisplayName: user.displayName,
});
// home.inviteCode — share out of band

const joined = collab.joinByInviteCode({
  inviteCode: pastedCode,
  userId: user.id,
  displayName: user.displayName,
});
```

Invite codes are normalized (trim + uppercase). Unknown codes fail with a generic invalid/expired message — never with another household’s rows.

## Shared grocery reads (authz)

```ts
collab.listSharedGroceryLists({ householdId, userId });
collab.getSharedGroceryList({ listId, userId });
```

Non-members receive `HouseholdAuthzError` (`code: HOUSEHOLD_AUTHZ_DENIED`) with a generic message. Denial paths must not echo foreign list/item bodies (see `SECURITY.md` §6 / §11).

## Real-time grocery channel

```ts
import {
  createGroceryRealtimeHub,
  createInMemoryGroceryRealtimeTransport,
} from '@/data';

const hub = createGroceryRealtimeHub({
  transport: createInMemoryGroceryRealtimeTransport(), // replace behind SyncTransport-era backend
  collaboration: collab,
  grocery: getRepositories().grocery,
});

await hub.subscribe({ householdId, userId, tokens, onEvent });
await hub.publishItemUpsert({ householdId, userId, listId, item, tokens });
hub.applyEvent(event); // local SQLite apply with conflict policy
```

Subscribe/publish **assert active membership** before touching the transport (client filter is not authorization; server must enforce the same when a real backend lands).

## Conflict policy

See `GROCERY_CONFLICT_POLICY` in `data/sync/groceryConflict.ts`:

| Rule | Behavior |
| --- | --- |
| Strategy | **Last-write-wins** per grocery item |
| Clock | `updatedAtIso` (later wins) |
| Tie-breaker | Higher `revision` |
| Distinct ids | **Merge** (both apply) |
| Soft-delete | Treated as a write under the same LWW rules |

Documented constant + `resolveGroceryItemConflict` / `shouldApplyRemoteGroceryWrite` are the contract for apply paths and tests.

## Out of scope

Pantry search (P2-W4), Paprika I/O (P2-W6), browser extension (P2-W7), Phase 3 social/delivery.
