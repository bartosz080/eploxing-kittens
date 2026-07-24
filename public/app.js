const $ = (selector) => document.querySelector(selector);
let playerId = localStorage.getItem('eploxing-player-id') || null;
let state = null;
let pollTimer = null;

function nameValue() { return $('#name').value.trim() || 'Gast'; }
function toast(message) { $('#status').textContent = message; }

async function api(path, payload = {}) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, ...payload })
  });
  const message = await response.json();
  if (!response.ok) throw new Error(message.message);
  if (message.playerId) {
    playerId = message.playerId;
    localStorage.setItem('eploxing-player-id', playerId);
  }
  if (message.state) {
    state = message.state;
    render();
    startPolling();
  }
  if (message.future) $('#future').textContent = `Nächste Karten: ${message.future.map((card) => card.label).join(', ')}`;
}

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => api('/api/state').catch(() => {}), 1200);
}

function render() {
  if (!state) return;
  $('#lobby').classList.add('hidden');
  $('#game').classList.remove('hidden');
  $('#copyRoom').textContent = state.roomCode;
  $('#deckCount').textContent = state.deckCount;

  const winner = state.players.find((player) => player.id === state.winnerId);
  const current = state.players.find((player) => player.id === state.currentPlayerId);
  toast(winner ? `${winner.name} hat gewonnen!` : state.started ? `${current?.name || 'Niemand'} ist am Zug (${state.pendingDraws}× ziehen).` : 'Warte im Raum, bis alle bereit sind.');
  $('#start').hidden = state.started || state.hostId !== playerId;
  $('#draw').disabled = !state.started || state.currentPlayerId !== playerId || Boolean(state.winnerId);

  $('#players').replaceChildren(...state.players.map((player) => {
    const item = document.createElement('li');
    item.className = player.id === state.currentPlayerId ? 'active' : '';
    item.textContent = `${player.alive ? '😼' : '💥'} ${player.name} · ${player.handCount} Karten`;
    return item;
  }));
  $('#log').replaceChildren(...state.log.map((entry) => {
    const item = document.createElement('li');
    item.textContent = entry;
    return item;
  }));

  const template = $('#cardTemplate');
  $('#hand').replaceChildren(...state.hand.map((card) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.textContent = card.label;
    node.dataset.type = card.type;
    node.disabled = !state.started || state.currentPlayerId !== playerId || Boolean(state.winnerId) || card.type === 'exploding-kitten';
    node.addEventListener('click', () => api('/api/play', { cardId: card.id }).catch((error) => toast(error.message)));
    return node;
  }));
}

$('#create').addEventListener('click', () => api('/api/create', { name: nameValue() }).catch((error) => toast(error.message)));
$('#join').addEventListener('click', () => api('/api/join', { name: nameValue(), roomCode: $('#roomCode').value }).catch((error) => toast(error.message)));
$('#start').addEventListener('click', () => api('/api/start').catch((error) => toast(error.message)));
$('#draw').addEventListener('click', () => api('/api/draw').catch((error) => toast(error.message)));
$('#copyRoom').addEventListener('click', async () => {
  await navigator.clipboard.writeText(state.roomCode);
  toast('Raumcode kopiert. Schicke ihn deiner Mitspielerin.');
});
