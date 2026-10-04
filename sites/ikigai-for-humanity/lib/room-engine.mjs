const CATEGORIES = ['love', 'strength', 'opportunity', 'need'];
const DAY = 86400000;

export class RoomError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
function fail(message, status) { throw new RoomError(message, status); }
function text(value, label, min, max) {
  if (typeof value !== 'string') fail(`${label} is required.`);
  const result = value.trim();
  if (result.length < min || result.length > max) fail(`${label} must be ${min}–${max} characters.`);
  return result;
}
function integer(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) fail(`Choose a valid ${label}.`);
  return value;
}
export function validCode(value) {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!/^[A-Z0-9]{6}$/.test(code)) fail('Enter the six-character room code.');
  return code;
}
export function validateConfig(input) {
  if (!input || !['deep', 'quick', 'custom'].includes(input.mode) || !['own', 'premade'].includes(input.source)) fail('Choose a valid game mode.');
  if ((input.mode === 'deep' && input.source !== 'own') || (input.mode === 'quick' && input.source !== 'premade')) fail('Activity source does not match the game mode.');
  const config = {
    mode: input.mode, source: input.source,
    playerCount: integer(input.playerCount, 2, 8, 'number of players'),
    itemsPerCategory: integer(input.itemsPerCategory, 1, 8, 'activity count'),
    roundCount: integer(input.roundCount, 1, 24, 'round count'), roundCardCounts: {},
  };
  for (const category of CATEGORIES) config.roundCardCounts[category] = integer(input.roundCardCounts?.[category], 0, config.itemsPerCategory, 'prompt card count');
  if (!Object.values(config.roundCardCounts).some(Boolean)) fail('Choose at least one prompt card.');
  return config;
}
export function newCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), value => alphabet[value % alphabet.length]).join('');
}
const id = () => crypto.randomUUID();
function shuffled(values) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
export function createRoom(session, args, code = newCode(), now = Date.now()) {
  if (!session) fail('Reload to reconnect your browser.', 401);
  return {
    code: validCode(code), title: text(args.p_title || 'Career Possibilities', 'Gathering name', 1, 48),
    config: validateConfig(args.p_config), hostSession: session, status: 'lobby',
    createdAt: now, expiresAt: now + 30 * DAY,
    players: [{ id: id(), session, name: text(args.p_name, 'Your name', 1, 24), seat: 1, activitiesReady: false, activities: [] }],
    turns: [],
  };
}
function assertLive(room, now) {
  if (!room || room.expiresAt <= now) fail('That room was not found or has expired.', 404);
}
function member(room, session) {
  const me = room.players.find(player => player.session === session);
  if (!me) fail('Join this room first.', 403);
  return me;
}
function host(room, session) { member(room, session); if (room.hostSession !== session) fail('Only the host can do that.', 403); }
function phase(room, expected) { if (room.status !== expected) fail('The game has moved on. Refresh to continue.', 409); }
function targetTurn(room, turnId, me) {
  const turn = room.turns.find(candidate => candidate.id === turnId);
  if (!turn) fail('That turn was not found.', 404);
  if (turn.targetId !== me.id) fail('Only the active player can do that.', 403);
  return turn;
}
function startTurn(room) {
  const number = room.turns.length + 1;
  const target = room.players[(number - 1) % room.players.length];
  const cards = CATEGORIES.flatMap(category => shuffled(target.activities.filter(card => card.category === category)).slice(0, room.config.roundCardCounts[category]));
  room.turns.push({ id: `${room.code}_${id()}`, number, tableRound: Math.floor((number - 1) / room.players.length) + 1, targetId: target.id, status: 'submitting', cards, ideas: [], winnerId: null, keepIds: [] });
}

// The caller saves this transition with a compare-and-swap on the room version.
// Each transition is re-evaluated after a conflict, so two final submissions cannot race.
export function applyAction(original, session, name, args = {}, now = Date.now()) {
  assertLive(original, now);
  const room = structuredClone(original);
  let changed = true;
  if (name === 'join_ikigai_room') {
    if (room.players.some(player => player.session === session)) return { room, changed: false, data: null };
    phase(room, 'lobby');
    const playerName = text(args.p_name, 'Your name', 1, 24);
    if (room.players.some(player => player.name.toLowerCase() === playerName.toLowerCase())) fail('That name is already taken in this room.');
    if (room.players.length >= room.config.playerCount) fail('This room is full.');
    room.players.push({ id: id(), session, name: playerName, seat: room.players.length + 1, activitiesReady: false, activities: [] });
  } else {
    const me = member(room, session);
    if (name === 'start_ikigai_room') {
      host(room, session);
      if (room.status !== 'lobby') return { room, changed: false, data: null };
      if (room.players.length !== room.config.playerCount) fail('Wait for every player to join.');
      room.status = 'activities';
    } else if (name === 'configure_ikigai_room') {
      host(room, session); phase(room, 'lobby');
      room.config = validateConfig({ ...args.p_config, playerCount: room.config.playerCount });
    } else if (name === 'submit_ikigai_activities') {
      if (me.activitiesReady) return { room, changed: false, data: null };
      phase(room, 'activities');
      const active = CATEGORIES.filter(category => room.config.roundCardCounts[category] > 0);
      const rows = args.p_activities;
      if (!Array.isArray(rows) || rows.length !== active.length * room.config.itemsPerCategory) fail('Complete every activity in the active categories.');
      const seen = new Set(), titles = new Set();
      me.activities = rows.map(row => {
        if (!row || !active.includes(row.category)) fail('Choose an active activity category.');
        const ordinal = integer(row.ordinal, 1, room.config.itemsPerCategory, 'activity position');
        const title = text(row.title, 'Each activity', 2, 80);
        const key = `${row.category}:${ordinal}`, titleKey = `${row.category}:${title.toLowerCase()}`;
        if (seen.has(key) || titles.has(titleKey)) fail('Make each activity distinct within its category.');
        seen.add(key); titles.add(titleKey);
        return { category: row.category, ordinal, title };
      });
      for (const category of active) if (me.activities.filter(card => card.category === category).length !== room.config.itemsPerCategory) fail('Complete every active category.');
      me.activitiesReady = true;
    } else if (name === 'begin_ikigai_game') {
      host(room, session);
      if (room.status === 'playing' || room.status === 'complete') return { room, changed: false, data: null };
      phase(room, 'activities');
      if (!room.players.every(player => player.activitiesReady)) fail('Wait for everyone to finish their activities.');
      room.status = 'playing'; startTurn(room);
    } else if (name === 'submit_ikigai_idea') {
      const turn = room.turns.find(candidate => candidate.id === args.p_turn_id);
      if (!turn) fail('That turn was not found.', 404);
      if (turn.targetId === me.id) fail('Only the friends can submit an idea.', 403);
      const body = text(args.p_body, 'Your idea', 12, 700);
      const previous = turn.ideas.find(idea => idea.authorId === me.id);
      if (previous) {
        if (previous.body !== body) fail('Your idea is already sealed.', 409);
        return { room, changed: false, data: null };
      }
      phase(room, 'playing');
      if (turn.status !== 'submitting') fail('Idea writing is closed.', 409);
      turn.ideas.push({ id: id(), authorId: me.id, body });
      if (turn.ideas.length === room.players.length - 1) { turn.ideas = shuffled(turn.ideas); turn.status = 'voting'; }
    } else if (name === 'cast_ikigai_vote') {
      const turn = targetTurn(room, args.p_turn_id, me);
      if (turn.winnerId) {
        if (turn.winnerId !== args.p_idea_id) fail('You have already chosen a path.', 409);
        return { room, changed: false, data: null };
      }
      phase(room, 'playing');
      if (turn.status !== 'voting') fail('The ideas are not ready for reflection.', 409);
      if (!turn.ideas.some(idea => idea.id === args.p_idea_id)) fail('Choose an idea from this turn.');
      turn.winnerId = args.p_idea_id; turn.keepIds = [args.p_idea_id]; turn.status = 'result';
    } else if (name === 'complete_ikigai_turn') {
      const turn = targetTurn(room, args.p_turn_id, me);
      if (turn.status === 'complete') return { room, changed: false, data: null };
      phase(room, 'playing');
      if (turn.status !== 'result') fail('Choose a path before saving the turn.', 409);
      const keepIds = args.p_keep_ids === undefined ? turn.keepIds : args.p_keep_ids;
      if (!Array.isArray(keepIds) || keepIds.length > turn.ideas.length || keepIds.some(value => typeof value !== 'string' || !turn.ideas.some(idea => idea.id === value))) fail('Choose ideas from this turn to keep exploring.');
      turn.keepIds = [...new Set(keepIds)]; turn.status = 'complete';
      if (room.turns.length >= room.config.playerCount * room.config.roundCount) room.status = 'complete';
      else startTurn(room);
    } else fail('Unknown room action.', 404);
  }
  return { room, changed, data: null };
}

export function roomSnapshot(room, session, now = Date.now()) {
  assertLive(room, now);
  const me = member(room, session), turn = room.turns.find(candidate => candidate.status !== 'complete');
  const publicPlayer = player => ({ id: player.id, name: player.name, seat: player.seat, activitiesReady: player.activitiesReady });
  const safeIdea = (idea, current) => ({ id: idea.id, body: idea.body, keep: current.keepIds.includes(idea.id), chosen: current.winnerId === idea.id });
  let current = null;
  if (turn) {
    const target = room.players.find(player => player.id === turn.targetId);
    const isTarget = me.id === turn.targetId;
    const visible = isTarget && ['voting', 'result'].includes(turn.status);
    current = {
      id: turn.id, number: turn.number, tableRound: turn.tableRound, status: turn.status,
      targetId: turn.targetId, targetName: target.name, isTarget,
      neededCount: room.players.length - 1, mySubmitted: turn.ideas.some(idea => idea.authorId === me.id),
      cards: turn.cards, options: visible ? turn.ideas.map(idea => safeIdea(idea, turn)) : [],
      winner: visible ? turn.ideas.find(idea => idea.id === turn.winnerId)?.body || null : null,
    };
  }
  return {
    room: { code: room.code, title: room.title, config: room.config, status: room.status, isHost: room.hostSession === session },
    me: publicPlayer(me), players: room.players.map(publicPlayer), turn: current,
    results: room.status === 'complete' ? room.turns.map(item => ({
      turnNumber: item.number, tableRound: item.tableRound,
      targetName: room.players.find(player => player.id === item.targetId).name,
      winner: item.ideas.find(idea => idea.id === item.winnerId)?.body || null,
      cards: item.cards, ideas: item.ideas.map(idea => safeIdea(idea, item)),
    })) : [],
  };
}

export function actionCode(name, args) {
  return validCode(['submit_ikigai_idea', 'cast_ikigai_vote', 'complete_ikigai_turn'].includes(name)
    ? (typeof args.p_turn_id === 'string' ? args.p_turn_id.split('_')[0] : '') : args.p_code);
}

export async function transitionWithRetry(store, code, session, name, args, attempts = 16) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const row = await store.read(code);
    if (!row) fail('That room was not found or has expired.', 404);
    const next = applyAction(JSON.parse(row.state), session, name, args);
    if (!next.changed || await store.compareAndSwap(code, row.version, JSON.stringify(next.room))) return next.data;
  }
  fail('The room is busy. Please try that action again.', 409);
}
