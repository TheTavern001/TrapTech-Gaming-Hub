// Road Hopper - original lane-crossing hopper (Hub build). Voxel 3D world (three.js, code-built), angled chase camera.
import * as THREE from 'three'; import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'; import { stage, bake } from '../runner3x.js';
const S = stage({}); const { scene, cam, sun, hemi } = S; scene.background = new THREE.Color('#9fd8f5'); scene.fog = new THREE.Fog('#9fd8f5', 22, 40); hemi.intensity = 1.3; hemi.groundColor.set('#6a8a5a'); sun.intensity = 2.4; sun.position.set(6, 14, 6); S.r.toneMappingExposure = 1.05;
const MC = new Map(); const mat = (c, o) => { const k = c + JSON.stringify(o || {}); if (!MC.has(k)) MC.set(k, new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8 }, o))); return MC.get(k); };
const GC = new Map(); const GCS = new Set(); const COING = new THREE.CylinderGeometry(0.22, 0.22, 0.07, 20); GCS.add(COING); const rbox = (w, h, d, r) => { const k = [w, h, d, r].join(); if (!GC.has(k)) { const gg = new RoundedBoxGeometry(w, h, d, 1, r || 0.04); GC.set(k, gg); GCS.add(gg); } return GC.get(k); };
const mesh = (geo, m, x, y, z, sh) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = sh !== false; o.receiveShadow = true; return o; };
const WATERG = new THREE.BoxGeometry(30, 0.3, 1); GCS.add(WATERG);
const XC = (col) => col - 4.5;
function rowMesh(R, i) { const g = new THREE.Group(); g.position.z = -i; const W = 30;
  if (R.t === 'g') { g.add(mesh(rbox(W, 0.4, 1, 0.02), mat(i % 2 ? '#8ed46a' : '#82c95f'), 0, -0.2, 0, false)); for (let x = -15; x < 15; x++) if (x < -5 || x > 4) { if ((x * 7 + i * 3) % 5 === 0) addTree(g, x + 0.5, i); } for (const x of R.trees) addTree(g, XC(x), i);
    if ((i * 13) % 7 === 0) g.add(mesh(rbox(0.25, 0.12, 0.25), mat('#f6f0a8'), XC((i * 3) % 10) + 0.3, 0.06, 0.2, false)); }
  else if (R.t === 'r') { g.add(mesh(rbox(W, 0.36, 1, 0.01), mat('#4b4f58'), 0, -0.2, 0, false)); for (let x = -14; x < 14; x += 1.4) g.add(mesh(rbox(0.6, 0.02, 0.06, 0.005), mat('#e8e8e8'), x, 0, 0.47, false)); }
  else if (R.t === 'w') { const w = mesh(WATERG, mat('#3fb6e8', { roughness: 0.25, metalness: 0.1 }), 0, -0.35, 0, false); g.add(w); g.userData.water = w; }
  else { g.add(mesh(rbox(W, 0.38, 1, 0.01), mat('#8a7e72'), 0, -0.2, 0, false)); for (let x = -14; x < 14; x += 0.5) g.add(mesh(rbox(0.18, 0.06, 0.9, 0.01), mat('#6b4a32'), x, 0.01, 0, false)); for (const z of [-0.25, 0.25]) g.add(mesh(rbox(W, 0.06, 0.06, 0.01), mat('#c9ccd2', { metalness: 0.8, roughness: 0.35 }), 0, 0.06, z, false));
    const pole = new THREE.Group(); pole.add(mesh(rbox(0.08, 1.1, 0.08), mat('#ddd'), 0, 0.55, 0)); const lamp = mesh(rbox(0.3, 0.3, 0.1), mat('#401010', { emissive: '#ff2020', emissiveIntensity: 0 }), 0, 1.15, 0.05); pole.add(lamp); pole.position.set(XC(-0.6), 0, 0.45); g.add(pole); g.userData.lamp = lamp; }
  const lamp = g.userData.lamp, water = g.userData.water; if (lamp) lamp.parent.remove(lamp); if (water) g.remove(water); const st = new THREE.Group(); st.position.z = -i; g.position.z = 0; const bk = bake(g, true); bk.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); st.add(bk); if (water) { water.position.z = 0; st.add(water); st.userData.water = water; } if (lamp) { lamp.position.set(XC(-0.6), 1.15, 0.5); st.add(lamp); st.userData.lamp = lamp; } return st; }
function addTree(g, x, i) { const h = 1 + ((x * 31 + i * 17) & 1); g.add(mesh(rbox(0.25, 0.4, 0.25), mat('#7a5232'), x, 0.2, 0)); for (let k = 0; k < h; k++) g.add(mesh(rbox(0.7 - k * 0.12, 0.45, 0.7 - k * 0.12, 0.06), mat(k ? '#5cb85c' : '#4aa64a'), x, 0.62 + k * 0.42, 0)); }
const CARC = ['#e8413c', '#2f7fe0', '#ffc531', '#7a5cff', '#ff8a2a'];
function carMesh(w, col, dir) { const g = new THREE.Group(); const big = w > 2; const L = w * 0.92;
  g.add(mesh(rbox(L, big ? 0.7 : 0.42, 0.72, 0.06), mat(big ? '#eef0f2' : col), 0, big ? 0.55 : 0.36, 0));
  if (!big) { g.add(mesh(rbox(L * 0.55, 0.3, 0.64, 0.05), mat(col), -dir * L * 0.06, 0.7, 0)); g.add(mesh(rbox(L * 0.5, 0.2, 0.66, 0.03), mat('#20303f', { roughness: 0.15, metalness: 0.3 }), -dir * L * 0.06, 0.7, 0, false)); }
  else { g.add(mesh(rbox(0.5, 0.55, 0.7, 0.05), mat(col), dir * (L / 2 - 0.25), 0.45, 0)); g.add(mesh(rbox(0.06, 0.25, 0.6, 0.02), mat('#20303f'), dir * (L / 2 + 0.01), 0.55, 0, false)); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(rbox(0.26, 0.26, 0.12, 0.05), mat('#1b1b1e'), sx * L * 0.32, 0.15, sz * 0.36, false));
  g.add(mesh(rbox(0.04, 0.1, 0.14, 0.01), mat('#fff6d0', { emissive: '#fff1c0', emissiveIntensity: 0.8 }), dir * L / 2, 0.38, 0.22, false)); g.add(mesh(rbox(0.04, 0.1, 0.14, 0.01), mat('#fff6d0', { emissive: '#fff1c0', emissiveIntensity: 0.8 }), dir * L / 2, 0.38, -0.22, false)); return g; }
function logMesh(w) { const g = new THREE.Group(); g.add(mesh(rbox(w - 0.15, 0.32, 0.7, 0.12), mat('#8a5a34'), w / 2 - 0.5, -0.12, 0)); g.add(mesh(rbox(0.06, 0.26, 0.6, 0.1), mat('#c99a66'), -0.5 + 0.06, -0.12, 0, false)); g.add(mesh(rbox(0.06, 0.26, 0.6, 0.1), mat('#c99a66'), w - 0.5 - 0.15, -0.12, 0, false)); return g; }
function trainMesh() { const g = new THREE.Group(); for (let k = 0; k < 4; k++) { g.add(mesh(rbox(2.85, 0.95, 0.8, 0.08), mat(k ? '#2f7d4a' : '#c43c2c'), k * 3 + 1.5, 0.62, 0)); g.add(mesh(rbox(2.6, 0.25, 0.82, 0.04), mat('#f2c94c'), k * 3 + 1.5, 0.75, 0, false)); } return g; }
function coinMesh() { const o = mesh(COING, mat('#ffcf3a', { metalness: 0.8, roughness: 0.25, emissive: '#6a4a00', emissiveIntensity: 0.4 }), 0, 0.45, 0); o.rotation.x = Math.PI / 2; return o; }
function heroMesh() { const g = new THREE.Group(); const b = new THREE.Group(); g.add(b); b.add(mesh(rbox(0.56, 0.52, 0.56, 0.1), mat('#fff4dc'), 0, 0.3, 0)); b.add(mesh(rbox(0.6, 0.16, 0.6, 0.06), mat('#f0c96a'), 0, 0.08, 0));
  for (const sx of [-0.13, 0.13]) { b.add(mesh(rbox(0.13, 0.15, 0.06, 0.03), mat('#fff'), sx, 0.42, -0.29, false)); b.add(mesh(rbox(0.06, 0.08, 0.03, 0.015), mat('#111'), sx, 0.42, -0.32, false)); }
  b.add(mesh(rbox(0.16, 0.06, 0.04, 0.02), mat('#d84a3a'), 0, 0.26, -0.29, false)); for (const r of [-0.5, 0, 0.5]) { const l = mesh(rbox(0.08, 0.3, 0.03, 0.03), mat('#2e8a3e'), Math.sin(r) * 0.12, 0.66, 0); l.rotation.z = r; b.add(l); } g.userData.b = b; return g; }
const PR = new Map(); function proto(k, mk) { if (!PR.has(k)) { const b = bake(mk(), true); b.traverse(m => { if (m.isMesh) m.castShadow = true; }); PR.set(k, b); } return PR.get(k).clone(); }
const rowsG = new THREE.Group(), dyn = new THREE.Group(); scene.add(rowsG, dyn); const hero = heroMesh(); scene.add(hero); const shadowM = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.25, depthWrite: false })); shadowM.rotation.x = -Math.PI / 2; scene.add(shadowM);
const built = new Map(); let frame = 0, camX = 0, camZ = 0, gRef = null;
function render3d(g) { frame++; if (gRef !== g || g.__new) { gRef = g; } const lo = Math.floor(g.cam) - 6, hi = Math.floor(g.cam) + 22;
  if (built.__rows !== g.rows) { for (const o of built.values()) { rowsG.remove(o); o.traverse(m => { if (m.isMesh && !GCS.has(m.geometry)) m.geometry.dispose(); }); } built.clear(); built.__rows = g.rows; }
  const kill = (o) => { rowsG.remove(o); o.traverse(m => { if (m.isMesh && m.geometry.userData.baked !== false && !GCS.has(m.geometry)) m.geometry.dispose(); }); };
  for (const [i, o] of built) if (i < lo || i > hi) { kill(o); built.delete(i); }
  for (let i = Math.max(0, lo); i <= hi; i++) { const R = g.rows[i]; if (!R) continue; if (!built.has(i)) { const o = rowMesh(R, i); built.set(i, o); rowsG.add(o); } const o = built.get(i);
    if (o.userData.lamp) o.userData.lamp.material = mat('#401010', { emissive: '#ff2020', emissiveIntensity: R.warn && Math.sin(g.t * 20) > 0 ? 3 : 0 });
    if (R.t === 'r') R.cars.forEach((c, k) => { if (!c.o) c.o = proto('car' + c.w + CARC[(i * 3 + k) % CARC.length] + Math.sign(R.sp), () => carMesh(c.w, CARC[(i * 3 + k) % CARC.length], Math.sign(R.sp))); c.o.position.set(XC(c.x), 0, -i); c.o.userData.f = frame; if (!c.o.parent) dyn.add(c.o); });
    if (R.t === 'w') { o.userData.water.position.y = -0.35 + Math.sin(g.t * 2 + i) * 0.02; for (const L of R.logs) { if (!L.o) L.o = proto('log' + L.w, () => logMesh(L.w)); L.o.position.set(XC(L.x), Math.sin(g.t * 3 + L.x) * 0.02, -i); L.o.userData.f = frame; if (!L.o.parent) dyn.add(L.o); } }
    if (R.t === 't' && R.train) { if (!R.train.o) R.train.o = proto('train', trainMesh); R.train.o.position.set(XC(R.train.x), 0, -i); R.train.o.userData.f = frame; if (!R.train.o.parent) dyn.add(R.train.o); }
    for (let x = 0; x < 10; x++) if (g.coins.has(i + ',' + x)) { const k = 'c' + i + ',' + x; let c = dyn.getObjectByName(k); if (!c) { c = coinMesh(); c.name = k; dyn.add(c); } c.position.set(XC(x), 0.45 + Math.sin(g.t * 4 + x) * 0.06, -i); c.rotation.z = g.t * 3; c.userData.f = frame; } }
  for (let k = dyn.children.length - 1; k >= 0; k--) if (dyn.children[k].userData.f !== frame) dyn.remove(dyn.children[k]);
  const p = g.p; const fx = THREE.MathUtils.lerp(p.hx, p.x, p.ht), fy = THREE.MathUtils.lerp(p.hy, p.y, p.ht); const R = g.rows[p.y]; const px = XC(R && R.t === 'w' && p.ht >= 1 ? p.x : fx); const hop = Math.sin(Math.min(1, p.ht) * Math.PI) * 0.55; const onW = R && R.t === 'w' && p.ht >= 1;
  hero.position.set(px, hop + (onW ? 0.12 : 0), -fy); const b = hero.userData.b; const sq = p.ht < 0.15 ? 0.8 : p.ht < 1 ? 1.12 : 1; b.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq)); hero.rotation.y = THREE.MathUtils.lerp(hero.rotation.y, p.dir || 0, 0.3);
  if (g.state === 'over') { b.scale.set(1.35, 0.25, 1.35); }
  shadowM.position.set(px, 0.02 + (onW ? 0.1 : 0), -fy); shadowM.scale.setScalar(1 - hop * 0.6);
  camX = THREE.MathUtils.lerp(camX, Math.max(-2, Math.min(2, px)), 0.08); camZ = -g.cam;
  cam.position.set(camX + 2.6, 8.6, camZ + 5.2); cam.lookAt(camX - 0.4, 0, camZ - 4.6); sun.position.set(camX + 5, 12, camZ + 4); sun.target.position.set(camX, 0, camZ - 3); S.render(); }
window.__GL3 = () => S.r.info.render;
(function () {
  const TS = 40, COLS = 10;
  function row(g, i) { if (i < 4) return { t: 'g', trees: i > 0 ? [0, 9] : [] }; const lvl = Math.min(1, i / 300); const r = g.rnd();
    if (r < 0.38) return { t: 'r', sp: g.R(70, 120 + 120 * lvl) * (g.rnd() < 0.5 ? -1 : 1), cars: [], gap: g.R(150, 260), next: 0, col: g.pick(['#ef4444', '#3b82f6', '#fbbf24', '#a855f7', '#f97316']) };
    if (r < 0.58) return { t: 'w', sp: g.R(45, 90 + 50 * lvl) * (g.rnd() < 0.5 ? -1 : 1), logs: [], next: 0 };
    if (r < 0.66 && i > 12) return { t: 't', warn: 0, train: null, cd: g.R(2, 5) };
    const trees = []; for (let x = 0; x < COLS; x++) if (g.rnd() < 0.18) trees.push(x); return { t: 'g', trees }; }
  Kit.run({ id: 'gl-road-hopper', title: 'ROAD HOPPER', help: 'Tap / Up to hop forward, swipe or arrows to dodge\nDon\'t stall - the hawk is watching', bg: 'rgba(0,0,0,0)',
    init(g) { g.rows = []; for (let i = 0; i < 30; i++) g.rows.push(row(g, i)); g.p = { x: 4, y: 0, hx: 4, hy: 0, ht: 1, on: null }; g.cam = 0; g.best = g.best; g.far = 0; g.idle = 0; g.coins = new Set(); for (let i = 5; i < 30; i++) if (g.rnd() < 0.15) g.coins.add(i + ',' + g.RI(0, 9)); },
    update(g, dt) {
      const p = g.p; p.ht = Math.min(1, p.ht + dt * 9);
      let mv = null; if (g.kd('ArrowUp') || g.kd('w') || g.kd(' ')) mv = [0, 1]; if (g.kd('ArrowDown') || g.kd('s')) mv = [0, -1]; if (g.kd('ArrowLeft') || g.kd('a')) mv = [-1, 0]; if (g.kd('ArrowRight') || g.kd('d')) mv = [1, 0];
      if (g.ptr.released) { const dx = g.ptr.x - g.ptr.sx, dy = g.ptr.y - g.ptr.sy; mv = Math.hypot(dx, dy) < 20 ? [0, 1] : Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, -Math.sign(dy)]; }
      if (mv && p.ht >= 0.6) { const nx = Math.round(p.x) + mv[0], ny = p.y + mv[1]; const R = g.rows[ny]; if (nx >= 0 && nx < COLS && ny >= 0 && !(R && R.t === 'g' && R.trees.includes(nx))) { p.hx = p.x; p.hy = p.y; p.x = nx; p.y = ny; p.dir = mv[0] ? -mv[0] * Math.PI / 2 : mv[1] < 0 ? Math.PI : 0; p.ht = 0; g.sfx('jump'); g.idle = 0; if (ny > g.far) { g.add(ny - g.far, 'r'); g.far = ny; } const ck = ny + ',' + nx; if (g.coins.delete(ck)) { g.add(5, 'c'); g.sfx('coin'); g.float(g.W / 2, 300, '+5', '#fbbf24'); } } }
      while (g.rows.length < p.y + 25) { const i = g.rows.length; g.rows.push(row(g, i)); if (g.rnd() < 0.15) g.coins.add(i + ',' + g.RI(0, 9)); }
      g.idle += dt; const tc = p.y - 3; g.cam = Kit.lerp(g.cam, tc, dt * 3); if (p.y < g.cam - 2.2 || g.idle > 8) { return g.end(g.idle > 8 ? 'Too slow - the hawk got you' : 'Left behind'); }
      for (let i = Math.max(0, p.y - 8); i < p.y + 16; i++) { const R = g.rows[i]; if (!R) continue;
        if (R.t === 'r') { R.next -= dt; if (R.next <= 0) { R.next = R.gap / Math.abs(R.sp) + g.R(0.3, 1.6); R.cars.push({ x: R.sp > 0 ? -2 : COLS + 1, w: g.rnd() < 0.2 ? 2.4 : 1.4 }); } for (const c of R.cars) c.x += R.sp / TS * dt; R.cars = R.cars.filter(c => c.x > -4 && c.x < COLS + 4);
          if (i === p.y && p.ht > 0.5) for (const c of R.cars) if (p.x + 0.35 > c.x - c.w / 2 && p.x - 0.35 < c.x + c.w / 2) { g.burst(g.W / 2, 0, '#fff', 1); squash(g); return g.end('Flattened'); } }
        if (R.t === 'w') { R.next -= dt; if (R.next <= 0) { R.next = g.R(1.1, 2.2) * 70 / Math.abs(R.sp); R.logs.push({ x: R.sp > 0 ? -3 : COLS + 2, w: g.pick([2, 3, 3, 4]) }); } for (const L of R.logs) L.x += R.sp / TS * dt; R.logs = R.logs.filter(L => L.x > -5 && L.x < COLS + 5); }
        if (R.t === 't') { R.cd -= dt; if (!R.train && R.cd < 1.2 && R.cd > 0) R.warn = 1; if (R.cd <= 0 && !R.train) { R.train = { x: -14, sp: 22 }; R.warn = 0; } if (R.train) { R.train.x += R.train.sp * dt; if (i === p.y && p.x > R.train.x && p.x < R.train.x + 12) { squash(g); return g.end('Hit by a train'); } if (R.train.x > COLS + 2) { R.train = null; R.cd = g.R(3, 7); } } }
      }
      const R = g.rows[p.y]; if (R && R.t === 'w' && p.ht >= 1) { const L = R.logs.find(L => p.x > L.x - 0.6 && p.x < L.x + L.w - 0.4); if (!L) { g.burst(g.W / 2, 400, '#38bdf8', 30, 160); g.sfx('whoosh'); return g.end('Splash!'); } p.x += R.sp / TS * dt; if (p.x < -0.4 || p.x > COLS - 0.6) return g.end('Swept away'); }
      else if (p.ht >= 1) p.x = Math.round(p.x) === p.x ? p.x : Kit.lerp(p.x, Math.round(p.x), Math.min(1, dt * 12));
      g.hud = g.far + ' rows';
    },
    draw(g, c) { c.clearRect(0, 0, g.W, g.H); render3d(g);
    } });
  function squash(g) { g.sfx('hit'); g.shake(10); g.flash('#ef4444'); }
})();
