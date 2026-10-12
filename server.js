// Multiplayer server — Phase 3
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });
const players = new Map();
const votes = new Map();
const powerups = new Map();
let currentMap = 'jungle';
const MAPS = ['jungle', 'river', 'docks'];
const WEAPONS = {
  rifle: { dmg: 25, range: 40, spread: 0 },
  shotgun: { dmg: 12, range: 18, spread: 0.15, pellets: 5 },
  sniper: { dmg: 80, range: 80, spread: 0 }
};

function spawnPowerups() {
  powerups.clear();
  const types = ['health', 'damage', 'speed'];
  for (let i = 0; i < 4; i++) {
    const id = 'pu' + i;
    powerups.set(id, {
      id,
      type: types[i % types.length],
      pos: [(Math.random() - 0.5) * 80, 1, (Math.random() - 0.5) * 80],
      active: true
    });
  }
}
spawnPowerups();

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
          alive: true,
          weapon: 'rifle',
          dmgBoost: 1,
          speedBoost: 1,
          boostUntil: 0
        });
        ws.send(JSON.stringify({ type: 'welcome', id, map: currentMap }));
        broadcastPlayers();
        broadcastPowerups();
      } else if (msg.type === 'update' && id) {
        const p = players.get(id);
        if (p && p.alive) {
          p.pos = msg.pos;
          p.rot = msg.rot || 0;
          if (msg.weapon && WEAPONS[msg.weapon]) p.weapon = msg.weapon;
          // Power-up pickup
          for (const pu of powerups.values()) {
            if (!pu.active) continue;
            const dx = p.pos[0] - pu.pos[0];
            const dz = p.pos[2] - pu.pos[2];
            if (Math.hypot(dx, dz) < 2) {
              pu.active = false;
              if (pu.type === 'health') p.health = Math.min(100, p.health + 50);
              if (pu.type === 'damage') { p.dmgBoost = 1.5; p.boostUntil = Date.now() + 8000; }
              if (pu.type === 'speed') { p.speedBoost = 1.6; p.boostUntil = Date.now() + 8000; }
              broadcast({ type: 'pickup', id: p.id, power: pu.type });
              setTimeout(() => { pu.active = true; broadcastPowerups(); }, 15000);
              broadcastPowerups();
            }
          }
        }
        broadcastPlayers();
      } else if (msg.type === 'chat' && id) {
        broadcast({ type: 'chat', id, name: players.get(id)?.name, text: msg.text });
      } else if (msg.type === 'hit' && id) {
        const shooter = players.get(id);
        const target = players.get(msg.target);
        if (shooter && target && target.alive && shooter.alive && id !== msg.target) {
          const w = WEAPONS[shooter.weapon] || WEAPONS.rifle;
          const dx = shooter.pos[0] - target.pos[0];
          const dz = shooter.pos[2] - target.pos[2];
          const dist = Math.hypot(dx, dz);
          if (dist < w.range) {
            const dmg = Math.round(w.dmg * (shooter.dmgBoost || 1));
            target.health -= dmg;
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
              spawnPowerups();
              broadcast({ type: 'map', map: currentMap });
              broadcastPowerups();
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
  const now = Date.now();
  for (const p of players.values()) {
    if (p.boostUntil && now > p.boostUntil) {
      p.dmgBoost = 1;
      p.speedBoost = 1;
      p.boostUntil = 0;
    }
  }
  broadcast({ type: 'players', players: Array.from(players.values()), map: currentMap });
}

function broadcastPowerups() {
  broadcast({ type: 'powerups', list: Array.from(powerups.values()) });
}

function broadcast(obj) {
  const data = JSON.stringify(obj);
  for (const c of wss.clients) {
    if (c.readyState === WebSocket.OPEN) c.send(data);
  }
}

console.log('Phase 3 server on ws://localhost:8080');
