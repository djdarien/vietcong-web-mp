import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2d5a3a);
scene.fog = new THREE.FogExp2(0x2d5a3a, 0.012);

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

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(300, 300),
  new THREE.MeshLambertMaterial({ color: 0x1e3d12 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const dummy = new THREE.Object3D();
const trees = new THREE.InstancedMesh(
  new THREE.CylinderGeometry(0.25, 0.35, 5, 5),
  new THREE.MeshLambertMaterial({ color: 0x2e2014 }),
  50
);
for (let i = 0; i < 50; i++) {
  dummy.position.set((Math.random() - 0.5) * 200, 2.5, (Math.random() - 0.5) * 200);
  dummy.updateMatrix();
  trees.setMatrixAt(i, dummy.matrix);
}
trees.instanceMatrix.needsUpdate = true;
scene.add(trees);

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const keys = { w: false, a: false, s: false, d: false };
let myId = null;
let ws = null;
const remotes = new Map();
const isMobile = 'ontouchstart' in window;

if (isMobile) document.getElementById('touch').classList.add('show');
else document.addEventListener('click', () => controls.lock());

function connect() {
  const host = location.hostname || 'localhost';
  ws = new WebSocket(`ws://${host}:8080`);
  ws.onopen = () => {
    myId = Math.random().toString(36).slice(2, 10);
    const name = prompt('Name?', 'Player') || 'Player';
    ws.send(JSON.stringify({ type: 'join', id: myId, name }));
  };
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'players') {
      document.getElementById('count').textContent = msg.players.length;
      const seen = new Set();
      for (const p of msg.players) {
        if (p.id === myId) continue;
        seen.add(p.id);
        if (!remotes.has(p.id)) {
          const m = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.35, 1, 4, 6),
            new THREE.MeshLambertMaterial({ color: 0x2a6a8a })
          );
          scene.add(m);
          remotes.set(p.id, m);
        }
        const m = remotes.get(p.id);
        m.position.fromArray(p.pos);
        m.rotation.y = p.rot || 0;
      }
      for (const id of [...remotes.keys()]) {
        if (!seen.has(id)) {
          scene.remove(remotes.get(id));
          remotes.delete(id);
        }
      }
    } else if (msg.type === 'chat') {
      const log = document.getElementById('log');
      log.innerHTML += `<div>${msg.name}: ${msg.text}</div>`;
      log.scrollTop = log.scrollHeight;
    } else if (msg.type === 'leave') {
      const m = remotes.get(msg.id);
      if (m) { scene.remove(m); remotes.delete(msg.id); }
    }
  };
}

connect();

document.addEventListener('keydown', (e) => {
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

document.getElementById('chatInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && ws && ws.readyState === 1) {
    const text = e.target.value.trim();
    if (text) ws.send(JSON.stringify({ type: 'chat', text }));
    e.target.value = '';
  }
});

// Mobile joystick
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
  const can = isMobile || controls.isLocked;
  if (can) {
    velocity.x *= 1 - 5 * dt;
    velocity.z *= 1 - 5 * dt;
    direction.z = Number(keys.w) - Number(keys.s);
    direction.x = Number(keys.d) - Number(keys.a);
    if (direction.lengthSq() > 0) direction.normalize();
    if (keys.w || keys.s) velocity.z -= direction.z * 24 * dt;
    if (keys.a || keys.d) velocity.x -= direction.x * 24 * dt;
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
      rot: player.rotation.y
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
