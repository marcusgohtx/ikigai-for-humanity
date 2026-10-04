import { env } from 'cloudflare:workers';
import { actionCode, createRoom, newCode, RoomError, roomSnapshot, transitionWithRetry } from '../../../lib/room-engine.mjs';
import { createRoomStore } from '../../../lib/room-store.mjs';

const COOKIE = 'ikigai_session';
const LIMIT = 32768;
const allowed = new Set(['create_ikigai_room', 'join_ikigai_room', 'start_ikigai_room', 'configure_ikigai_room', 'submit_ikigai_activities', 'begin_ikigai_game', 'submit_ikigai_idea', 'cast_ikigai_vote', 'complete_ikigai_turn', 'ikigai_room_snapshot']);

function browserSession(request: Request) {
  const candidate = request.headers.get('cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  const existing = candidate && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate);
  return { id: existing ? candidate : crypto.randomUUID(), fresh: !existing };
}
function reply(request: Request, session: ReturnType<typeof browserSession>, body: unknown, status = 200) {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  headers.set('Set-Cookie', `${COOKIE}=${session.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`);
  return new Response(JSON.stringify(body), { status, headers });
}
async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new RoomError('That request could not be read.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > LIMIT) { await reader.cancel(); throw new RoomError('That request is too large.', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

export async function GET(request: Request) {
  return reply(request, browserSession(request), { ok: true });
}

export async function POST(request: Request) {
  const session = browserSession(request);
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) throw new RoomError('Open the game on its own site to continue.', 403);
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new RoomError('Send a JSON request.', 415);
    if (Number(request.headers.get('content-length') || 0) > LIMIT) throw new RoomError('That request is too large.', 413);
    const raw = await readBody(request);
    let body;
    try { body = JSON.parse(raw); } catch { throw new RoomError('That request could not be read.'); }
    if (!body || typeof body !== 'object' || !allowed.has(body.name) || !body.args || typeof body.args !== 'object' || Array.isArray(body.args)) throw new RoomError('Choose a valid room action.');
    const db = env.DB;
    if (!db) throw new RoomError('The room connection is unavailable. Please try again shortly.', 503);
    const name = body.name, args = body.args;
    const store = createRoomStore(db);
    let data;
    if (name === 'create_ikigai_room') {
      // Expired games should leave storage, even when nobody opens their old link.
      await db.prepare("DELETE FROM rooms WHERE substr(code, 1, 6) IN (SELECT code FROM rooms WHERE length(code) = 6 AND json_extract(state, '$.expiresAt') <= ? LIMIT 100)").bind(Date.now()).run();
      let created = false;
      for (let attempt = 0; attempt < 8; attempt++) {
        // The optional key makes a retried create request return the original room.
        let code = newCode();
        if (typeof body.requestId === 'string' && /^[A-Za-z0-9-]{16,80}$/.test(body.requestId)) {
          const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${session.id}:${body.requestId}:${attempt}`)));
          const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          code = Array.from(digest.slice(0, 6), value => alphabet[value % alphabet.length]).join('');
        }
        const room = createRoom(session.id, args, code);
        const previous = await store.read(code);
        if (previous && JSON.parse(previous.state).hostSession === session.id) { data = [{ code }]; created = true; break; }
        const recent = await db.prepare("SELECT COUNT(*) AS total FROM rooms WHERE json_extract(state, '$.hostSession') = ? AND json_extract(state, '$.createdAt') > ?").bind(session.id, Date.now() - 3600000).first<{ total: number }>();
        if ((recent?.total || 0) >= 12) throw new RoomError('You have created several rooms recently. Rejoin one of those rooms or try again in an hour.', 429);
        const result = await db.prepare('INSERT INTO rooms (code, state, version, updated_at) VALUES (?, ?, 0, ?) ON CONFLICT(code) DO NOTHING').bind(code, JSON.stringify(room), Date.now()).run();
        if (result.meta.changes === 1) { data = [{ code }]; created = true; break; }
        const concurrent = await store.read(code);
        if (concurrent && JSON.parse(concurrent.state).hostSession === session.id) { data = [{ code }]; created = true; break; }
      }
      if (!created) throw new RoomError('A room could not be created. Try again.', 503);
    } else {
      const code = actionCode(name, args);
      if (name === 'ikigai_room_snapshot') {
        const row = await store.read(code);
        if (!row) throw new RoomError('That room was not found or has expired.', 404);
        data = roomSnapshot(JSON.parse(row.state), session.id);
      } else data = await transitionWithRetry(store, code, session.id, name, args);
    }
    return reply(request, session, { data });
  } catch (error) {
    if (error instanceof RoomError) return reply(request, session, { error: { message: error.message } }, error.status);
    console.error('Room request failed', error instanceof Error ? error.message : 'Unknown error');
    return reply(request, session, { error: { message: 'The room connection was interrupted. Please try again.' } }, 500);
  }
}
