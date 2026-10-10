// Shared three.js lane-runner engine (original code, MIT). Kenney CC0 models (assets3d/*.glb, meshopt + WebP).
// Kit (kit.js) runs the fixed-step logic, input, HUD, title/over screens and Hub adapter on a transparent 2D overlay;
// this module renders the world in WebGL underneath: one tuned shadow map, fog, ACES tone mapping, DPR capped at 1.5.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const LANE = 2.4, GRAV = 42, JUMP = 14.5;
export async function loadModels(names, base) {
  const ld = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder); const out = {};
  await Promise.all(names.map(n => ld.loadAsync((base || '../assets3d/') + n + '.glb').then(gl => { gl.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material.map) o.material.map.anisotropy = 4; } }); out[n] = gl; })));
  return out;
}
// scale a model so its bounding box matches the wanted size along one axis, with its base at y=0 and centred on x/z
export function fit(obj, axis, size) { const b = new THREE.Box3().setFromObject(obj), s = new THREE.Vector3(); b.getSize(s); const k = size / s[axis]; obj.scale.multiplyScalar(k); const b2 = new THREE.Box3().setFromObject(obj), c = new THREE.Vector3(); b2.getCenter(c); obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= b2.min.y; const w = new THREE.Group(); w.add(obj); return w; }
// bake a group of static meshes into one mesh per material (cuts draw calls for tiled scenery)
export function bake(group, shadows) { group.updateMatrixWorld(true); const by = new Map(); group.traverse(o => { if (!o.isMesh) return; let g = o.geometry.clone(); if (g.index) g = g.toNonIndexed(); for (const k of Object.keys(g.attributes)) { if (!['position', 'normal', 'uv'].includes(k)) { g.deleteAttribute(k); continue; } const a = g.attributes[k], f = new Float32Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let j = 0; j < a.itemSize; j++) f[i * a.itemSize + j] = a.getComponent(i, j); g.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize)); } g.applyMatrix4(o.matrixWorld); if (!g.attributes.uv) return; const key = o.material.uuid; if (!by.has(key)) by.set(key, { m: o.material, gs: [] }); by.get(key).gs.push(g); });
  const out = new THREE.Group(); for (const { m, gs } of by.values()) { const me = new THREE.Mesh(mergeGeometries(gs), m); me.receiveShadow = true; me.castShadow = !!shadows; out.add(me); } return out; }
export function stage(o) { // renderer + scene + lights + overlay sync
  const cv = document.createElement('canvas'); cv.id = 'gl3d'; document.body.insertBefore(cv, document.body.firstChild);
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: (devicePixelRatio || 1) < 2, powerPreference: 'high-performance' }); r.setPixelRatio(Math.min(1.5, devicePixelRatio || 1));
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = o.exposure || 1.05; r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); const sky = o.sky || ['#3b6fd1', '#f6c49b']; const tc = document.createElement('canvas'); tc.width = 2; tc.height = 256; const x = tc.getContext('2d'); const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, sky[0]); gr.addColorStop(0.75, sky[1]); gr.addColorStop(1, sky[1]); x.fillStyle = gr; x.fillRect(0, 0, 2, 256);
  const bg = new THREE.CanvasTexture(tc); bg.colorSpace = THREE.SRGBColorSpace; scene.background = bg; scene.fog = new THREE.Fog(sky[1], o.fogNear || 30, o.fogFar || 120);
  scene.add(new THREE.HemisphereLight(o.hemiSky || '#dbeaff', o.hemiGround || '#8a6a4a', 1.8));
  const sun = new THREE.DirectionalLight(o.sun || '#fff1d6', 2.4); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = -14; sc.right = 14; sc.top = 20; sc.bottom = -20; sc.near = 1; sc.far = 80; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; scene.add(sun, sun.target);
  const cam = new THREE.PerspectiveCamera(o.fov || 62, 1, 0.1, 400);
  function sync() { const k = document.getElementById('gl'); if (!k) return; if (cv.style.cssText !== k.style.cssText) { cv.style.cssText = k.style.cssText; cv.style.pointerEvents = 'none'; } const w = parseInt(k.style.width), h = parseInt(k.style.height); if (w && (r.domElement.clientWidth !== w || r.domElement.clientHeight !== h || cam.aspect !== w / h)) { r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); } }
  window.__R = r; return { THREE, r, scene, sun, cam, sync, render() { sync(); r.render(scene, cam); } };
}
function stripeTex(a, b, n) { const c = document.createElement('canvas'); c.width = 128; c.height = 32; const x = c.getContext('2d'); x.fillStyle = a; x.fillRect(0, 0, 128, 32); x.fillStyle = b; for (let i = -2; i < (n || 8); i++) { x.beginPath(); x.moveTo(i * 20, 32); x.lineTo(i * 20 + 10, 32); x.lineTo(i * 20 + 26, 0); x.lineTo(i * 20 + 16, 0); x.fill(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function noiseTex(base, var1, rep) { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.fillStyle = base; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 9000; i++) { const v = Math.random(); x.fillStyle = v < 0.5 ? var1 : 'rgba(255,255,255,.08)'; const s = 1 + Math.random() * 3; x.fillRect(Math.random() * 256, Math.random() * 256, s, s); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

export default async function RailRunner(cfg) {
  const K = window.Kit; const S = stage({ sky: cfg.sky, fogNear: 35, fogFar: 140 }); const { scene, cam, sun } = S;
  let M = null; const loading = loadModels(['runner', 'train', 'rail', 'coin', 'barrier', 'blda', 'bldc', 'blde', 'bldg', 'bldj', 'lamp']).then(m => (M = m));
  // static world pieces
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 400), new THREE.MeshStandardMaterial({ map: noiseTex('#6b5a4a', 'rgba(40,30,20,.35)', [8, 50]), roughness: 0.95 })); ground.rotation.x = -Math.PI / 2; ground.position.z = -150; ground.receiveShadow = true; scene.add(ground);
  const hazard = new THREE.MeshStandardMaterial({ map: stripeTex('#facc15', '#111827'), roughness: 0.6, metalness: 0.1 }), post = new THREE.MeshStandardMaterial({ color: '#9ca3af', roughness: 0.4, metalness: 0.8 });
  const rampMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.5, metalness: 0.3 });
  const coinGlow = new THREE.PointLight('#ffd166', 0, 6);
  const world = new THREE.Group(); scene.add(world);
  let hero, mixer, acts = {}, cur;
  const pools = { rail: [], bld: [] }; const items = [];

  function play(n, fade) { const a = acts[n]; if (!a || cur === a) return; a.reset().setEffectiveTimeScale(n === 'sprint' ? 1.25 : 1).fadeIn(fade || 0.12).play(); if (cur) cur.fadeOut(fade || 0.12); cur = a; if (n === 'jump' || n === 'die') { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; } }
  function setup() {
    const ch = SkeletonUtils.clone(M.runner.scene); ch.scale.setScalar(2.4); hero = new THREE.Group(); hero.add(ch); hero.rotation.y = Math.PI; scene.add(hero);
    mixer = new THREE.AnimationMixer(ch); for (const c of M.runner.animations) acts[c.name] = mixer.clipAction(c);
    const railProto = fit(M.rail.scene.clone(), 'x', 1.7); const b = new THREE.Box3().setFromObject(railProto); const RL = b.max.z - b.min.z; cfg._RL = RL;
    const strip = new THREE.Group(); const NT = Math.ceil(80 / RL); for (let l = -1; l <= 1; l++) for (let i = 0; i < NT; i++) { const m = railProto.clone(); m.position.set(l * LANE, 0.01, -i * RL); strip.add(m); } const sb = bake(strip); cfg._SL = NT * RL;
    for (let k = 0; k < 2; k++) { const m = k ? sb.clone() : sb; m.userData.z0 = -k * cfg._SL; world.add(m); pools.rail.push(m); }
    const bl = ['blda', 'bldc', 'blde', 'bldg', 'bldj'].map(n => { const w = fit(M[n].scene.clone(), 'x', 6); w.scale.y = 0.55; return w; });
    const row = new THREE.Group(); for (const side of [-1, 1]) for (let i = 0; i < 8; i++) { const m = bl[(i * 3 + (side > 0 ? 2 : 0)) % bl.length].clone(); m.position.set(side * (LANE * 1.5 + 6.5), 0, -i * 10); m.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; m.scale.y = 0.45 + ((i * 7) % 5) * 0.12; row.add(m); }
    const lamp = fit(M.lamp.scene.clone(), 'y', 4.2); for (const side of [-1, 1]) for (let i = 0; i < 4; i++) { const m = lamp.clone(); m.position.set(side * (LANE * 1.5 + 1.2), 0, -i * 20 - 5); m.rotation.y = side > 0 ? Math.PI : 0; row.add(m); }
    const rb = bake(row); for (let k = 0; k < 2; k++) { const m = k ? rb.clone() : rb; m.userData.z0 = -k * 80; world.add(m); pools.bld.push(m); }
    const car = fit(M.train.scene.clone(), 'x', 2.1); const cb = new THREE.Box3().setFromObject(car), cs = new THREE.Vector3(); cb.getSize(cs); const train = new THREE.Group(); for (let i = 0; i < 3; i++) { const k = car.clone(); k.position.z = (i - 1) * (cs.z + 0.15); if (i) k.rotation.y = Math.PI; train.add(k); }
    const bar0 = M.barrier.scene.clone(); bar0.rotation.y = Math.PI / 2; const barrier = fit(bar0, 'x', 2.1);
    cfg._proto = { train, coin: fit(M.coin.scene.clone(), 'y', 0.6), barrier };
    const tb = new THREE.Box3().setFromObject(cfg._proto.train), ts = new THREE.Vector3(); tb.getSize(ts); cfg._TL = ts.z; cfg._TH = ts.y;
    scene.add(coinGlow);
  }
  function mk(kind, lane, z, extra) { const P = cfg._proto; let o;
    if (kind === 'train') { o = P.train.clone(); if (extra.moving) o.rotation.y = Math.PI; }
    else if (kind === 'coin') { o = P.coin.clone(); }
    else if (kind === 'low') { o = P.barrier.clone(); }
    else if (kind === 'high') { o = new THREE.Group(); const bar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.45, 0.25), hazard); bar.position.y = 1.55; bar.castShadow = true; o.add(bar); for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.8, 8), post); p.position.set(s * 1.05, 0.9, 0); p.castShadow = true; o.add(p); } }
    else if (kind === 'ramp') { const L = 4.5; o = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, L), rampMat); o.rotation.x = Math.atan2(cfg._TH, L); o.position.y = cfg._TH / 2; o.castShadow = o.receiveShadow = true; const gg = new THREE.Group(); gg.add(o); o = gg; }
    o.position.set(lane * LANE, extra.y || 0, z); world.add(o); const it = Object.assign({ kind, lane, z, o, y: extra.y || 0 }, extra); items.push(it); return it; }
  // spawn a row pattern starting at distance z (negative = ahead)
  function pattern(g, z) { const lv = Math.min(1, g.t / 120); const lanes = [-1, 0, 1].sort(() => g.rnd() - 0.5); let free = lanes[0];
    const r = g.rnd();
    if (r < 0.38) { // trains: 1-2 lanes, one maybe with ramp, one maybe moving
      const n = g.rnd() < 0.5 + lv * 0.3 ? 2 : 1; for (let i = 1; i <= n; i++) { const L = lanes[i]; const moving = g.rnd() < 0.15 + lv * 0.3 && i === 1; const ramp = !moving && g.rnd() < 0.45; if (ramp) mk('ramp', L, z + 2.25 + 0.3, {}); const t = mk('train', L, z - cfg._TL / 2, { moving, len: cfg._TL }); if (ramp || g.rnd() < 0.5) for (let k = 0; k < 6; k++) mk('coin', L, z - 2 - k * 2, { y: (ramp ? cfg._TH : 0) + 0.6, onTrain: ramp }); }
      for (let k = 0; k < 6; k++) mk('coin', free, z - k * 2.2, { y: 0.6 }); return cfg._TL + 10; }
    if (r < 0.7) { const kinds = ['low', 'high']; for (const L of [lanes[1], lanes[2]]) if (g.rnd() < 0.75) mk(g.pick(kinds), L, z, {}); const k = g.pick(kinds); mk(k, free, z - 14, {}); for (let i = 0; i < 5; i++) mk('coin', free, z + 4 - i * 2, { y: k === 'low' && i >= 3 ? 1.9 : 0.6 }); return 26 - lv * 6; }
    const L = lanes[1]; for (let i = 0; i < 8; i++) { const y = 0.6 + Math.sin(i / 7 * Math.PI) * 1.8; mk('coin', L, z - i * 1.6, { y }); } mk('low', L, z - 5.6, {}); return 22 - lv * 5; }

  let pre = null; await loading.catch(e => { pre = e; }); if (pre) throw pre; setup();
  const pl = { lane: 0, x: 0, y: 0, vy: 0, roll: 0, onTop: false, stumble: 0 };
  K.run({ id: cfg.id, title: cfg.title, help: cfg.help, bg: 'transparent', overText: 'CAUGHT',
    init(g) { for (const it of items) world.remove(it.o); items.length = 0; Object.assign(pl, { lane: 0, x: 0, y: 0, vy: 0, roll: 0, stumble: 0, ground: 0 }); g.z = 0; g.sp = cfg.speed || 15; g.next = -30; g.lastM = 0; g.coins = 0; g.combo = 0; hero.position.set(0, 0, 0); play('sprint'); g.camX = 0; },
    update(g, dt) {
      mixer.update(g.state === 'play' ? dt : dt * 0.3); if (g.state !== 'play') return;
      g.sp = Math.min(34, (cfg.speed || 15) + g.t * 0.12); g.z -= g.sp * dt; const m = Math.floor(-g.z / 2); if (m > g.lastM) { g.add(m - g.lastM, 'm'); g.lastM = m; }
      const P = g.ptr; let sw = null; if (P.released) { const dx = P.x - P.sx, dy = P.y - P.sy; if (Math.abs(dx) > 25 && Math.abs(dx) > Math.abs(dy)) sw = dx > 0 ? 'r' : 'l'; else if (Math.abs(dy) > 25) sw = dy < 0 ? 'u' : 'd'; else sw = 'u'; }
      if (g.kd('ArrowLeft') || g.kd('a')) sw = 'l'; if (g.kd('ArrowRight') || g.kd('d')) sw = 'r'; if (g.kd('ArrowUp') || g.kd('w') || g.kd(' ')) sw = 'u'; if (g.kd('ArrowDown') || g.kd('s')) sw = 'd';
      if (sw === 'l' && pl.lane > -1) { pl.lane--; g.sfx('whoosh'); } if (sw === 'r' && pl.lane < 1) { pl.lane++; g.sfx('whoosh'); }
      const grounded = pl.y <= pl.ground + 0.001; if (sw === 'u' && grounded) { pl.vy = JUMP; pl.roll = 0; g.sfx('jump'); play('jump', 0.08); } if (sw === 'd') { if (!grounded) pl.vy = -26; pl.roll = 0.65; play('crouch', 0.08); g.sfx('whoosh'); }
      const prevX = pl.x; pl.x = K.lerp(pl.x, pl.lane * LANE, Math.min(1, dt * 14)); pl.roll = Math.max(0, pl.roll - dt); pl.stumble = Math.max(0, pl.stumble - dt);
      // ground height: train roofs (reach via ramp or by landing from a jump)
      let gh = 0; for (const it of items) { const iz = it.z - g.z; if (it.kind === 'train' && Math.abs(it.lane * LANE - pl.x) < 1.1 && iz - it.len / 2 < 0.4 && iz + it.len / 2 > -0.4 && pl.y >= cfg._TH - 0.35) gh = cfg._TH; if (it.kind === 'ramp' && Math.abs(it.lane * LANE - pl.x) < 1 && iz < 2.25 && iz > -2.25) gh = Math.max(gh, cfg._TH * (2.25 - iz) / 4.5); }
      pl.ground = gh; pl.vy -= GRAV * dt; pl.y += pl.vy * dt; if (pl.y < gh) { if (pl.vy < -2 && cur === acts.jump) play(pl.roll > 0 ? 'crouch' : 'sprint', 0.1); pl.y = gh; pl.vy = 0; }
      if (grounded && pl.roll <= 0 && cur !== acts.sprint && cur !== acts.jump) play('sprint'); if (grounded && cur === acts.jump && pl.vy === 0) play('sprint');
      // collisions
      for (const it of items) { if (it.dead) continue; if (it.moving) it.z += 10 * dt; const iz = it.z - g.z; const dx = Math.abs(it.lane * LANE - pl.x);
        if (it.kind === 'coin') { if (dx < 1 && Math.abs(iz) < 0.8 && Math.abs(it.y - (pl.y + 0.8)) < 1.1) { it.dead = true; world.remove(it.o); g.coins++; g.add(cfg.coinV || 10, 'c'); g.sfx('coin'); coinGlow.position.set(pl.x, pl.y + 1, 0); coinGlow.intensity = 6; const v = new THREE.Vector3(it.lane * LANE, it.y, iz).project(cam); g.burst((v.x + 1) / 2 * g.W, (1 - v.y) / 2 * g.H, ['#fde047', '#fbbf24', '#fff'], 10, 140, 0.4, 4); } continue; }
        if (dx > 1.1) continue; let hit = false;
        if (it.kind === 'train') { if (iz + it.len / 2 > -0.3 && iz - it.len / 2 < 0.3 && pl.y < cfg._TH - 0.4) hit = Math.abs(iz - it.len / 2) < 1.2 || it.moving ? 'front' : 'side'; }
        if (it.kind === 'low' && Math.abs(iz) < 0.45 && pl.y < 1.0) hit = 'front'; if (it.kind === 'high' && Math.abs(iz) < 0.35 && pl.roll <= 0 && pl.y < 1.4) hit = 'front';
        if (hit === 'side' || (hit && Math.abs(prevX - pl.x) > 0.05 && dx > 0.5)) { pl.lane = Math.round(prevX / LANE); pl.x = prevX; if (pl.stumble > 0) return die(g, 'Tripped twice'); pl.stumble = 4; g.shake(6); g.sfx('hit'); g.float(g.W / 2, g.H * 0.4, 'STUMBLE!', '#fbbf24', 22); continue; }
        if (hit) return die(g, it.kind === 'train' ? 'Hit a train' : 'Hit a barrier'); }
      for (const it of items) if (!it.dead && it.z - g.z > 12) { it.dead = true; world.remove(it.o); }
      for (let i = items.length - 1; i >= 0; i--) if (items[i].dead) items.splice(i, 1);
      while (g.next > g.z - 120) { g.next -= pattern(g, g.next); }
      coinGlow.intensity = Math.max(0, coinGlow.intensity - dt * 30);
      g.hud = g.coins + ' coins' + (pl.stumble > 0 ? '  !' : '');
    },
    draw(g, c) { c.clearRect(0, 0, g.W, g.H); // 3D frame
      hero.position.set(pl.x, pl.y, 0); hero.rotation.z = (pl.lane * LANE - pl.x) * -0.08; hero.scale.y = 1;
      for (const it of items) { it.o.position.z = it.z - g.z; if (it.kind === 'coin') { it.o.rotation.y = g.t * 4 + it.z; it.o.position.y = it.y + Math.sin(g.t * 5 + it.z) * 0.08; } }
            const SL = cfg._SL; for (const m of pools.rail) { const z0 = m.userData.z0; m.position.z = ((((z0 - g.z) % (2 * SL)) + 2 * SL) % (2 * SL)) - SL + 12; }
      for (const m of pools.bld) { const z0 = m.userData.z0; m.position.z = ((((z0 - g.z) % 160) + 160) % 160) - 80 + 12; }
      ground.material.map.offset.y = (g.z / 8) % 1;
      g.camX = K.lerp(g.camX, pl.x * 0.7, 0.12); const shake = g.shakeT > 0 ? g.shakeM * 0.02 : 0; cam.fov = 60 + (g.sp - 15) * 0.45; cam.updateProjectionMatrix();
      cam.position.set(g.camX + (Math.random() - 0.5) * shake, 4.3 + pl.y * 0.55, 7.8); cam.lookAt(g.camX, 1.2 + pl.y * 0.5, -6);
      sun.position.set(pl.x + 6, 14, 6); sun.target.position.set(pl.x, 0, -6); S.render();
      if (g.state === 'play' && g.sp > 20) { c.strokeStyle = `rgba(255,255,255,${Math.min(0.35, (g.sp - 20) * 0.03)})`; c.lineWidth = 2; c.beginPath(); for (let i = 0; i < 14; i++) { const a = (i * 2.399 + g.t * 0.7) % 6.283, r0 = 160 + ((g.t * 900 + i * 97) % 220); c.moveTo(g.W / 2 + Math.cos(a) * r0, g.H * 0.4 + Math.sin(a) * r0); c.lineTo(g.W / 2 + Math.cos(a) * (r0 + 40), g.H * 0.4 + Math.sin(a) * (r0 + 40)); } c.stroke(); }
      if (g.state === 'play' && pl.stumble > 0) { c.fillStyle = `rgba(239,68,68,${0.15 + Math.sin(g.t * 10) * 0.08})`; c.fillRect(0, 0, 10, g.H); c.fillRect(g.W - 10, 0, 10, g.H); }
    } });
  function die(g, why) { play('die', 0.05); g.flash('#fff', 0.15); g.end(why); }
}
