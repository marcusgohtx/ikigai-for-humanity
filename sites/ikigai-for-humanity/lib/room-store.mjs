// A D1 string has a 2 MB limit. Long custom games keep their JSON in small
// parts while one version on the room row controls the whole transaction.
const PART_LENGTH = 200000;

export function splitState(state) {
  const chunks = [];
  for (let offset = 0; offset < state.length;) {
    let end = Math.min(offset + PART_LENGTH, state.length);
    const last = state.charCodeAt(end - 1);
    if (end < state.length && last >= 0xd800 && last <= 0xdbff) end--;
    chunks.push(state.slice(offset, end)); offset = end;
  }
  return chunks;
}

export function createRoomStore(db) {
  return {
    async read(code) {
      // One SQL statement observes both the version and all its parts at once.
      const { results } = await db.prepare('SELECT code, state, version FROM rooms WHERE code = ? OR code BETWEEN ? AND ? ORDER BY code').bind(code, `${code}__0000`, `${code}__9999`).all();
      const root = results.find(row => row.code === code);
      if (!root) return null;
      const metadata = JSON.parse(root.state);
      if (metadata.storage !== 'chunks-v1') return { state: root.state, version: root.version };
      const parts = results.filter(row => row.code !== code);
      if (parts.length !== metadata.parts) throw new Error('Room storage is incomplete');
      return { state: parts.map(row => JSON.parse(row.state).chunk).join(''), version: root.version };
    },
    async compareAndSwap(code, version, state) {
      const chunks = splitState(state), token = crypto.randomUUID(), now = Date.now();
      const room = JSON.parse(state);
      const metadata = JSON.stringify({ storage: 'chunks-v1', token, parts: chunks.length, hostSession: room.hostSession, createdAt: room.createdAt, expiresAt: room.expiresAt });
      const statements = [
        db.prepare('UPDATE rooms SET state = ?, version = version + 1, updated_at = ? WHERE code = ? AND version = ?').bind(metadata, now, code, version),
        db.prepare("DELETE FROM rooms WHERE code BETWEEN ? AND ? AND EXISTS (SELECT 1 FROM rooms WHERE code = ? AND json_extract(state, '$.token') = ?)").bind(`${code}__0000`, `${code}__9999`, code, token),
        ...chunks.map((chunk, index) => db.prepare("INSERT INTO rooms (code, state, version, updated_at) SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM rooms WHERE code = ? AND json_extract(state, '$.token') = ?)").bind(`${code}__${String(index).padStart(4, '0')}`, JSON.stringify({ chunk }), version + 1, now, code, token)),
      ];
      // D1 batches commit all statements together. Only the winner's token lets
      // its part writes execute, even when another request read the old version.
      const results = await db.batch(statements);
      return results[0].meta.changes === 1;
    },
  };
}
