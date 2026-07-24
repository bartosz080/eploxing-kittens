const CARD_TYPES = {
  EXPLODING_KITTEN: 'exploding-kitten',
  DEFUSE: 'defuse',
  SKIP: 'skip',
  ATTACK: 'attack',
  SEE_FUTURE: 'see-future',
  SHUFFLE: 'shuffle',
  FAVOR: 'favor',
  TACO_CAT: 'taco-cat',
  POTATO_CAT: 'potato-cat'
};

const CARD_LABELS = {
  [CARD_TYPES.EXPLODING_KITTEN]: 'Eploding Kitten',
  [CARD_TYPES.DEFUSE]: 'Entschärfen',
  [CARD_TYPES.SKIP]: 'Aussetzen',
  [CARD_TYPES.ATTACK]: 'Angriff',
  [CARD_TYPES.SEE_FUTURE]: 'In die Zukunft schauen',
  [CARD_TYPES.SHUFFLE]: 'Mischen',
  [CARD_TYPES.FAVOR]: 'Gefallen',
  [CARD_TYPES.TACO_CAT]: 'Taco-Katze',
  [CARD_TYPES.POTATO_CAT]: 'Kartoffel-Katze'
};

function makeCard(type, id) {
  return { id: `${type}-${id}`, type, label: CARD_LABELS[type] };
}

function shuffle(cards, random = Math.random) {
  const result = [...cards];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function buildDeck(playerCount, random = Math.random) {
  let id = 0;
  const cards = [];
  const add = (type, count) => {
    for (let cardIndex = 0; cardIndex < count; cardIndex += 1) {
      id += 1;
      cards.push(makeCard(type, id));
    }
  };

  add(CARD_TYPES.SKIP, 4);
  add(CARD_TYPES.ATTACK, 3);
  add(CARD_TYPES.SEE_FUTURE, 4);
  add(CARD_TYPES.SHUFFLE, 4);
  add(CARD_TYPES.FAVOR, 3);
  add(CARD_TYPES.TACO_CAT, 5);
  add(CARD_TYPES.POTATO_CAT, 5);

  const shuffledSafeDeck = shuffle(cards, random);
  for (let kittenIndex = 0; kittenIndex < Math.max(1, playerCount - 1); kittenIndex += 1) {
    id += 1;
    shuffledSafeDeck.push(makeCard(CARD_TYPES.EXPLODING_KITTEN, id));
  }

  return shuffle(shuffledSafeDeck, random);
}

function createGame({ roomCode, hostId, random = Math.random }) {
  return {
    roomCode,
    hostId,
    random,
    players: [],
    deck: [],
    discard: [],
    currentPlayerIndex: 0,
    pendingDraws: 1,
    started: false,
    winnerId: null,
    log: ['Raum erstellt. Teile den Code mit deiner Mitspielerin.']
  };
}

function publicPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    handCount: player.hand.length,
    alive: player.alive,
    ready: player.ready
  };
}

function visibleState(game, viewerId) {
  const viewer = game.players.find((player) => player.id === viewerId);
  return {
    roomCode: game.roomCode,
    hostId: game.hostId,
    players: game.players.map(publicPlayer),
    hand: viewer ? viewer.hand : [],
    deckCount: game.deck.length,
    discardTop: game.discard.at(-1) ?? null,
    currentPlayerId: game.players[game.currentPlayerIndex]?.id ?? null,
    pendingDraws: game.pendingDraws,
    started: game.started,
    winnerId: game.winnerId,
    log: game.log.slice(-8)
  };
}

function addPlayer(game, { id, name }) {
  if (game.started) throw new Error('Das Spiel läuft bereits.');
  if (game.players.length >= 4) throw new Error('Dieser Raum ist voll.');
  const cleanName = String(name || 'Gast').trim().slice(0, 24) || 'Gast';
  game.players.push({ id, name: cleanName, hand: [], alive: true, ready: false });
  game.log.push(`${cleanName} ist beigetreten.`);
}

function startGame(game) {
  if (game.started) throw new Error('Das Spiel läuft bereits.');
  if (game.players.length < 2) throw new Error('Du brauchst mindestens zwei Personen.');
  game.started = true;
  game.deck = buildDeck(game.players.length, game.random);
  const kittens = game.deck.filter((card) => card.type === CARD_TYPES.EXPLODING_KITTEN);
  game.deck = game.deck.filter((card) => card.type !== CARD_TYPES.EXPLODING_KITTEN);
  game.discard = [];
  game.currentPlayerIndex = 0;
  game.pendingDraws = 1;
  game.winnerId = null;

  game.players.forEach((player) => {
    player.alive = true;
    player.hand = [makeCard(CARD_TYPES.DEFUSE, `${player.id}-starter`)];
    for (let cardCount = 0; cardCount < 5; cardCount += 1) {
      player.hand.push(game.deck.pop());
    }
  });
  game.deck = shuffle([...game.deck, ...kittens], game.random);
  game.log.push('Das Spiel beginnt. Jede Person startet mit einer Entschärfen-Karte.');
}

function getCurrentPlayer(game) {
  return game.players[game.currentPlayerIndex];
}

function nextTurn(game) {
  const alivePlayers = game.players.filter((player) => player.alive);
  if (alivePlayers.length === 1) {
    game.winnerId = alivePlayers[0].id;
    game.log.push(`${alivePlayers[0].name} gewinnt!`);
    return;
  }

  let nextIndex = game.currentPlayerIndex;
  do {
    nextIndex = (nextIndex + 1) % game.players.length;
  } while (!game.players[nextIndex].alive);
  game.currentPlayerIndex = nextIndex;
  game.pendingDraws = Math.max(1, game.pendingDraws);
}

function requireTurn(game, playerId) {
  if (!game.started || game.winnerId) throw new Error('Gerade läuft kein aktives Spiel.');
  if (getCurrentPlayer(game)?.id !== playerId) throw new Error('Du bist gerade nicht am Zug.');
}

function drawCard(game, playerId) {
  requireTurn(game, playerId);
  const player = getCurrentPlayer(game);
  const drawn = game.deck.pop();
  if (!drawn) throw new Error('Der Nachziehstapel ist leer.');

  if (drawn.type === CARD_TYPES.EXPLODING_KITTEN) {
    const defuseIndex = player.hand.findIndex((card) => card.type === CARD_TYPES.DEFUSE);
    if (defuseIndex >= 0) {
      const [defuse] = player.hand.splice(defuseIndex, 1);
      game.discard.push(defuse);
      const insertIndex = Math.floor(game.random() * (game.deck.length + 1));
      game.deck.splice(insertIndex, 0, drawn);
      game.log.push(`${player.name} hat ein Kitten entschärft und wieder versteckt.`);
    } else {
      player.alive = false;
      game.discard.push(drawn);
      game.log.push(`${player.name} ist explodiert.`);
    }
  } else {
    player.hand.push(drawn);
    game.log.push(`${player.name} zieht eine Karte.`);
  }

  game.pendingDraws -= 1;
  if (game.pendingDraws <= 0 || !player.alive) {
    game.pendingDraws = 1;
    nextTurn(game);
  }
}

function playCard(game, playerId, cardId) {
  requireTurn(game, playerId);
  const player = getCurrentPlayer(game);
  const cardIndex = player.hand.findIndex((card) => card.id === cardId);
  if (cardIndex < 0) throw new Error('Diese Karte ist nicht auf deiner Hand.');
  const [card] = player.hand.splice(cardIndex, 1);
  game.discard.push(card);

  switch (card.type) {
    case CARD_TYPES.SKIP:
      game.log.push(`${player.name} setzt den Rest des Zugs aus.`);
      game.pendingDraws = 1;
      nextTurn(game);
      break;
    case CARD_TYPES.ATTACK:
      game.log.push(`${player.name} startet einen Angriff: nächste Person zieht zweimal.`);
      game.pendingDraws = 2;
      nextTurn(game);
      break;
    case CARD_TYPES.SHUFFLE:
      game.deck = shuffle(game.deck, game.random);
      game.log.push(`${player.name} mischt den Stapel.`);
      break;
    case CARD_TYPES.SEE_FUTURE:
      game.log.push(`${player.name} späht die nächsten Karten aus.`);
      return { future: game.deck.slice(-3).reverse() };
    case CARD_TYPES.FAVOR: {
      const target = game.players.find((candidate) => candidate.alive && candidate.id !== player.id && candidate.hand.length > 0);
      if (target) {
        const giftIndex = Math.floor(game.random() * target.hand.length);
        const [gift] = target.hand.splice(giftIndex, 1);
        player.hand.push(gift);
        game.log.push(`${target.name} gibt ${player.name} eine zufällige Karte.`);
      } else {
        game.log.push(`${player.name} findet niemanden für einen Gefallen.`);
      }
      break;
    }
    case CARD_TYPES.DEFUSE:
    case CARD_TYPES.TACO_CAT:
    case CARD_TYPES.POTATO_CAT:
      game.log.push(`${player.name} legt ${card.label} ab.`);
      break;
    default:
      throw new Error('Unbekannte Karte.');
  }

  return {};
}

module.exports = {
  CARD_TYPES,
  CARD_LABELS,
  buildDeck,
  createGame,
  addPlayer,
  startGame,
  drawCard,
  playCard,
  visibleState
};
