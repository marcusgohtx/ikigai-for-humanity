// Make the exact-player requirement visible instead of leaving a disabled
// button unexplained in the shared-room lobby.
(function () {
  function explain() {
    const button = document.querySelector('[data-r="start"]');
    if (!button || !button.disabled || document.getElementById('room-waiting-hint')) return;
    const hint = document.createElement('p');
    hint.id = 'room-waiting-hint'; hint.className = 'helper';
    hint.textContent = 'Waiting for every configured player to join on separate devices.';
    button.insertAdjacentElement('beforebegin', hint);
    button.title = 'This opens when every configured player has joined.';
  }
  const app = document.getElementById('app');
  if (app) new MutationObserver(explain).observe(app, { childList: true, subtree: true });
  explain();
}());
