import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createRoom, roomSnapshot, transitionWithRetry, validateConfig } from '../lib/room-engine.mjs';

const config = (count = 3, rounds = 1) => ({ mode: 'custom', source: 'own', playerCount: count, itemsPerCategory: 2, roundCount: rounds, roundCardCounts: { love: 1, strength: 0, opportunity: 1, need: 0 } });
const activities = name => ['love', 'opportunity'].flatMap(category => [1, 2].map(ordinal => ({ category, ordinal, title: `${name} ${category} ${ordinal}` })));
function table(count = 3, rounds = 1) {
  let state = createRoom('session-0', { p_name: 'Player 0', p_title: 'Test table', p_config: config(count, rounds) }, 'TST234');
  const run = (index, name, args = {}) => { state = applyAction(state, `session-${index}`, name, args).room; return state; };
  for (let i = 1; i < count; i++) run(i, 'join_ikigai_room', { p_name: `Player ${i}` });
  return { get state() { return state; }, run, start() { run(0, 'start_ikigai_room'); for (let i = 0; i < count; i++) run(i, 'submit_ikigai_activities', { p_activities: activities(`Player ${i}`) }); run(0, 'begin_ikigai_game'); } };
}
function memoryStore(state) {
  let row = { state: JSON.stringify(state), version: 0 };
  return {
    read: async () => ({ ...row }),
    compareAndSwap: async (_code, version, next) => {
      await Promise.resolve();
      if (row.version !== version) return false;
      row = { state: next, version: version + 1 }; return true;
    },
    get state() { return JSON.parse(row.state); },
  };
}

test('concurrent joins assign unique seats and never overfill', async () => {
  const state = createRoom('session-0', { p_name: 'Host', p_config: config(8) }, 'TST234');
  const store = memoryStore(state);
  await Promise.all(Array.from({ length: 7 }, (_, n) => transitionWithRetry(store, state.code, `session-${n + 1}`, 'join_ikigai_room', { p_name: `Friend ${n + 1}` })));
  assert.deepEqual(store.state.players.map(player => player.seat), [1, 2, 3, 4, 5, 6, 7, 8]);
  await assert.rejects(transitionWithRetry(store, state.code, 'overflow', 'join_ikigai_room', { p_name: 'Overflow' }), /full/);
  await transitionWithRetry(store, state.code, 'session-1', 'join_ikigai_room', { p_name: 'Friend 1' });
  assert.equal(store.state.players.length, 8);
});

test('concurrent final submissions reveal one stable anonymous list', async () => {
  const game = table(8); game.start();
  const store = memoryStore(game.state), turnId = game.state.turns[0].id;
  await Promise.all(Array.from({ length: 7 }, (_, n) => transitionWithRetry(store, game.state.code, `session-${n + 1}`, 'submit_ikigai_idea', { p_turn_id: turnId, p_body: `This is a thoughtful idea from writer ${n + 1}.` })));
  assert.equal(store.state.turns[0].ideas.length, 7);
  assert.equal(store.state.turns[0].status, 'voting');
  const first = roomSnapshot(store.state, 'session-0'), second = roomSnapshot(store.state, 'session-0');
  assert.deepEqual(first.turn.options, second.turn.options);
  assert.equal(first.turn.options.length, 7);
  for (const option of first.turn.options) assert.deepEqual(Object.keys(option).sort(), ['body', 'chosen', 'id', 'keep']);
  assert.equal(roomSnapshot(store.state, 'session-1').turn.options.length, 0);
});

test('snapshots protect raw decks, author identities, early ideas and early results', () => {
  const game = table(); game.start();
  game.run(1, 'submit_ikigai_idea', { p_turn_id: game.state.turns[0].id, p_body: 'A private unpublished career idea.' });
  const snapshot = roomSnapshot(game.state, 'session-0');
  assert.deepEqual(snapshot.turn.options, []);
  assert.deepEqual(snapshot.results, []);
  assert.equal('submittedCount' in snapshot.turn, false);
  const serialized = JSON.stringify(snapshot);
  assert.equal(serialized.includes('session-'), false);
  assert.equal(serialized.includes('authorId'), false);
  assert.equal(serialized.includes('private unpublished'), false);
  assert.equal(serialized.includes('activities":'), false);
  assert.throws(() => roomSnapshot(game.state, 'stranger'), /Join this room first/);
});

test('all players finish multiple rounds with Keep exploring and Idea bank intact', () => {
  const game = table(3, 2); game.start();
  for (let turnNumber = 1; turnNumber <= 6; turnNumber++) {
    let turn = game.state.turns.at(-1);
    const targetIndex = (turnNumber - 1) % 3;
    for (let i = 0; i < 3; i++) if (i !== targetIndex) game.run(i, 'submit_ikigai_idea', { p_turn_id: turn.id, p_body: `Career idea for turn ${turnNumber} by friend ${i}.` });
    turn = game.state.turns.at(-1);
    const chosen = turn.ideas[0].id;
    game.run(targetIndex, 'cast_ikigai_vote', { p_turn_id: turn.id, p_idea_id: chosen });
    assert.equal(roomSnapshot(game.state, `session-${targetIndex}`).turn.options.length, 2);
    game.run(targetIndex, 'complete_ikigai_turn', { p_turn_id: turn.id, p_keep_ids: [chosen] });
    const count = game.state.turns.length;
    game.run(targetIndex, 'complete_ikigai_turn', { p_turn_id: turn.id, p_keep_ids: [chosen] });
    assert.equal(game.state.turns.length, count, 'retries must not create another turn');
  }
  const snapshot = roomSnapshot(game.state, 'session-2');
  assert.equal(snapshot.room.status, 'complete');
  assert.equal(snapshot.turn, null);
  assert.equal(snapshot.results.length, 6);
  assert.deepEqual(snapshot.results.map(result => result.tableRound), [1, 1, 1, 2, 2, 2]);
  for (const result of snapshot.results) {
    assert.equal(result.ideas.length, 2);
    assert.equal(result.ideas.filter(idea => idea.keep).length, 1);
    assert.equal(result.ideas.filter(idea => !idea.keep).length, 1);
    assert.equal(result.cards.length, 2);
  }
});

test('two-player direct reflection and identical request retries are safe', () => {
  const game = table(2); game.start();
  let turn = game.state.turns[0];
  const submission = { p_turn_id: turn.id, p_body: 'A friend can help explore this career.' };
  game.run(1, 'submit_ikigai_idea', submission);
  game.run(1, 'submit_ikigai_idea', submission);
  turn = game.state.turns[0];
  assert.equal(turn.ideas.length, 1);
  assert.equal(roomSnapshot(game.state, 'session-0').turn.neededCount, 1);
  game.run(0, 'cast_ikigai_vote', { p_turn_id: turn.id, p_idea_id: turn.ideas[0].id });
  game.run(0, 'cast_ikigai_vote', { p_turn_id: turn.id, p_idea_id: turn.ideas[0].id });
  game.run(0, 'complete_ikigai_turn', { p_turn_id: turn.id, p_keep_ids: [] });
  assert.equal(game.state.turns[0].keepIds.length, 0);
  assert.equal(game.state.turns.length, 2);
});

test('non-hosts, wrong targets, late joins and cross-room turn IDs are rejected', () => {
  const game = table();
  assert.throws(() => game.run(1, 'start_ikigai_room'), /Only the host/);
  game.start();
  assert.throws(() => game.run(9, 'join_ikigai_room', { p_name: 'Late friend' }), /moved on/);
  const turn = game.state.turns[0];
  assert.throws(() => game.run(0, 'submit_ikigai_idea', { p_turn_id: turn.id, p_body: 'An inappropriate self submission.' }), /Only the friends/);
  assert.throws(() => game.run(1, 'cast_ikigai_vote', { p_turn_id: turn.id, p_idea_id: 'fake' }), /Only the active/);
  assert.throws(() => game.run(0, 'complete_ikigai_turn', { p_turn_id: 'OTHER1_fake' }), /not found/);
  game.run(1, 'join_ikigai_room', { p_name: 'Original name' });
  assert.equal(game.state.players.length, 3, 'an existing browser can reconnect after starting');
});

test('invalid settings, decks and expired rooms cannot advance', () => {
  assert.throws(() => validateConfig({ ...config(), playerCount: 9 }), /number of players/);
  assert.throws(() => validateConfig({ ...config(), roundCardCounts: { love: 0, strength: 0, opportunity: 0, need: 0 } }), /at least one/);
  const game = table(); game.run(0, 'start_ikigai_room');
  assert.throws(() => game.run(0, 'submit_ikigai_activities', { p_activities: activities('x').slice(0, 3) }), /every activity/);
  const duplicates = activities('x'); duplicates[1].title = duplicates[0].title;
  assert.throws(() => game.run(0, 'submit_ikigai_activities', { p_activities: duplicates }), /distinct/);
  assert.throws(() => game.run(0, 'begin_ikigai_game'), /everyone to finish/);
  assert.throws(() => roomSnapshot(game.state, 'session-0', game.state.expiresAt), /expired/);
});
