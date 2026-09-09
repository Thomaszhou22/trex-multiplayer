// server.js — minimal WebSocket relay for t-rex-runner multiplayer
// Deploy free on Render.com / Railway / Fly.io. No dependencies needed if using
// a platform with `ws` preinstalled; otherwise: npm i ws
// Rooms hold up to 4 players; each client sends {t:'update',score,alive}
// every 500ms; server broadcasts the merged state.
const { WebSocketServer } = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;
const MAX_PLAYERS = 4;
const STALE_MS = 10000;

const server = http.createServer((req, res) => {
  // health check + landing
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<h1>T-RX Runner relay is live</h1><p>Point the game HUD at this URL (wss).</p>');
});

const wss = new WebSocketServer({ server });

const rooms = new Map(); // room -> Map(id -> {ws, name, score, alive, last})

function stateMessage(roomMap) {
  const players = {};
  for (const [id, p] of roomMap) {
    players[id] = { name: p.name, score: p.score, alive: p.alive, last: p.last };
  }
  return JSON.stringify({ t: 'state', players });
}

function broadcast(roomMap) {
  const msg = stateMessage(roomMap);
  for (const [, p] of roomMap) {
    if (p.ws.readyState === 1) p.ws.send(msg);
  }
}

function prune(roomMap) {
  const now = Date.now();
  let dirty = false;
  for (const [id, p] of roomMap) {
    if (now - p.last > STALE_MS) {
      roomMap.delete(id);
      try { p.ws.close(); } catch (e) {}
      dirty = true;
    }
  }
  return dirty;
}

function getRoom(name) {
  let r = rooms.get(name);
  if (!r) { r = new Map(); rooms.set(name, r); }
  return r;
}

wss.on('connection', (ws) => {
  let joinedRoom = null;
  let myId = null;
  let myName = 'P';

  ws.on('message', (data) => {
    let m;
    try { m = JSON.parse(data.toString()); } catch (e) { return; }

    if (m.t === 'join') {
      if (joinedRoom) return; // already in a room
      const roomMap = getRoom(String(m.room || 'LOBBY').toUpperCase().slice(0, 8));
      if (roomMap.size >= MAX_PLAYERS) {
        ws.send(JSON.stringify({ t: 'full' }));
        return;
      }
      joinedRoom = roomMap;
      myId = String(m.id || 'p?').slice(0, 16);
      myName = String(m.name || 'P').slice(0, 12);
      roomMap.set(myId, {
        ws, name: myName,
        score: 0, alive: true, last: Date.now(),
      });
      broadcast(roomMap);
    } else if (m.t === 'update' && joinedRoom && myId) {
      let p = joinedRoom.get(myId);
      if (!p) {
        // Heartbeat resumed after background-tab throttling or a missed
        // prune: auto-rejoin instead of staying invisible forever.
        if (joinedRoom.size >= MAX_PLAYERS) return;
        p = { ws, name: myName, score: 0, alive: true, last: Date.now() };
        joinedRoom.set(myId, p);
      }
      p.score = Number(m.score) || 0;
      p.alive = m.alive !== false;
      p.last = Date.now();
      if (prune(joinedRoom)) rooms.forEach((rm) => prune(rm));
      broadcast(joinedRoom);
    }
  });

  ws.on('close', () => {
    if (joinedRoom && myId) {
      joinedRoom.delete(myId);
      if (joinedRoom.size === 0) {
        for (const [name, rm] of rooms) if (rm === joinedRoom) rooms.delete(name);
      } else {
        broadcast(joinedRoom);
      }
    }
  });
});

// periodic prune of all rooms
setInterval(() => {
  let dirty = false;
  for (const [name, rm] of rooms) {
    if (prune(rm)) dirty = true;
    if (rm.size === 0) rooms.delete(name);
  }
}, 10000);

server.listen(PORT, () => console.log('relay listening on :' + PORT));
