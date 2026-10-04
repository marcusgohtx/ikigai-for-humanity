import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const coreSource = readFileSync(new URL('../public/game-core.js', import.meta.url), 'utf8');
const roomSource = readFileSync(new URL('../public/room.js', import.meta.url), 'utf8');

async function browser(snapshot) {
  const app = { innerHTML: '' };
  const listeners = {};
  const fields = {};
  const requests = [];
  let copied;
  const context = vm.createContext({
    URL, URLSearchParams,
    document: {
      getElementById: id => id === 'app' ? app : fields[id],
      addEventListener: (type, callback) => { listeners[type] = callback; },
      querySelectorAll: () => [],
      createElement: () => ({ setAttribute() {}, remove() {} }),
      body: { append() {} }
    },
    location: { href: 'https://example.test/' },
    history: { replaceState() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    navigator: { clipboard: { writeText: async text => { copied = text; } } },
    setInterval: () => 1, clearInterval() {}, setTimeout() {},
    requestAnimationFrame: callback => callback(),
    fetch: async (_url, options) => {
      const request = options.body ? JSON.parse(options.body) : null;
      if (request) requests.push(request);
      return { ok: true, json: async () => ({ data: request?.name === 'ikigai_room_snapshot' ? snapshot : {} }) };
    }
  });
  context.window = context;
  context.scrollTo = () => {};
  vm.runInContext(coreSource, context);
  vm.runInContext(roomSource, context);
  if (snapshot) await context.IkigaiRoom.resume('ABC123');
  return {
    context, fields, requests,
    html: () => app.innerHTML,
    copied: () => copied,
    click: action => listeners.click({ target: { closest: () => ({ dataset: { roomAction: action } }) } })
  };
}

const paused = isHost => ({
  room: { code: 'ABC123', title: 'Career Possibilities', status: 'round_end', isHost, config: { playerCount: 3 } },
  roundEnd: { turnId: 'boundary-turn', number: 2 }, scores: [], results: []
});

test('all setup modes start with one round and expose no rounds control', async () => {
  const ui = await browser();
  assert.doesNotMatch(ui.context.IKIGAI_GAME.settingsMarkup('room'), /room-rounds|Table rounds|Two rounds/);
  for (const mode of ['deep', 'quick', 'custom']) {
    ui.fields['room-mode'] = { value: mode };
    assert.equal(ui.context.IKIGAI_GAME.readSettings('room').roundCount, 1);
  }
});

test('host boundary actions send the completed turn and decision', async () => {
  for (const [action, decision] of [['keep-playing', 'keep'], ['stop-playing', 'stop']]) {
    const ui = await browser(paused(true));
    assert.match(ui.html(), /Round 2 complete/);
    assert.match(ui.html(), />Keep playing<.*>Stop playing</s);
    assert.doesNotMatch(ui.html(), /Final votes|share the win|wins!/);
    await ui.click(action);
    const request = ui.requests.find(item => item.name === 'decide_ikigai_round');
    assert.deepEqual(request.args, { p_turn_id: 'boundary-turn', p_decision: decision });
  }
});

test('other players see waiting text without host controls or scores', async () => {
  const ui = await browser(paused(false));
  assert.match(ui.html(), /Waiting for the host/);
  assert.doesNotMatch(ui.html(), /data-room-action="(?:keep-playing|stop-playing)"|Final votes/);
});

test('final shared winners and cumulative votes appear in recap and copy', async () => {
  const snapshot = paused(true);
  snapshot.room.status = 'complete';
  snapshot.scores = [
    { id: 'a', name: 'Ari <3', votes: 3, winner: true },
    { id: 'b', name: 'Bo', votes: 3, winner: true },
    { id: 'c', name: 'Cam', votes: 0, winner: false }
  ];
  snapshot.results = [{ targetName: 'Ari <3', ideas: [{ body: 'Open a cafe', keep: true }, { body: 'Teach pottery', keep: false }] }];
  const ui = await browser(snapshot);
  assert.match(ui.html(), /Ari &lt;3 and Bo share the win!/);
  assert.match(ui.html(), /3 votes/);
  assert.match(ui.html(), /0 votes/);
  assert.match(ui.html(), /Open a cafe/);
  assert.match(ui.html(), /Teach pottery/);
  await ui.click('copy-room-summary');
  assert.match(ui.copied(), /Ari <3 and Bo share the win!\nAri <3: 3 votes\nBo: 3 votes\nCam: 0 votes/);
  assert.match(ui.copied(), /Keep exploring\n- Open a cafe\n\nIdea bank\n- Teach pottery/);
});

test('continued rounds show turn progress within the current round', async () => {
  const snapshot = paused(false);
  snapshot.room.status = 'playing';
  snapshot.turn = { id: 'next-turn', number: 4, tableRound: 2, status: 'submitting', isTarget: true, neededCount: 2, targetName: 'Ari', cards: [] };
  const ui = await browser(snapshot);
  assert.match(ui.html(), /Round 2 · Turn 1 of 3/);
});
