// Multiplayer server — Phase 2
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });
const players = new Map();
const votes = new Map();
let currentMap = 'jungle';
const MAPS = ['jungle', 'river', 'docks'];

wss.on('connection', (ws) => {
  let id = null;

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'join') {
        id = msg.id || Math.random().toString(36).slice(2, 10);
        players.set(id, {
          id,
          name: msg.name || 'Player',
          pos: [0, 1.6, 0],
          rot: 0,
          score: 0,
          health: 100,
          alive: true
        });
        ws.send(JSON.stringify({ type: 'welcome', id, map: currentMap }));
        broadcastPlayers();
      } else if (msg.type === 'update' && id) {
        const p = players.get(id);
        if (p && p.alive) {
          p.pos = msg.pos;
          p.rot = msg.rot || 0;
          if (msg.name) p.name = msg.name;
        }
        broadcastPlayers();
      } else if (msg.type === 'chat' && id) {
        broadcast({ type: 'chat', id, name: players.get(id)?.name, text: msg.text });
      } else if (msg.type === 'hit' && id) {
        // Server validates simple hit: distance check
        const shooter = players.get(id);
        const target = players.get(msg.target);
        if (shooter && target && target.alive && shooter.alive && id !== msg.target) {
          const dx = shooter.pos[0] - target.pos[0];
          const dz = shooter.pos[2] - target.pos[2];
          const dist = Math.hypot(dx, dz);
          if (dist < 40) {
            target.health -= 25;
            if (target.health <= 0) {
              target.alive = false;
              target.health = 0;
              shooter.score += 1;
              broadcast({ type: 'kill', killer: shooter.name, victim: target.name });
              setTimeout(() => {
                target.alive = true;
                target.health = 100;
                target.pos = [Math.random() * 20 - 10, 1.6, Math.random() * 20 - 10];
                broadcastPlayers();
              }, 3000);
            }
            broadcastPlayers();
          }
        }
      } else if (msg.type === 'vote' && id) {
        if (MAPS.includes(msg.map)) {
          votes.set(id, msg.map);
          const counts = {};
          for (const m of votes.values()) counts[m] = (counts[m] || 0) + 1;
          broadcast({ type: 'votes', counts });
          const majority = Math.ceil(players.size / 2);
          for (const [map, c] of Object.entries(counts)) {
            if (c >= majority && map !== currentMap) {
              currentMap = map;
              votes.clear();
              broadcast({ type: 'map', map: currentMap });
              break;
            }
          }
        }
      }
    } catch (_) {}
  });

  ws.on('close', () => {
    if (id) {
      players.delete(id);
      votes.delete(id);
      broadcast({ type: 'leave', id });
    }
  });
});

function broadcastPlayers() {
  broadcast({ type: 'players', players: Array.from(players.values()), map: currentMap });
}

function broadcast(obj) {
  const data = JSON.stringify(obj);
  for (const c of wss.clients) {
    if (c.readyState === WebSocket.OPEN) c.send(data);
  }
}

console.log('Phase 2 server on ws://localhost:8080');
