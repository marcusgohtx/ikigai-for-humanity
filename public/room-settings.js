(function () {
  const cats = ['love', 'strength', 'opportunity', 'need'];
  const code = new URLSearchParams(location.search).get('room');
  const draft = window.IkigaiRoomSettingsDraft || (window.IkigaiRoomSettingsDraft = {
    mode: 'quick', source: 'premade', items: 5, rounds: 1,
    love: 1, strength: 1, opportunity: 1, need: 1
  });

  function categoryLabel(category) {
    return category === 'love' ? 'What you love' : category === 'strength' ? 'What you are good at' : category === 'opportunity' ? 'What you can be paid for' : 'What the world needs';
  }

  function settings() {
    const start = document.querySelector('[data-r="start"],[data-room-action="start-room"]');
    if (!start || document.getElementById('room-settings')) return;
    start.closest('.form-foot').insertAdjacentHTML('afterbegin', `<div id="room-settings"><p class="field-label">Game mode</p><select id="room-setting-mode"><option value="quick" ${draft.mode === 'quick' ? 'selected' : ''}>Quick · draft pre-made activities</option><option value="deep" ${draft.mode === 'deep' ? 'selected' : ''}>Deep · write your own activities</option><option value="custom" ${draft.mode === 'custom' ? 'selected' : ''}>Custom</option></select><div id="room-setting-custom" ${draft.mode === 'custom' ? '' : 'hidden'}><label class="field-label">Activity source</label><select id="room-setting-source"><option value="premade" ${draft.source === 'premade' ? 'selected' : ''}>Pre-made cards</option><option value="own" ${draft.source === 'own' ? 'selected' : ''}>Self-generated activities</option></select><div class="config-grid"><label>Items/category<input id="room-setting-items" type="number" min="1" max="8" value="${draft.items}"></label><label>Table rounds<input id="room-setting-rounds" type="number" min="1" max="24" value="${draft.rounds}"></label></div>${cats.map(category => `<label>${categoryLabel(category)}<input id="room-setting-${category}" type="number" min="0" max="8" value="${draft[category]}"></label>`).join('')}</div><button class="button quiet" data-save-settings>Save game settings</button><p class="helper" id="room-settings-status">${draft.mode === 'custom' ? 'Custom: choose the counts below.' : draft.mode === 'deep' ? 'Deep: everyone writes five activities in each category.' : 'Quick: everyone drafts five pre-made activities in each category.'}</p></div>`);
  }

  function capture() {
    const mode = document.getElementById('room-setting-mode');
    if (!mode) return;
    draft.mode = mode.value;
    draft.source = document.getElementById('room-setting-source')?.value || draft.source;
    draft.items = +document.getElementById('room-setting-items')?.value || draft.items;
    draft.rounds = +document.getElementById('room-setting-rounds')?.value || draft.rounds;
    cats.forEach(category => { draft[category] = +document.getElementById('room-setting-' + category)?.value || 0; });
  }

  async function save() {
    capture();
    const custom = draft.mode === 'custom';
    const config = {
      mode: draft.mode,
      source: draft.mode === 'deep' ? 'own' : draft.mode === 'quick' ? 'premade' : draft.source,
      itemsPerCategory: custom ? draft.items : 5,
      roundCount: custom ? draft.rounds : 1,
      roundCardCounts: Object.fromEntries(cats.map(category => [category, custom ? draft[category] : 1]))
    };
    const roomCode = code || window.IkigaiRoom?.code?.();
    const db = supabase.createClient(IKIGAI_SUPABASE.url, IKIGAI_SUPABASE.publishableKey);
    const { error } = await db.rpc('configure_ikigai_room', { p_code: roomCode, p_config: config });
    const status = document.getElementById('room-settings-status');
    if (status) status.textContent = error ? error.message : 'Settings saved. You can start when ready.';
  }

  document.addEventListener('input', event => {
    if (event.target.closest('#room-settings')) capture();
  });
  document.addEventListener('change', event => {
    if (!event.target.closest('#room-settings')) return;
    capture();
    if (event.target.id === 'room-setting-mode') {
      const custom = draft.mode === 'custom';
      document.getElementById('room-setting-custom').hidden = !custom;
      document.getElementById('room-settings-status').textContent = custom ? 'Custom: choose the counts below.' : draft.mode === 'deep' ? 'Deep: everyone writes five activities in each category.' : 'Quick: everyone drafts five pre-made activities in each category.';
    }
  });
  document.addEventListener('click', event => { if (event.target.closest('[data-save-settings]')) save(); });
  const app = document.getElementById('app');
  if (app) new MutationObserver(settings).observe(app, { childList: true, subtree: true });
  settings();
}());
