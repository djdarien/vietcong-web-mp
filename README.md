# vietcong-web-mp

Browser multiplayer Vietcong-style FPS prototype. Procedural content only.

**Goal:** play with dad and friends in a browser. No original game assets.

## Quick start (play with friends)

### Host (one person)
```bash
git clone https://github.com/djdarien/vietcong-web-mp.git
cd vietcong-web-mp
npm install
npm run server
```

### Everyone else
Open `http://YOUR-IP:3000` (or use `npm start` for a local client).

Same Wi-Fi or port-forward 8080 for the WebSocket server.

## Plan

### Phase 1 — Playable now (this repo)
- Procedural jungle map
- Movement, shoot, simple enemies
- WebSocket multiplayer (position sync)
- Mobile touch controls
- Settings (quality, sensitivity)

### Phase 2 — Better multiplayer
- Name tags, chat
- Team / deathmatch modes
- Map voting
- Better hit registration and lag compensation

### Phase 3 — Format tools (optional, private)
- Use OpenVietcong vc-spec / libvc as reference for *your own* local files only
- Never commit original CBF/BES/textures to the public repo
- Build a private asset pipeline if you own the game

### Phase 4 — Polish
- More procedural maps (river, docks)
- Sound, better AI
- Hosted server (Fly.io / Railway / VPS)

## Controls
Desktop: WASD, mouse, click
Mobile: joystick + drag look + FIRE button

## Notes
This is a clean-room prototype. Original Vietcong assets are not included or loaded.
