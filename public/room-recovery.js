// The room controller loads asynchronously. If it cannot paint the lobby,
// recover it from the same snapshot instead of exposing the local-game home.
(function () {
  const code = new URLSearchParams(location.search).get('room')?.trim().toUpperCase();
  if (!code) return;

  const esc = value => String(value || '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
  const waitFor = (request, message) => Promise.race([
    request,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), 10000))
  ]);

  async function recover() {
    const app = document.getElementById('app');
    if (!app || app.querySelector('.room-code')) return;
    try {
      const db = supabase.createClient(IKIGAI_SUPABASE.url, IKIGAI_SUPABASE.publishableKey);
      let { data: { session } } = await waitFor(db.auth.getSession(), 'Room connection timed out.');
      if (!session) {
        const { error } = await waitFor(db.auth.signInAnonymously(), 'Sign-in timed out.');
        if (error) throw error;
      }
      const { data, error } = await waitFor(db.rpc('ikigai_room_snapshot', { p_code: code }), 'Room loading timed out.');
      if (error) throw error;
      if (!data?.room) throw new Error('This room could not be found.');
      const players = (data.players || []).map(player => `<div class="pass-card"><b>${esc(player.name)}</b><span class="pill">ready</span></div>`).join('');
      app.innerHTML = `<div class="shell"><header class="topbar"><button class="brand" data-r="local"><span class="brand-mark">i</span>ikigai</button><div class="nav-actions"><span class="nav-note">ROOM ${esc(code)}</span><button class="button reset-button" data-r="leave">Leave room</button></div></header><section class="screen-head"><div class="room-code">ROOM ${esc(code)}</div><h2>${esc(data.room.title)}</h2><p class="lead">Share this room code with friends: ${esc(code)}</p></section><section class="panel">${players}<div class="form-foot">${data.room.isHost ? '<button class="button coral" data-r="start">Open activity stage â†’</button>' : '<p class="helper">Waiting for the hostâ€¦</p>'}</div></section></div>`;
    } catch (error) {
      app.innerHTML = `<div class="shell"><header class="topbar"><button class="brand" data-r="local"><span class="brand-mark">i</span>ikigai</button></header><section class="screen-head"><div class="eyebrow">room connection</div><h2>We couldnâ€™t open this room yet.</h2><p class="lead">${esc(error.message || 'Please try again.')}</p><p class="helper">Room code: ${esc(code)}</p><div class="actions"><button class="button coral" onclick="location.reload()">Try again â†’</button></div></section></div>`;
    }
  }

  setTimeout(recover, 1200);
}());
