// Most Wanted Run - original police-chase survival (Hub build). Voxel 3D world (three.js, code-built, original art).
import * as THREE from 'three'; import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'; import { stage, bake, canvasTex } from '../runner3x.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
const S3 = stage({}); const { scene, cam, sun, hemi } = S3; scene.background = new THREE.Color('#9fd8f5'); scene.fog = new THREE.Fog('#9fd8f5', 38, 70); hemi.intensity = 1.25; hemi.groundColor.set('#6a8a5a'); sun.intensity = 2.5;
S3.r.shadowMap.type = THREE.PCFSoftShadowMap; sun.shadow.radius = 3; { const sc = sun.shadow.camera; sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.far = 90; sc.updateProjectionMatrix(); }
const K = 1 / 20;
function aoTint(gg, h) { const P = gg.attributes.position, n = P.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const t = (P.getY(i) + h / 2) / Math.max(h, 0.01); const v = 0.7 + 0.3 * Math.pow(Math.min(1, t * 1.6), 0.7); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = v; } gg.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
const MC = new Map(); const mat = (c, o) => { const k = c + JSON.stringify(o || {}); if (!MC.has(k)) MC.set(k, new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.75, vertexColors: true }, o))); return MC.get(k); };
const GC = new Map(); const rbox = (w, h, d, r) => { const k = [w, h, d, r].join(); if (!GC.has(k)) { const gg = new RoundedBoxGeometry(w, h, d, 2, r || 0.06); aoTint(gg, h); GC.set(k, gg); } return GC.get(k); };
const mesh = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; };
// ground: tiled grass with a road cross at each 400px block edge
const groundTex = canvasTex(512, 512, (x, w, h) => { x.fillStyle = '#6fbf4a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 1600; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(40,110,30,.25)' : 'rgba(170,230,120,.22)'; x.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
  const rw = 512 * 60 / 400, sw = 8; const road = (horiz) => { x.save(); if (horiz) { x.translate(0, 0); } x.fillStyle = '#c9c4b8'; if (horiz) x.fillRect(0, -rw / 2 - sw, w, rw + 2 * sw); else x.fillRect(-rw / 2 - sw, 0, rw + 2 * sw, h); x.fillStyle = '#4a4d55'; if (horiz) x.fillRect(0, -rw / 2, w, rw); else x.fillRect(-rw / 2, 0, rw, h); x.fillStyle = '#f2d24a'; for (let k = 0; k < 512; k += 40) { if (horiz) x.fillRect(k, -2, 22, 4); else x.fillRect(-2, k, 4, 22); } x.restore(); };
  for (const [ox, oy] of [[0, 0], [512, 0], [0, 512], [512, 512]]) { x.save(); x.translate(ox, oy); road(true); road(false); x.restore(); } }, true);
groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping; groundTex.repeat.set(6, 6); groundTex.anisotropy = 4;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.9 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
function treeProto() { const g = new THREE.Group(); g.add(mesh(rbox(0.35, 0.8, 0.35), mat('#7a5232'), 0, 0.4, 0)); g.add(mesh(rbox(1.3, 0.9, 1.3, 0.12), mat('#4aa64a'), 0, 1.2, 0)); g.add(mesh(rbox(0.9, 0.7, 0.9, 0.1), mat('#5cbf55'), 0, 1.9, 0)); return bake(g, true); }
function rockProto() { const g = new THREE.Group(); g.add(mesh(rbox(1.2, 0.7, 1.0, 0.15), mat('#8a8f98'), 0, 0.35, 0)); g.add(mesh(rbox(0.7, 0.5, 0.6, 0.12), mat('#a3a8b0'), 0.3, 0.8, 0.1)); return bake(g, true); }
const SIGN = canvasTex(256, 64, (x, w, h) => { x.fillStyle = '#123d24'; x.fillRect(0, 0, w, h); x.fillStyle = '#7dff9a'; x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('\u2618 DISPENSARY 21+', w / 2, h / 2); });
function houseProto(col, disp) { const g = new THREE.Group(); g.add(mesh(rbox(2.4, 1.6, 2.0, 0.08), mat(col), 0, 0.8, 0)); g.add(mesh(rbox(2.6, 0.5, 2.2, 0.08), mat('#b0453a'), 0, 1.85, 0)); g.add(mesh(rbox(0.5, 0.8, 0.06, 0.02), mat('#5a3a1e'), 0, 0.4, 1.01)); for (const sx of [-0.7, 0.7]) g.add(mesh(rbox(0.45, 0.4, 0.06, 0.02), mat('#9fd8ff', { roughness: 0.2 }), sx, 0.95, 1.01)); const b = bake(g, true);
  if (disp) { const s = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.48), new THREE.MeshStandardMaterial({ map: SIGN, emissive: '#ffffff', emissiveMap: SIGN, emissiveIntensity: 0.6 })); s.position.set(0, 1.35, 1.05); b.add(s); } return b; }
function carProto(body, roof, cop, tank) { const g = new THREE.Group(); const L = tank ? 2.0 : 1.7, W = tank ? 1.1 : 0.9;
  g.add(mesh(rbox(L, 0.42, W, 0.1), mat(body, { metalness: 0.3, roughness: 0.45 }), 0, 0.38, 0)); g.add(mesh(rbox(L * 0.5, 0.34, W * 0.86, 0.08), mat(roof, { metalness: 0.2, roughness: 0.4 }), -0.1, 0.74, 0)); g.add(mesh(rbox(L * 0.46, 0.22, W * 0.9, 0.04), mat('#1d2a3a', { roughness: 0.15, metalness: 0.4 }), -0.1, 0.74, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(rbox(0.36, 0.36, 0.16, 0.07), mat('#1b1b1e'), sx * L * 0.3, 0.18, sz * W * 0.5));
  for (const sz of [-0.3, 0.3]) g.add(mesh(rbox(0.05, 0.1, 0.18, 0.02), mat('#fff6d0', { emissive: '#fff1c0', emissiveIntensity: 1 }), L / 2, 0.42, sz * W));
  if (cop) { g.add(mesh(rbox(L * 0.98, 0.1, W * 1.01, 0.03), mat('#1a1f2e'), 0, 0.5, 0)); }
  if (tank) { g.add(mesh(rbox(0.8, 0.3, 0.8, 0.1), mat('#0a3a2a'), 0, 1.0, 0)); g.add(mesh(rbox(1.0, 0.14, 0.14, 0.05), mat('#0a3a2a'), 0.5, 1.05, 0)); }
  const b = bake(g, true); if (cop) { const r = new THREE.Mesh(rbox(0.16, 0.12, 0.28, 0.03), new THREE.MeshStandardMaterial({ color: '#ff2020', emissive: '#ff2020', emissiveIntensity: 2 })), bl = new THREE.Mesh(rbox(0.16, 0.12, 0.28, 0.03), new THREE.MeshStandardMaterial({ color: '#2040ff', emissive: '#2040ff', emissiveIntensity: 2 })); r.position.set(-0.1, 0.97, -0.16); bl.position.set(-0.1, 0.97, 0.16); b.add(r, bl); b.userData.lights = [r, bl]; } return b; }
const PROTO = { t: treeProto(), r: rockProto(), h: [houseProto('#f2e6c4', false), houseProto('#c4e0f2', false), houseProto('#f2c4c4', true)] };
const objG = new THREE.Group(), carG = new THREE.Group(); scene.add(objG, carG);
const player = new THREE.Group(); scene.add(player);
const fallbackCar = carProto('#ff7a1a', '#c2410c', false, false); player.add(fallbackCar);
const copP = carProto('#f4f6fa', '#1a1f2e', true, false), tankP = carProto('#0f5a3e', '#063a28', false, true);
// Authentic Kenney Car Kit 3.1 CC0 meshes, not procedural Blender garage
// silhouettes. Visual swaps do not change physics, scoring or hitboxes.
// The single default is identical for every account and every scored run.
const VEHICLES = [["kc-police","Police Cruiser"],["kc-race-future","Future Racer"],["kc-suv-luxury","Luxury SUV"],["kc-ambulance","Ambulance"],["kc-firetruck","Fire Truck"],["kc-taxi","Taxi"],["kc-sedan-sports","Sports Sedan"],["kc-truck","Work Truck"],["kc-garbage-truck","Utility Truck"],["kc-delivery","Delivery Van"]];
const vehicleLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
let vehicleSeq=0;
async function sourceVehicle(id) {
  const seq=++vehicleSeq;
  if (!VEHICLES.some(v => v[0] === id)) return;
  try {
    const gltf=await vehicleLoader.loadAsync(new URL('../assets3d/'+id+'.glb',location.href).href);
    if (seq!==vehicleSeq) return;
    const model=gltf.scene.clone(true);
    let bounds=new THREE.Box3().setFromObject(model), size=bounds.getSize(new THREE.Vector3());
    if (size.z>size.x) { model.rotation.y=Math.PI/2; model.updateMatrixWorld(true);
      bounds=new THREE.Box3().setFromObject(model); size=bounds.getSize(new THREE.Vector3()); }
    if (!(size.x>0&&size.y>0&&size.z>0)) throw new Error('Vehicle mesh has invalid bounds');
    const k=Math.min(1.85/size.x,0.88/size.z,0.95/size.y),middle=bounds.getCenter(new THREE.Vector3());
    model.scale.multiplyScalar(k); model.position.set(-middle.x*k,0.18-bounds.min.y*k,-middle.z*k);
    model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    player.clear(); player.add(model);
  } catch(e) { console.warn('Vehicle GLB unavailable, preserving fallback:',e.message); }
}
// Preview *inside the driving game*, not a standalone public garage.
// No one receives extra cosmetics for free: QA-only URL ?vehicleQA=1;
// public users share the same default vehicle and identical driving physics.
if (new URLSearchParams(location.search).get('vehicleQA')==='1') {
  const panel=document.createElement('label');panel.textContent='PRIVATE VEHICLE QA · ';
  panel.style.cssText='position:fixed;z-index:1200;left:10px;top:74px;background:#111b2def;color:white;padding:9px;border:1px solid #8194b5;border-radius:10px;font:12px system-ui';
  const select=document.createElement('select');select.setAttribute('aria-label','Preview vehicle model');
  select.style.cssText='font:inherit;color:#fff;background:#203757;padding:5px;max-width:180px';
  for(const [id,label] of VEHICLES){const opt=document.createElement('option');opt.value=id;opt.textContent=label;select.appendChild(opt);}
  select.addEventListener('change',()=>sourceVehicle(select.value));panel.appendChild(select);
  panel.addEventListener('pointerdown',e=>e.stopPropagation());document.body.appendChild(panel);
}
sourceVehicle('kc-sedan-sports');
let objRef = null; const INST = []; let camX = 0, camZ = 0;
function render3d(g) { const c0 = g.car;
  if (objRef !== g.obj) { objRef = g.obj; objG.clear(); INST.length = 0; const kinds = { t: [PROTO.t], r: [PROTO.r], h0: [PROTO.h[0]], h1: [PROTO.h[1]], h2: [PROTO.h[2]] };
    for (const [k, [pr]] of Object.entries(kinds)) { const list = g.obj.filter(o => (o.k === 'h' ? 'h' + (o.v % 3) : o.k) === k); const ims = []; pr.traverse(m => { if (m.isMesh) { const im = new THREE.InstancedMesh(m.geometry, m.material, list.length); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; objG.add(im); ims.push({ im, local: m.matrixWorld.clone() }); } }); INST.push({ list, ims }); } }
  const MM = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  for (const it of INST) { let n = 0; for (const o of it.list) { if (Math.abs(o.x - c0.x) > 900 || Math.abs(o.y - c0.y) > 900) continue; const s = o.k === 'h' ? 1 : o.r / 20; Q.setFromAxisAngle(Y, o.k === 'h' ? (o.v % 4) * Math.PI / 2 : o.v); MM.compose(V.set(o.x * K, 0, o.y * K), Q, SC.set(s, s, s)); for (const { im, local } of it.ims) { const m = MM.clone().multiply(local); im.setMatrixAt(n, m); } n++; } for (const { im } of it.ims) { im.count = n; im.instanceMatrix.needsUpdate = true; } }
  for (const p of g.cops) { if (!p.o) { p.o = (p.tank ? tankP : copP).clone(); carG.add(p.o); p.o.userData.lights = p.tank ? null : [p.o.children[p.o.children.length - 2], p.o.children[p.o.children.length - 1]]; } p.o.position.set(p.x * K, 0, p.y * K); p.o.rotation.y = -p.a; p.o.userData.f = g.frames; if (p.o.userData.lights) { const on = Math.sin(g.t * 18) > 0; p.o.userData.lights[0].visible = on; p.o.userData.lights[1].visible = !on; } }
  for (let i = carG.children.length - 1; i >= 0; i--) if (carG.children[i].userData.f !== g.frames) carG.remove(carG.children[i]);
  player.position.set(c0.x * K, 0, c0.y * K); player.rotation.y = -c0.a; player.rotation.x = 0; player.rotation.z = (g.steer || 0) * 0.06;
  const lead = 2.2; camX += ((c0.x * K + Math.cos(c0.a) * lead) - camX) * 0.08; camZ += ((c0.y * K + Math.sin(c0.a) * lead) - camZ) * 0.08;
  cam.position.set(camX + 7.5, 14.5, camZ + 9.5); cam.lookAt(camX, 0, camZ); sun.position.set(camX + 10, 24, camZ + 6); sun.target.position.set(camX, 0, camZ);
  ground.position.set(Math.round(camX / 20) * 20, 0, Math.round(camZ / 20) * 20); groundTex.offset.set((ground.position.x / 20) % 1, (-ground.position.z / 20) % 1);
  S3.render(); }
window.__GL3 = () => S3.r.info.render;
function toScreen(g, wx, wy) { const v = new THREE.Vector3(wx * K, 0.5, wy * K).project(cam); return { x: (v.x + 1) / 2 * g.W, y: (1 - v.y) / 2 * g.H }; }
Kit.run({ id: 'gl-wanted-run', title: 'MOST WANTED RUN', help: 'Steer: left/right arrows or hold left/right side\nSurvive the chase - make cops crash into each other', bg: 'rgba(0,0,0,0)',
  init(g) { g.car = { x: 0, y: 0, a: -Math.PI / 2, sp: 260 }; g.bumpCooldown = 0; g.blockedFor = 0; g.bustTime = 0; g.cops = []; g.obj = []; g.heat = 1; g.ht = 0; g.next = 2; g.sec = 0; g.coins = []; for (let i = 0; i < 900; i++) { const q = g.rnd(); const k = q < 0.55 ? 't' : q < 0.75 ? 'r' : 'h'; let x = g.R(-2000, 2000), y = g.R(-2000, 2000); if (k === 'h') { x = Math.round(x / 400) * 400 + 200; y = Math.round(y / 400) * 400 + 200 + g.R(-90, 90); } const r = k === 'h' ? 34 : g.R(14, 30); const dl = (v) => Math.abs(((v % 400) + 600) % 400 - 200); if (200 - dl(x) < 44 + (k === 'h' ? 40 : r * 0.6) || 200 - dl(y) < 44 + (k === 'h' ? 40 : r * 0.6)) continue; g.obj.push({ x, y, r, k, v: g.RI(0, 11) }); } g.obj = g.obj.filter(o => Math.hypot(o.x, o.y) > 120); },
  update(g, dt) {
    const c0 = g.car; let st = g.ax(); if (g.ptr.down) st = g.ptr.x < g.W / 2 ? -1 : 1; c0.a += st * 3.1 * dt; g.steer = Kit.lerp(g.steer || 0, st, Math.min(1, dt * 8)); c0.sp = Math.min(420, 260 + g.t * 2); const stepX = Math.cos(c0.a) * c0.sp * dt, stepY = Math.sin(c0.a) * c0.sp * dt;
    if (st && g.frames % 3 === 0) { const sp = toScreen(g, c0.x - Math.cos(c0.a) * 16, c0.y - Math.sin(c0.a) * 16); g.parts.push({ x: sp.x, y: sp.y, vx: g.R(-20, 20), vy: g.R(-20, 20), l: 0.5, m: 0, c: 'rgba(230,230,230,.7)', s: 7, gr: 0 }); }
    // Scenery collisions block the car rather than ending the run. Use a swept
    // circle to catch high-speed impacts, while permitting movement away from
    // an object after contact. A stopped car can be pinned and busted by cops.
    let travel = 1, impact = null;
    const travel2 = stepX * stepX + stepY * stepY, travelLen = Math.sqrt(travel2);
    for (const o of g.obj) {
      if (o.x - c0.x > 2000) o.x -= 4000;
      if (c0.x - o.x > 2000) o.x += 4000;
      if (o.y - c0.y > 2000) o.y -= 4000;
      if (c0.y - o.y > 2000) o.y += 4000;
      const r = o.r + 12, sx = c0.x - o.x, sy = c0.y - o.y;
      const startDist = Math.hypot(sx, sy);
      const endDist = Math.hypot(sx + stepX, sy + stepY);
      if (startDist < r && endDist >= startDist) continue; // steer clear of an obstacle
      const t = travel2 > 0 ? Kit.clamp(-(sx * stepX + sy * stepY) / travel2, 0, 1) : 0;
      if (Math.hypot(sx + stepX * t, sy + stepY * t) < r) {
        const stop = Math.max(0, t - r / Math.max(travelLen, 0.0001));
        if (stop < travel) { travel = stop; impact = o; }
      }
    }
    c0.x += stepX * travel;
    c0.y += stepY * travel;
    g.blockedFor = impact ? Math.min(5, g.blockedFor + dt) : Math.max(0, g.blockedFor - dt * 2);
    g.bumpCooldown = Math.max(0, g.bumpCooldown - dt);
    if (impact && g.bumpCooldown <= 0) {
      const pos = toScreen(g, c0.x, c0.y);
      g.burst(pos.x, pos.y, ['#fbbf24', '#fff'], 10, 90);
      g.sfx('hit'); g.shake(3, 0.12); g.bumpCooldown = 0.4;
    }
    g.sec += dt; const s = Math.floor(g.sec * 10); if (s > (g.ls || 0)) { g.add((s - (g.ls || 0)) * g.heat, 's'); g.ls = s; }
    g.ht += dt; if (g.ht > 15) { g.ht = 0; g.heat = Math.min(6, g.heat + 1); g.mark('w', g.heat); g.float(g.W / 2, 140, 'HEAT ' + g.heat + '\u2605', '#fbbf24', 26); g.sfx('power'); }
    g.next -= dt; if (g.next <= 0 && g.cops.length < 3 + g.heat * 2) { g.next = Math.max(0.6, 3 - g.heat * 0.35); const a = g.R(0, 6.28); g.cops.push({ x: c0.x + Math.cos(a) * 520, y: c0.y + Math.sin(a) * 520, a: a + Math.PI, sp: 250 + g.heat * 28 + g.R(-20, 20), tank: g.heat >= 4 && g.rnd() < 0.2 }); }
    let copsGrabbing = 0;
    for (const p of g.cops) { const ta = Math.atan2(c0.y + Math.sin(c0.a) * 60 - p.y, c0.x + Math.cos(c0.a) * 60 - p.x); let d = ta - p.a; d = Math.atan2(Math.sin(d), Math.cos(d)); p.a += Kit.clamp(d, -2.4 * dt, 2.4 * dt); const sp = p.tank ? p.sp * 0.8 : p.sp; p.x += Math.cos(p.a) * sp * dt; p.y += Math.sin(p.a) * sp * dt;
      // One glancing police collision is recoverable; repeated contact while
      // stuck, or several police cars pinning the player, fills the bust meter.
      if (Math.hypot(p.x - c0.x, p.y - c0.y) < (p.tank ? 29 : 24)) copsGrabbing++;
      for (const o of g.obj) if (Math.hypot(o.x - p.x, o.y - p.y) < o.r + 10) p.dead = true;
      for (const q of g.cops) if (q !== p && !q.dead && Math.hypot(q.x - p.x, q.y - p.y) < 22) { p.dead = true; if (!q.tank) q.dead = true; } }
    for (const p of g.cops) if (p.dead) { g.add(50 * g.heat, 'k'); { const sp = toScreen(g, p.x, p.y); g.burst(sp.x, sp.y, ['#3b82f6', '#ef4444', '#fbbf24'], 25, 220); g.sfx('boom'); g.shake(6); g.float(sp.x, sp.y - 20, '+' + 50 * g.heat, '#fbbf24'); } }
    g.cops = g.cops.filter(p => !p.dead && Math.hypot(p.x - c0.x, p.y - c0.y) < 1200);
    const pinned = (g.blockedFor > 0.25 && copsGrabbing >= 1) || copsGrabbing >= 2;
    g.bustTime = pinned ? Math.min(1.3, g.bustTime + dt) : Math.max(0, g.bustTime - dt * 2);
    if (g.bustTime >= 1.25) {
      const pos = toScreen(g, c0.x, c0.y);
      g.burst(pos.x, pos.y, ['#3b82f6', '#ef4444', '#fff'], 40, 250);
      g.sfx('boom'); g.shake(12, 0.4);
      return g.end('BUSTED! Police have immobilized you');
    }
    g.hud = '\u2605'.repeat(g.heat) + '  ' + Math.floor(g.sec) + 's' +
      (g.bustTime > 0 ? '  BUST ' + Math.round(g.bustTime / 1.25 * 100) + '%' : '');
  },
  draw(g, c) { c.clearRect(0, 0, g.W, g.H); render3d(g); const c0 = g.car; for (const p of g.cops) { const sp = toScreen(g, p.x, p.y); if (sp.x < 0 || sp.y < 0 || sp.x > g.W || sp.y > g.H) { const cc = toScreen(g, c0.x, c0.y); const a = Math.atan2(sp.y - cc.y, sp.x - cc.x); const x = Kit.clamp(cc.x + Math.cos(a) * 1000, 18, g.W - 18), y = Kit.clamp(cc.y + Math.sin(a) * 1000, 70, g.H - 18); c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = Math.sin(g.t * 18) > 0 ? '#ff3030' : '#3050ff'; c.beginPath(); c.moveTo(12, 0); c.lineTo(-8, -8); c.lineTo(-8, 8); c.fill(); c.restore(); } }
} });
