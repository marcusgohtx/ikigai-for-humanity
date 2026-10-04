import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createRoomStore, splitState } from '../lib/room-store.mjs';
import { createRoom, transitionWithRetry } from '../lib/room-engine.mjs';

function database() {
  const sql = new DatabaseSync(':memory:');
  sql.exec('CREATE TABLE rooms (code TEXT PRIMARY KEY, state TEXT NOT NULL, version INTEGER NOT NULL, updated_at INTEGER NOT NULL)');
  const db = {
    sql,
    prepare(query) {
      return {
        bind(...values) {
          return {
            query, values,
            all: async () => ({ results: sql.prepare(query).all(...values) }),
            first: async () => sql.prepare(query).get(...values) || null,
            run: async () => ({ meta: { changes: Number(sql.prepare(query).run(...values).changes) } }),
          };
        },
      };
    },
    async batch(statements) {
      sql.exec('BEGIN TRANSACTION');
      try {
        const result = statements.map(statement => ({ meta: { changes: Number(sql.prepare(statement.query).run(...statement.values).changes) } }));
        sql.exec('COMMIT'); return result;
      } catch (error) { sql.exec('ROLLBACK'); throw error; }
    },
  };
  return db;
}
const config = { mode: 'custom', source: 'own', playerCount: 8, itemsPerCategory: 8, roundCount: 24, roundCardCounts: { love: 8, strength: 8, opportunity: 8, need: 8 } };
function seed(db) {
  const room = createRoom('host-session', { p_name: 'Host', p_config: config }, 'TST234');
  db.sql.prepare('INSERT INTO rooms VALUES (?, ?, 0, ?)').run(room.code, JSON.stringify(room), Date.now());
  return room;
}

test('chunk boundaries preserve Unicode surrogate pairs and stay below the D1 row limit', () => {
  const value = `${'a'.repeat(199999)}🌱${'漢'.repeat(230000)}${'\u0000'.repeat(1000)}`;
  const chunks = splitState(value);
  assert.equal(chunks.join(''), value);
  for (const chunk of chunks) {
    assert.equal(new TextDecoder().decode(new TextEncoder().encode(chunk)), chunk);
    assert.ok(new TextEncoder().encode(JSON.stringify({ chunk })).byteLength < 1000000);
  }
});

test('stale D1 CAS cannot replace or delete the winning room parts', async () => {
  const db = database(), room = seed(db), store = createRoomStore(db);
  const old = await store.read(room.code);
  const winner = JSON.stringify({ ...room, title: 'Winning write', filler: '漢'.repeat(800000) });
  const loser = JSON.stringify({ ...room, title: 'Stale write', filler: 'x' });
  const outcomes = await Promise.all([store.compareAndSwap(room.code, old.version, winner), store.compareAndSwap(room.code, old.version, loser)]);
  assert.deepEqual(outcomes, [true, false]);
  const read = await store.read(room.code);
  assert.equal(read.state, winner);
  assert.equal(read.version, 1);
  assert.equal(await store.compareAndSwap(room.code, 1, loser), true);
  assert.equal((await store.read(room.code)).state, loser);
  assert.equal(db.sql.prepare('SELECT count(*) AS n FROM rooms').get().n, 2, 'shorter writes remove obsolete parts');
  db.sql.close();
});

test('D1 adapter serializes eight concurrent joins without duplicate seats', async () => {
  const db = database(), room = seed(db), store = createRoomStore(db);
  await Promise.all(Array.from({ length: 7 }, (_, i) => transitionWithRetry(store, room.code, `friend-${i}`, 'join_ikigai_room', { p_name: `Friend ${i}` })));
  const state = JSON.parse((await store.read(room.code)).state);
  assert.deepEqual(state.players.map(player => player.seat), [1, 2, 3, 4, 5, 6, 7, 8]);
  db.sql.close();
});

test('maximum custom game with escaped text fits across small rows and survives readback', async () => {
  const db = database(), room = seed(db), store = createRoomStore(db);
  const cards = Array.from({ length: 32 }, (_, n) => ({ category: ['love', 'strength', 'opportunity', 'need'][n % 4], ordinal: n % 8 + 1, title: '\u0000'.repeat(80) }));
  const turns = Array.from({ length: 192 }, (_, n) => ({ id: `${room.code}_${crypto.randomUUID()}`, number: n + 1, tableRound: Math.floor(n / 8) + 1, targetId: crypto.randomUUID(), status: 'complete', cards, ideas: Array.from({ length: 7 }, () => ({ id: crypto.randomUUID(), authorId: crypto.randomUUID(), body: '\u0000'.repeat(700) })), winnerId: crypto.randomUUID(), keepIds: [] }));
  const full = JSON.stringify({ ...room, turns, status: 'complete' });
  assert.ok(full.length > 8000000, 'exercise the worst JSON escaping expansion');
  assert.equal(await store.compareAndSwap(room.code, 0, full), true);
  const rows = db.sql.prepare('SELECT state FROM rooms').all();
  assert.ok(rows.length <= 48, 'the transaction stays bounded even for the largest game');
  for (const row of rows) assert.ok(new TextEncoder().encode(row.state).byteLength < 1000000);
  assert.equal((await store.read(room.code)).state, full);
  assert.equal(JSON.parse((await store.read(room.code)).state).turns.length, 192);
  db.sql.close();
});

test('expiry cleanup removes a room and every private chunk', async () => {
  const db = database(), room = seed(db), store = createRoomStore(db);
  const expired = JSON.stringify({ ...room, expiresAt: Date.now() - 1, filler: 'x'.repeat(450000) });
  await store.compareAndSwap(room.code, 0, expired);
  db.sql.prepare("DELETE FROM rooms WHERE substr(code, 1, 6) IN (SELECT code FROM rooms WHERE length(code) = 6 AND json_extract(state, '$.expiresAt') <= ? LIMIT 100)").run(Date.now());
  assert.equal(db.sql.prepare('SELECT count(*) AS n FROM rooms').get().n, 0);
  db.sql.close();
});
