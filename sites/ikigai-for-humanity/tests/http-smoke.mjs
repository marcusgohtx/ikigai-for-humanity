import assert from 'node:assert/strict';

const origin = process.argv[2] || 'http://127.0.0.1:5173';
async function player(name) {
  const response = await fetch(`${origin}/api/rooms`);
  assert.equal(response.status, 200, 'session endpoint');
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie, 'server issues a browser session');
  assert.match(response.headers.get('set-cookie'), /HttpOnly/i);
  return {
    name,
    async call(action, args, expected = 200) {
      const response = await fetch(`${origin}/api/rooms`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
        body: JSON.stringify({ name: action, args }),
      });
      const result = await response.json();
      assert.equal(response.status, expected, `${action}: ${JSON.stringify(result.error || {})}`);
      return result.data;
    },
  };
}

const people = await Promise.all(['Ari test', 'Sam test', 'Riley test'].map(player));
const outsider = await player('Outsider');
const host = people[0];
const config = { mode: 'custom', source: 'own', playerCount: 3, itemsPerCategory: 1, roundCount: 1, roundCardCounts: { love: 1, strength: 0, opportunity: 0, need: 0 } };
const created = await host.call('create_ikigai_room', { p_name: host.name, p_title: 'Deployment check', p_config: config });
const code = created[0].code;
await Promise.all(people.slice(1).map(person => person.call('join_ikigai_room', { p_code: code, p_name: person.name })));
await outsider.call('ikigai_room_snapshot', { p_code: code }, 403);
await people[1].call('start_ikigai_room', { p_code: code }, 403);
await host.call('start_ikigai_room', { p_code: code });
await Promise.all(people.map(person => person.call('submit_ikigai_activities', { p_code: code, p_activities: [{ category: 'love', ordinal: 1, title: 'Helping friends learn new things' }] })));
await host.call('begin_ikigai_game', { p_code: code });
let firstBoundary;
for (let turnIndex = 0; turnIndex < 6; turnIndex++) {
  const snapshots = await Promise.all(people.map(person => person.call('ikigai_room_snapshot', { p_code: code })));
  const targetIndex = snapshots.findIndex(snapshot => snapshot.turn.isTarget);
  const target = people[targetIndex];
  const turnId = snapshots[targetIndex].turn.id;
  assert.deepEqual(snapshots[targetIndex].turn.options, []);
  await Promise.all(people.filter((_, index) => index !== targetIndex).map(person => person.call('submit_ikigai_idea', { p_turn_id: turnId, p_body: `Run small creative workshops with community groups, idea ${people.indexOf(person) + 1}.` })));
  const vote = await target.call('ikigai_room_snapshot', { p_code: code });
  assert.equal(vote.turn.options.length, 2);
  assert.ok(vote.turn.options.every(option => !('authorId' in option)));
  const friend = people[(targetIndex + 1) % 3];
  const hidden = await friend.call('ikigai_room_snapshot', { p_code: code });
  assert.deepEqual(hidden.turn.options, []);
  await friend.call('cast_ikigai_vote', { p_turn_id: turnId, p_idea_id: vote.turn.options[0].id }, 403);
  await target.call('cast_ikigai_vote', { p_turn_id: turnId, p_idea_id: vote.turn.options[0].id });
  await target.call('complete_ikigai_turn', { p_turn_id: turnId, p_keep_ids: [vote.turn.options[0].id] });
  await target.call('complete_ikigai_turn', { p_turn_id: turnId, p_keep_ids: [vote.turn.options[0].id] });
  if ((turnIndex + 1) % 3 === 0) {
    const paused = await host.call('ikigai_room_snapshot', { p_code: code });
    assert.equal(paused.room.status, 'round_end');
    assert.deepEqual(paused.scores, []);
    assert.deepEqual(paused.results, []);
    assert.equal(paused.roundEnd.turnId, turnId);
    const decision = { p_turn_id: turnId, p_decision: turnIndex === 2 ? 'keep' : 'stop' };
    await people[1].call('decide_ikigai_round', decision, 403);
    if (firstBoundary) {
      await host.call('decide_ikigai_round', firstBoundary);
      assert.equal((await host.call('ikigai_room_snapshot', { p_code: code })).room.status, 'round_end');
    } else firstBoundary = decision;
    await Promise.all([host.call('decide_ikigai_round', decision), host.call('decide_ikigai_round', decision)]);
  }
}
const recap = await host.call('ikigai_room_snapshot', { p_code: code });
assert.equal(recap.room.status, 'complete');
assert.equal(recap.results.length, 6);
assert.equal(recap.scores.reduce((sum, player) => sum + player.votes, 0), 6);
assert.ok(recap.scores.some(player => player.winner));
assert.ok(recap.results.every(result => result.ideas.length === 2 && result.ideas.filter(idea => idea.keep).length === 1));
assert.ok(!JSON.stringify(recap).includes('hostSession'));
console.log(`PASS ${origin}: 3 independent sessions, 2 rounds, host decisions, hidden cumulative votes, recap and stale retry safety.`);
