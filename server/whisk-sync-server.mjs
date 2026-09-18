/**
 * Whisk sync HTTP server — shared cloud for real multi-device sessions.
 *
 * Run: `npm run sync-server`
 * Point the app at it with EXPO_PUBLIC_WHISK_SYNC_URL=http://localhost:8787
 *
 * This mirrors data/sync/cloudBackend.ts for processes that cannot share memory
 * (two phones, Expo Go + simulator). Prefer Supabase Auth + RLS for production
 * (SECURITY.md §6); this server makes cross-device sync/unlock real in Phase 2.
 */

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';

const PORT = Number(process.env.WHISK_SYNC_PORT || 8787);

/** @typedef {{ id: string, email: string, displayName: string | null, password: string }} User */
/** @typedef {{ accessToken: string, refreshToken: string, userId: string }} Session */
/** @typedef {{ kind: string, remoteId: string, localId: string, userId: string, householdId: string | null, revision: number, body: Record<string, unknown>, updatedAtIso: string }} Entity */
/** @typedef {{ id: string, name: string, ownerUserId: string, inviteCode: string, members: Array<{ userId: string, displayName: string | null, role: string, status: string }>, updatedAtIso: string }} Household */
/** @typedef {{ userId: string, entitlement: string, updatedAtIso: string }} Entitlement */

/** @type {Map<string, User>} */
const usersByEmail = new Map();
/** @type {Map<string, User>} */
const usersById = new Map();
/** @type {Map<string, Session>} */
const sessions = new Map();
/** @type {Map<string, Entity>} */
const entities = new Map();
/** @type {Map<string, Household>} */
const householdsById = new Map();
/** @type {Map<string, string>} */
const householdsByInvite = new Map();
/** @type {Map<string, Entitlement>} */
const entitlements = new Map();
/** @type {Map<string, Array<unknown>>} */
const groceryEvents = new Map();

function nowIso() {
  return new Date().toISOString();
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function bearer(req) {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] ?? null;
}

function requireUser(req) {
  const token = bearer(req);
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  return usersById.get(session.userId) ?? null;
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    json(res, 204, {});
    return;
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const path = url.pathname;

  try {
    if (req.method === 'GET' && path === '/health') {
      json(res, 200, { ok: true, service: 'whisk-sync' });
      return;
    }

    if (req.method === 'POST' && path === '/auth/sign-in') {
      const body = await readBody(req);
      const email = String(body.email || '')
        .trim()
        .toLowerCase();
      const password = String(body.password || '');
      if (!email || !password) {
        json(res, 400, { error: 'Email and password are required.' });
        return;
      }
      let user = usersByEmail.get(email);
      if (!user) {
        user = {
          id: randomUUID(),
          email,
          displayName: email.split('@')[0] || null,
          password,
        };
        usersByEmail.set(email, user);
        usersById.set(user.id, user);
      } else if (user.password !== password) {
        json(res, 401, { error: 'Invalid email or password.' });
        return;
      }
      const tokens = {
        accessToken: `access-${randomUUID()}`,
        refreshToken: `refresh-${randomUUID()}`,
        expiresAtIso: null,
      };
      sessions.set(tokens.accessToken, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        userId: user.id,
      });
      json(res, 200, {
        user: { id: user.id, email: user.email, displayName: user.displayName },
        tokens,
      });
      return;
    }

    if (req.method === 'POST' && path === '/auth/sign-out') {
      const token = bearer(req);
      if (token) sessions.delete(token);
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && path === '/auth/me') {
      const user = requireUser(req);
      if (!user) {
        json(res, 401, { error: 'Unauthorized' });
        return;
      }
      json(res, 200, { id: user.id, email: user.email, displayName: user.displayName });
      return;
    }

    if (req.method === 'POST' && path === '/sync/push') {
      const user = requireUser(req);
      if (!user) {
        json(res, 401, { error: 'Unauthorized' });
        return;
      }
      const body = await readBody(req);
      const accepted = [];
      const rejected = [];
      const stamp = nowIso();
      for (const item of body.items || []) {
        const key = `${user.id}:${item.kind}:${item.localId}`;
        const existing = entities.get(key);
        if (existing && existing.revision > item.revision) {
          rejected.push({ localId: item.localId, reason: 'stale_revision' });
          continue;
        }
        entities.set(key, {
          kind: item.kind,
          remoteId: existing?.remoteId ?? `remote-${item.kind}-${item.localId}`,
          localId: item.localId,
          userId: user.id,
          householdId: body.householdId ?? null,
          revision: item.revision,
          body: item.body,
          updatedAtIso: stamp,
        });
        accepted.push(item.localId);
      }
      json(res, 200, { accepted, rejected });
      return;
    }

    if (req.method === 'POST' && path === '/sync/pull') {
      const user = requireUser(req);
      if (!user) {
        json(res, 401, { error: 'Unauthorized' });
        return;
      }
      const body = await readBody(req);
      const since = body.sinceIso ? Date.parse(body.sinceIso) : null;
      const items = [];
      for (const entity of entities.values()) {
        if (entity.userId !== user.id) continue;
        if (body.householdId && entity.householdId !== body.householdId) continue;
        if (!body.householdId && entity.householdId != null) continue;
        if (since != null) {
          const updated = Date.parse(entity.updatedAtIso);
          if (Number.isFinite(updated) && updated <= since) continue;
        }
        items.push({
          kind: entity.kind,
          remoteId: entity.remoteId,
          localId: entity.localId,
          revision: entity.revision,
          body: entity.body,
          updatedAtIso: entity.updatedAtIso,
        });
      }
      json(res, 200, { items, serverTimeIso: nowIso() });
      return;
    }

    if (req.method === 'POST' && path === '/households/register') {
      const user = requireUser(req);
      if (!user) {
        json(res, 401, { error: 'Unauthorized' });
        return;
      }
      const body = await readBody(req);
      const invite = String(body.inviteCode || '')
        .trim()
        .toUpperCase();
      const household = {
        id: body.id,
        name: body.name,
        ownerUserId: body.ownerUserId || user.id,
        inviteCode: invite,
        members: body.members || [],
        updatedAtIso: nowIso(),
      };
      householdsById.set(household.id, household);
      householdsByInvite.set(invite, household.id);
      json(res, 200, household);
      return;
    }

    if (req.method === 'POST' && path === '/households/join') {
      const user = requireUser(req);
      if (!user) {
        json(res, 401, { error: 'Unauthorized' });
        return;
      }
      const body = await readBody(req);
      const invite = String(body.inviteCode || '')
        .trim()
        .toUpperCase();
      const id = householdsByInvite.get(invite);
      if (!id) {
        json(res, 404, { error: 'Invite code is invalid or expired.' });
        return;
      }
      const household = householdsById.get(id);
      if (!household) {
        json(res, 404, { error: 'Invite code is invalid or expired.' });
        return;
      }
      const members = household.members.filter((m) => m.userId !== user.id);
      members.push({
        userId: user.id,
        displayName: body.displayName ?? user.displayName,
        role: 'member',
        status: 'active',
      });
      const next = { ...household, members, updatedAtIso: nowIso() };
      householdsById.set(id, next);
      json(res, 200, next);
      return;
    }

    if (req.method === 'GET' && path === '/households/invite') {
      const invite = String(url.searchParams.get('code') || '')
        .trim()
        .toUpperCase();
      const id = householdsByInvite.get(invite);
      const household = id ? householdsById.get(id) : null;
      if (!household) {
        json(res, 404, { error: 'Invite code is invalid or expired.' });
        return;
      }
      json(res, 200, household);
      return;
    }

    if (req.method === 'POST' && path === '/grocery/publish') {
      const user = requireUser(req);
      if (!user) {
        json(res, 401, { error: 'Unauthorized' });
        return;
      }
      const body = await readBody(req);
      const event = body.event;
      if (!event?.householdId) {
        json(res, 400, { error: 'Missing event' });
        return;
      }
      const list = groceryEvents.get(event.householdId) || [];
      list.push(event);
      groceryEvents.set(event.householdId, list);
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && path === '/grocery/poll') {
      const user = requireUser(req);
      if (!user) {
        json(res, 401, { error: 'Unauthorized' });
        return;
      }
      const householdId = url.searchParams.get('householdId') || '';
      const since = Number(url.searchParams.get('since') || 0);
      const list = groceryEvents.get(householdId) || [];
      json(res, 200, { events: list.slice(since), nextIndex: list.length });
      return;
    }

    if (req.method === 'GET' && path === '/entitlements/me') {
      const user = requireUser(req);
      if (!user) {
        json(res, 401, { error: 'Unauthorized' });
        return;
      }
      json(res, 200, {
        entitlement: entitlements.get(user.id)?.entitlement ?? 'free',
      });
      return;
    }

    if (req.method === 'POST' && path === '/entitlements/me') {
      const user = requireUser(req);
      if (!user) {
        json(res, 401, { error: 'Unauthorized' });
        return;
      }
      const body = await readBody(req);
      const entitlement = body.entitlement === 'unlocked' || body.entitlement === 'admin' ? body.entitlement : 'free';
      entitlements.set(user.id, {
        userId: user.id,
        entitlement,
        updatedAtIso: nowIso(),
      });
      json(res, 200, { entitlement });
      return;
    }

    json(res, 404, { error: 'Not found' });
  } catch (error) {
    json(res, 500, {
      error: error instanceof Error ? error.message : 'Server error',
    });
  }
});

server.listen(PORT, () => {
  console.log(`Whisk sync server listening on http://localhost:${PORT}`);
});
