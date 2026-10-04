import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createRoomStore } from '../lib/room-store.mjs';

function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('CREATE TABLE rooms (code TEXT PRIMARY KEY, state TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL)');
  const queries = [];
  let failAt = -1;
  const db = {
    prepare(sql) {
      return { bind(...args) {
        return {
          sql, args,
          async all() { queries.push({ sql, args }); return { results: sqlite.prepare(sql).all(...args) }; },
          async first() { return sqlite.prepare(sql).get(...args); },
          async run() { const result = sqlite.prepare(sql).run(...args); return { meta: { changes: Number(result.changes) } }; },
        };
      } };
    },
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map((statement, index) => {
          if (index === failAt) throw new Error('Injected failure');
          const result = sqlite.prepare(statement.sql).run(...statement.args);
          return { meta: { changes: Number(result.changes) } };
        });
        sqlite.exec('COMMIT');
        return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  const seed = (code, state) => sqlite.prepare('INSERT INTO rooms (code, state, version, updated_at) VALUES (?, ?, 0, ?)').run(code, JSON.stringify(state), Date.now());
  return { sqlite, queries, seed, store: createRoomStore(db), failNextAt(index) { failAt = index; } };
}

const state = body => ({ hostSession: 'host-session', createdAt: 1, expiresAt: 9999999999999, body });

test('review: valid Unicode larger than a D1 row is stored in bounded chunks and reconstructed exactly', async () => {
  const f = fixture();
  const original = state('Initial room');
  f.seed('REV234', original);
  const large = JSON.stringify(state('界🙂\\\u0000'.repeat(450000)));
  assert.ok(Buffer.byteLength(large) > 2_000_000);
  assert.equal(await f.store.compareAndSwap('REV234', 0, large), true);
  assert.deepEqual(await f.store.read('REV234'), { state: large, version: 1 });
  for (const row of f.sqlite.prepare('SELECT state FROM rooms').all()) {
    assert.ok(Buffer.byteLength(row.state) < 2_000_000, 'each D1 row must stay below its 2 MB limit');
    assert.doesNotThrow(() => JSON.parse(row.state));
  }
  f.sqlite.close();
});

test('review: competing CAS writers cannot delete or overwrite the winning chunks', async () => {
  const f = fixture(); f.seed('REV234', state('Initial'));
  const first = JSON.stringify(state('Winning state '.repeat(30000)));
  const second = JSON.stringify(state('Losing state '.repeat(60000)));
  const outcomes = await Promise.all([
    f.store.compareAndSwap('REV234', 0, first),
    f.store.compareAndSwap('REV234', 0, second),
  ]);
  assert.deepEqual(outcomes, [true, false]);
  assert.deepEqual(await f.store.read('REV234'), { state: first, version: 1 });
  const small = JSON.stringify(state('Small replacement'));
  assert.equal(await f.store.compareAndSwap('REV234', 1, small), true);
  assert.deepEqual(await f.store.read('REV234'), { state: small, version: 2 });
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS total FROM rooms').get().total, 2, 'old chunks must be removed when the room shrinks');
  f.sqlite.close();
});

test('review: a failed D1 transaction preserves the old room and its version', async () => {
  const f = fixture(); f.seed('REV234', state('Initial'));
  const previous = JSON.stringify(state('Saved state '.repeat(30000)));
  await f.store.compareAndSwap('REV234', 0, previous);
  f.failNextAt(3);
  await assert.rejects(f.store.compareAndSwap('REV234', 1, JSON.stringify(state('Interrupted state '.repeat(30000)))), /Injected failure/);
  assert.deepEqual(await f.store.read('REV234'), { state: previous, version: 1 });
  f.sqlite.close();
});

test('review: room lookup uses the primary-key index without scanning all rooms', async () => {
  const f = fixture(); f.seed('REV234', state('Initial'));
  await f.store.read('REV234');
  const query = f.queries.at(-1);
  const plan = f.sqlite.prepare(`EXPLAIN QUERY PLAN ${query.sql}`).all(...query.args);
  assert.equal(plan.some(row => /\bSCAN rooms\b/.test(row.detail)), false, JSON.stringify(plan));
  f.sqlite.close();
});
