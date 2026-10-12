// Multiplayer server for vietcong-web-mp
// Run: npm run server

const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });
const players = new Map();

wss.on('connection', (ws) => {
  let id = null;

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'join') {
        id = msg.id || Math.random().toString(36).slice(2, 10);
        players.set(id, { id, name: msg.name || 'Player', pos: [0, 1.6, 0], rot: 0, score: 0 });
        broadcastPlayers();
      } else if (msg.type === 'update' && id) {
        const p = players.get(id);
        if (p) {
          p.pos = msg.pos;
          p.rot = msg.rot || 0;
          if (msg.name) p.name = msg.name;
        }
        broadcastPlayers();
      } else if (msg.type === 'chat' && id) {
        broadcast({ type: 'chat', id, name: players.get(id)?.name, text: msg.text });
      }
    } catch (_) {}
  });

  ws.on('close', () => {
    if (id) {
      players.delete(id);
      broadcast({ type: 'leave', id });
    }
  });
});

function broadcastPlayers() {
  broadcast({ type: 'players', players: Array.from(players.values()) });
}

function broadcast(obj) {
  const data = JSON.stringify(obj);
  for (const c of wss.clients) {
    if (c.readyState === WebSocket.OPEN) c.send(data);
  }
}

console.log('Multiplayer server: ws://localhost:8080');
console.log('Start client with: npm start');
