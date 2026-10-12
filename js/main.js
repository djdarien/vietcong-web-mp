import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

scene.add(new THREE.HemisphereLight(0x6aa86a, 0x1a3010, 0.6));
const dir = new THREE.DirectionalLight(0xffeecc, 0.7);
dir.position.set(30, 60, 10);
scene.add(dir);

let ground, trees;
function buildMap(name) {
  while (scene.children.length > 3) scene.remove(scene.children[scene.children.length - 1]);
  if (name === 'river') {
    scene.background = new THREE.Color(0x3d7a4a);
    scene.fog = new THREE.FogExp2(0x3d7a4a, 0.01);
  } else if (name === 'docks') {
    scene.background = new THREE.Color(0x4a7a9a);
    scene.fog = new THREE.FogExp2(0x4a7a9a, 0.008);
  } else {
    scene.background = new THREE.Color(0x2d5a3a);
    scene.fog = new THREE.FogExp2(0x2d5a3a, 0.012);
  }
  ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshLambertMaterial({ color: 0x1e3d12 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const dummy = new THREE.Object3D();
  trees = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 5, 5), new THREE.MeshLambertMaterial({ color: 0x2e2014 }), 40);
  for (let i = 0; i < 40; i++) {
    dummy.position.set((Math.random() - 0.5) * 180, 2.5, (Math.random() - 0.5) * 180);
    dummy.updateMatrix();
    trees.setMatrixAt(i, dummy.matrix);
  }
  trees.instanceMatrix.needsUpdate = true;
  scene.add(trees);
  if (name === 'river') {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(20, 200), new THREE.MeshLambertMaterial({ color: 0x2a5a7a, transparent: true, opacity: 0.7 }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.1;
    scene.add(water);
  }
  if (name === 'docks') {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(40, 0.4, 8), new THREE.MeshLambertMaterial({ color: 0x5a4a30 }));
    pier.position.set(0, 0.3, -20);
    scene.add(pier);
  }
  scene.add(controls.getObject());
}
buildMap('jungle');

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const keys = { w: false, a: false, s: false, d: false };
let myId = null;
let myName = 'Player';
let myWeapon = 'rifle';
let mySpeed = 1;
let ws = null;
let myHealth = 100;
const remotes = new Map();
const labels = new Map();
const puMeshes = new Map();
const isMobile = 'ontouchstart' in window;

if (isMobile) document.getElementById('touch').classList.add('show');
else document.addEventListener('click', () => controls.lock());

function makeLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#0f0';
  ctx.font = '28px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, 128, 40);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2, 0.5, 1);
  return sprite;
}

function connect() {
  const host = location.hostname || 'localhost';
  ws = new WebSocket(`ws://${host}:8080`);
  ws.onopen = () => {
    myId = Math.random().toString(36).slice(2, 10);
    myName = prompt('Name?', 'Player') || 'Player';
    ws.send(JSON.stringify({ type: 'join', id: myId, name: myName }));
  };
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'welcome') {
      document.getElementById('map').textContent = msg.map;
      buildMap(msg.map);
    }
    if (msg.type === 'players') {
      document.getElementById('count').textContent = msg.players.length;
      if (msg.map) document.getElementById('map').textContent = msg.map;
      const seen = new Set();
      let board = '';
      for (const p of msg.players) {
        board += `${p.name}: ${p.score} (${p.alive ? p.health : 'DEAD'})<br>`;
        if (p.id === myId) {
          myHealth = p.health;
          mySpeed = p.speedBoost || 1;
          document.getElementById('hp').textContent = p.health;
          continue;
        }
        seen.add(p.id);
        if (!remotes.has(p.id)) {
          const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1, 4, 6), new THREE.MeshLambertMaterial({ color: 0x2a6a8a }));
          scene.add(m);
          const label = makeLabel(p.name);
          scene.add(label);
          remotes.set(p.id, m);
          labels.set(p.id, label);
        }
        const m = remotes.get(p.id);
        const label = labels.get(p.id);
        m.position.fromArray(p.pos);
        m.rotation.y = p.rot || 0;
        m.visible = p.alive;
        label.position.copy(m.position);
        label.position.y += 2.2;
        label.visible = p.alive;
      }
      document.getElementById('scoreboard').innerHTML = board;
      for (const id of [...remotes.keys()]) {
        if (!seen.has(id)) {
          scene.remove(remotes.get(id));
          scene.remove(labels.get(id));
          remotes.delete(id);
          labels.delete(id);
        }
      }
    } else if (msg.type === 'powerups') {
      const seen = new Set();
      for (const pu of msg.list) {
        seen.add(pu.id);
        if (!puMeshes.has(pu.id)) {
          const color = pu.type === 'health' ? 0x00ff00 : pu.type === 'damage' ? 0xff4400 : 0x00aaff;
          const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshLambertMaterial({ color }));
          scene.add(m);
          puMeshes.set(pu.id, m);
        }
        const m = puMeshes.get(pu.id);
        m.position.fromArray(pu.pos);
        m.visible = pu.active;
      }
      for (const id of [...puMeshes.keys()]) {
        if (!seen.has(id)) {
          scene.remove(puMeshes.get(id));
          puMeshes.delete(id);
        }
      }
    } else if (msg.type === 'chat') {
      const log = document.getElementById('log');
      log.innerHTML += `<div>${msg.name}: ${msg.text}</div>`;
      log.scrollTop = log.scrollHeight;
    } else if (msg.type === 'kill') {
      const log = document.getElementById('log');
      log.innerHTML += `<div>${msg.killer} killed ${msg.victim}</div>`;
      log.scrollTop = log.scrollHeight;
    } else if (msg.type === 'pickup') {
      const log = document.getElementById('log');
      log.innerHTML += `<div>Picked up ${msg.power}</div>`;
      log.scrollTop = log.scrollHeight;
    } else if (msg.type === 'map') {
      document.getElementById('map').textContent = msg.map;
      buildMap(msg.map);
    }
  };
}
connect();

function shoot() {
  if (myHealth <= 0 || !ws || ws.readyState !== 1) return;
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = ray.intersectObjects([...remotes.values()], false);
  if (hits.length > 0) {
    for (const [id, mesh] of remotes) {
      if (mesh === hits[0].object) {
        ws.send(JSON.stringify({ type: 'hit', target: id }));
        break;
      }
    }
  }
}

document.addEventListener('mousedown', () => { if (!isMobile && controls.isLocked) shoot(); });
document.getElementById('fire').addEventListener('click', shoot);

document.querySelectorAll('#weapons button').forEach(btn => {
  btn.addEventListener('click', () => {
    myWeapon = btn.dataset.wpn;
    document.getElementById('wpn').textContent = myWeapon;
  });
});
document.addEventListener('keydown', (e) => {
  if (e.code === 'Digit1') { myWeapon = 'rifle'; document.getElementById('wpn').textContent = myWeapon; }
  if (e.code === 'Digit2') { myWeapon = 'shotgun'; document.getElementById('wpn').textContent = myWeapon; }
  if (e.code === 'Digit3') { myWeapon = 'sniper'; document.getElementById('wpn').textContent = myWeapon; }
  if (e.code === 'KeyW') keys.w = true;
  if (e.code === 'KeyA') keys.a = true;
  if (e.code === 'KeyS') keys.s = true;
  if (e.code === 'KeyD') keys.d = true;
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW') keys.w = false;
  if (e.code === 'KeyA') keys.a = false;
  if (e.code === 'KeyS') keys.s = false;
  if (e.code === 'KeyD') keys.d = false;
});

document.querySelectorAll('#vote button').forEach(btn => {
  btn.addEventListener('click', () => {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'vote', map: btn.dataset.map }));
  });
});

document.getElementById('chatInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && ws && ws.readyState === 1) {
    const text = e.target.value.trim();
    if (text) ws.send(JSON.stringify({ type: 'chat', text }));
    e.target.value = '';
  }
});

const joy = document.getElementById('joy');
const stick = document.getElementById('stick');
let joyActive = false;
function joyMove(x, y) {
  const r = joy.getBoundingClientRect();
  let dx = x - (r.left + r.width / 2);
  let dy = y - (r.top + r.height / 2);
  const d = Math.hypot(dx, dy);
  const max = 30;
  if (d > max) { dx = dx / d * max; dy = dy / d * max; }
  stick.style.transform = `translate(${dx}px, ${dy}px)`;
  keys.w = dy < -12; keys.s = dy > 12; keys.a = dx < -12; keys.d = dx > 12;
}
joy.addEventListener('touchstart', (e) => { e.preventDefault(); joyActive = true; const t = e.touches[0]; joyMove(t.clientX, t.clientY); });
joy.addEventListener('touchmove', (e) => { e.preventDefault(); if (joyActive) { const t = e.touches[0]; joyMove(t.clientX, t.clientY); } });
joy.addEventListener('touchend', () => { joyActive = false; stick.style.transform = ''; keys.w = keys.a = keys.s = keys.d = false; });

const clock = new THREE.Clock();
const player = controls.getObject();
let net = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.033);
  const can = (isMobile || controls.isLocked) && myHealth > 0;
  if (can) {
    const spd = 24 * mySpeed;
    velocity.x *= 1 - 5 * dt;
    velocity.z *= 1 - 5 * dt;
    direction.z = Number(keys.w) - Number(keys.s);
    direction.x = Number(keys.d) - Number(keys.a);
    if (direction.lengthSq() > 0) direction.normalize();
    if (keys.w || keys.s) velocity.z -= direction.z * spd * dt;
    if (keys.a || keys.d) velocity.x -= direction.x * spd * dt;
    controls.moveRight(-velocity.x * dt);
    controls.moveForward(-velocity.z * dt);
    player.position.y = 1.6;
  }
  net += dt;
  if (ws && ws.readyState === 1 && net > 0.05 && myId) {
    net = 0;
    ws.send(JSON.stringify({
      type: 'update',
      id: myId,
      pos: player.position.toArray(),
      rot: player.rotation.y,
      weapon: myWeapon
    }));
  }
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
