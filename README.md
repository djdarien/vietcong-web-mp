# vietcong-web-mp

Browser multiplayer Vietcong-style FPS. Procedural only.

## Phase 3 — Weapons & Power-ups

**Weapons** (1/2/3 or buttons):
- Rifle — 25 dmg, medium range
- Shotgun — 12 dmg, short range
- Sniper — 80 dmg, long range

**Power-ups** (colored cubes on the map):
- Green — Health (+50)
- Orange — Damage boost (1.5x, 8s)
- Blue — Speed boost (1.6x, 8s)

Respawn every 15s. Server validates damage and pickups.

## Quick start
```bash
git clone https://github.com/djdarien/vietcong-web-mp.git
cd vietcong-web-mp
npm install
npm run server
npm start
```
Others join `http://HOST-IP:3000`.

MIT License.
