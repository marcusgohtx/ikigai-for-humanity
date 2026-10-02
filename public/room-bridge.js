// The local-game home screen uses data-room-action; room.js uses data-r.
// Normalize the two attributes before the room controller receives a click.
document.addEventListener('click', event => {
  const button = event.target.closest('[data-room-action]');
  if (button) button.dataset.r = button.dataset.roomAction;
}, true);
