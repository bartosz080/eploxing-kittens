const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const {
  createGame,
  addPlayer,
  startGame,
  drawCard,
  playCard,
  visibleState
} = require('./game');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const rooms = new Map();
const playerRooms = new Map();

function roomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let index = 0; index < 5; index += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return rooms.has(code) ? roomCode() : code;
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (error) { reject(error); }
    });
    request.on('error', reject);
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function stateFor(playerId) {
  const room = rooms.get(playerRooms.get(playerId));
  if (!room) throw new Error('Du bist in keinem Raum.');
  return visibleState(room, playerId);
}

async function handleApi(request, response) {
  try {
    const body = await readJson(request);
    let playerId = body.playerId || crypto.randomUUID();
    let result = {};

    if (request.url === '/api/create') {
      const code = roomCode();
      const room = createGame({ roomCode: code, hostId: playerId });
      rooms.set(code, room);
      playerRooms.set(playerId, code);
      addPlayer(room, { id: playerId, name: body.name });
      result = { playerId, state: visibleState(room, playerId) };
    } else if (request.url === '/api/join') {
      const room = rooms.get(String(body.roomCode || '').trim().toUpperCase());
      if (!room) throw new Error('Diesen Raum gibt es nicht.');
      playerRooms.set(playerId, room.roomCode);
      addPlayer(room, { id: playerId, name: body.name });
      result = { playerId, state: visibleState(room, playerId) };
    } else {
      const room = rooms.get(playerRooms.get(playerId));
      if (!room) throw new Error('Du bist in keinem Raum.');
      if (request.url === '/api/start') startGame(room);
      if (request.url === '/api/draw') drawCard(room, playerId);
      if (request.url === '/api/play') result = playCard(room, playerId, body.cardId);
      result = { ...result, playerId, state: visibleState(room, playerId) };
    }

    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 400, { message: error.message || String(error) });
  }
}

const mimeTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8' };
const server = http.createServer((request, response) => {
  if (request.url.startsWith('/api/')) {
    handleApi(request, response);
    return;
  }

  const requestPath = request.url === '/' ? '/index.html' : decodeURIComponent(request.url.split('?')[0]);
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
    response.end(data);
  });
});

server.listen(PORT, () => console.log(`Eploxing Kittens läuft auf http://localhost:${PORT}`));
