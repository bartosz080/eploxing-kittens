const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CARD_TYPES,
  createGame,
  addPlayer,
  startGame,
  drawCard,
  playCard,
  visibleState
} = require('../game');

test('starts a two-player game with private hands and kitten deck', () => {
  const game = createGame({ roomCode: 'ABCDE', hostId: 'a', random: () => 0.2 });
  addPlayer(game, { id: 'a', name: 'Ada' });
  addPlayer(game, { id: 'b', name: 'Bea' });
  startGame(game);
  const state = visibleState(game, 'a');
  assert.equal(state.started, true);
  assert.equal(state.players.length, 2);
  assert.equal(state.hand.length, 6);
  assert.equal(state.players[1].handCount, 6);
  assert.ok(game.deck.some((card) => card.type === CARD_TYPES.EXPLODING_KITTEN));
});

test('skip card ends the active turn', () => {
  const game = createGame({ roomCode: 'ABCDE', hostId: 'a', random: () => 0.2 });
  addPlayer(game, { id: 'a', name: 'Ada' });
  addPlayer(game, { id: 'b', name: 'Bea' });
  startGame(game);
  const player = game.players[0];
  player.hand.push({ id: 'skip-test', type: CARD_TYPES.SKIP, label: 'Aussetzen' });
  playCard(game, 'a', 'skip-test');
  assert.equal(game.currentPlayerIndex, 1);
});

test('a player without defuse explodes after drawing a kitten', () => {
  const game = createGame({ roomCode: 'ABCDE', hostId: 'a', random: () => 0.2 });
  addPlayer(game, { id: 'a', name: 'Ada' });
  addPlayer(game, { id: 'b', name: 'Bea' });
  startGame(game);
  game.players[0].hand = [];
  game.deck.push({ id: 'boom', type: CARD_TYPES.EXPLODING_KITTEN, label: 'Eploding Kitten' });
  drawCard(game, 'a');
  assert.equal(game.players[0].alive, false);
  assert.equal(game.winnerId, 'b');
});
