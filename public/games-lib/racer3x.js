// Shared three.js highway-racer engine (original code, MIT). Chase camera behind the player's car, continuous steering,
// one-way 4-lane traffic, near-miss combos. Look: toon gradient + rim (runner3x), painted backdrop, baked roadside rows.
// Cars: "Cartoon Vehicles Pack 1" by Divinux (CC0). Trees/plants/rocks: Quaternius Stylized Nature MegaKit (CC0).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { loadModels, fit, toonify, toonMat, bake, stage, canvasTex } from './runner3x.js';
const LW = 3.3, NL = 4, ROW = 120;
const CARS = ['cv-sedan', 'cv-hatchback', 'cv-estate', 'cv-pickup', 'cv-truck', 'cv-transporter'];
const NAT = ['qn-CommonTree_1', 'qn-CommonTree_3', 'qn-Pine_2', 'qn-Bush_Common_Flowers', 'qn-Rock_Medium_1', 'qn-Grass_Common_Tall', 'qn-Flower_3_Group'];
const GLASS = new THREE.MeshStandardMaterial({ color: '#1d2f4a', metalness: 0.6, roughness: 0.08 });
const PAINT = ['#e8413c', '#2f7fe0', '#ffc531', '#f5f5f5', '#3fbf6a', '#ff8a2a', '#7a5cff', '#26c6c6'];
export default async function Racer(cfg) {
  const K = window.Kit; const S = stage(cfg); const { scene, cam, sun, hemi } = S; const M = await loadModels([...CARS, ...NAT, ...(cfg.models || [])]);
  // tint body paint: Divinux cars use a material per part; recolour the largest-area painted material
  function carProto(name, paint) { let o = M[name].scene.clone(true); o.traverse(m => { if (m.isMesh) { m.castShadow = true; } }); toonify(o, '#ffffff');
    if (paint) { const pm = toonMat({ color: paint }); o.traverse(m => { if (m.isMesh && /^paint/.test(m.material.name)) m.material = pm; }); } o.traverse(m => { if (m.isMesh && /^glass/.test(m.material.name)) m.material = GLASS; }); const ob = bake(o, true); ob.traverse(m => { if (m.isMesh) m.castShadow = m.material !== GLASS; }); o = ob;
    const f = fit(o, 'x', name === 'cv-truck' || name === 'cv-transporter' ? 2.5 : 2.1); const b = new THREE.Box3().setFromObject(f); const s = new THREE.Vector3(); b.getSize(s); f.rotation.y = s.z < s.x ? -Math.PI / 2 : 0; const b2 = new THREE.Box3().setFromObject(f); b2.getSize(s); return { o: f, len: s.z, w: s.x }; }
  const _env = S.env; GLASS.envMap = _env; window.__MATS = () => { const n = new Set(); for (const c of CARS) M[c].scene.traverse(m => m.isMesh && n.add(c + ':' + m.material.name)); return [...n]; };
  const protos = []; for (const n of CARS.slice(0, 6)) for (let k = 0; k < 3; k++) protos.push({ n, ...carProto(n, PAINT[(protos.length * 3) % PAINT.length]) });
  const playerC = carProto(cfg.player || 'cv-hatchback', cfg.paint || '#e8413c'); const player = new THREE.Group(); player.add(playerC.o); scene.add(player);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4.6), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.3, depthWrite: false })); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; player.add(blob);
  // road texture: asphalt + dashed lanes
  const roadW = LW * NL + 1.6; const roadT = canvasTex(512, 512, (x, w, h) => { x.fillStyle = '#4a4e5a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 2500; i++) { const v = 60 + Math.random() * 40 | 0; x.fillStyle = `rgba(${v},${v},${v + 8},.5)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } const px = (m) => (m + roadW / 2) / roadW * w; x.fillStyle = '#ffffff'; x.fillRect(px(-LW * 2) - 4, 0, 8, h); x.fillRect(px(LW * 2) - 4, 0, 8, h); for (let l = 1; l < NL; l++) for (let y = 0; y < h; y += 128) x.fillRect(px(-LW * 2 + l * LW) - 3, y, 6, 64); x.fillStyle = 'rgba(0,0,0,.12)'; for (let l = 0; l < NL; l++) x.fillRect(px(-LW * 2 + l * LW + LW / 2) - 30, 0, 60, h); }, [1, ROW / 12]);
  const roadM = toonMat({ map: roadT }); const road = new THREE.Mesh(new THREE.PlaneGeometry(roadW, 400), roadM); road.rotation.x = -Math.PI / 2; road.position.z = -150; scene.add(road);
  // roadside rows (baked): grass verge, guard rails, lamp posts, trees, billboards
  const grassM = toonMat({ map: canvasTex(128, 128, (x) => { x.fillStyle = '#4fa83a'; x.fillRect(0, 0, 128, 128); for (let i = 0; i < 600; i++) { x.fillStyle = Math.random() < 0.5 ? '#3f932f' : '#62bd45'; x.fillRect(Math.random() * 128, Math.random() * 128, 2, 4); } }, [20, 30]) });
  const steel = toonMat({ color: '#d7dde6' }), post = toonMat({ color: '#8a8f99' }), lampM = new THREE.MeshBasicMaterial({ color: '#fff6c8' });
  const ADS = [['SUNNY COLA', '#ff4d4d', '#fff'], ['MEGA BURGER', '#ffcf3a', '#7a2a00'], ['ZOOM TIRES', '#2b2b3a', '#ffd23f'], ['PIXEL PHONE', '#3f8cff', '#fff'], ['CLOUD AIR', '#26c6c6', '#fff']];
  const adT = ADS.map(([t, bg, fg]) => toonMat({ map: canvasTex(512, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, bg); g.addColorStop(1, '#00000033'); x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.arc(w * 0.85, h * 0.2, 120, 0, 7); x.fill(); x.font = '900 72px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(0,0,0,.3)'; x.fillText(t, w / 2 + 4, h / 2 + 5); x.fillStyle = fg; x.fillText(t, w / 2, h / 2); }) }));
  const LEAF = {};
  function rowGroup(k) { const g = new THREE.Group(); for (const s of [-1, 1]) { const gr = new THREE.Mesh(new THREE.PlaneGeometry(80, ROW), grassM); gr.rotation.x = -Math.PI / 2; gr.position.set(s * (roadW / 2 + 40), -0.02, -ROW / 2); g.add(gr);
      const rail = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.35, ROW, 2, 0.05), steel); rail.position.set(s * (roadW / 2 + 0.3), 0.7, -ROW / 2); g.add(rail); for (let z = 0; z < ROW; z += 4) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 6), post); p.position.set(s * (roadW / 2 + 0.35), 0.4, -z); g.add(p); }
      for (let z = 10 + k * 7; z < ROW; z += 30) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 7, 8), post); p.position.set(s * (roadW / 2 + 1.2), 3.5, -z); g.add(p); const arm = new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.14, 0.18, 2, 0.05), post); arm.position.set(s * (roadW / 2 + 0.3), 7, -z); g.add(arm); const l = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.12, 0.35, 2, 0.05), lampM); l.position.set(s * (roadW / 2 - 0.4), 6.92, -z); g.add(l); }
      for (let z = 2; z < ROW; z += 6 + ((z * 7 + k) % 4)) { const ii = (z * 3 + k * 5 + (s > 0 ? 2 : 0)); const n = ii % 5 === 0 ? 'qn-CommonTree_3' : ii % 5 === 2 ? 'qn-Pine_2' : NAT[3 + ii % 4]; const big = /Tree|Pine/.test(n); const t = toonify(fit(M[n].scene.clone(), 'y', big ? 7 + (z % 4) : n.includes('Rock') ? 1.6 : 1.4), '#ffffff'); t.traverse(m => { if (m.isMesh && /Leaves|Leaf/.test(m.material.name) && !/Pine/.test(m.material.name)) { const k = 'leaf' + m.material.uuid; LEAF[k] = LEAF[k] || (() => { const lm = m.material.clone(); lm.color.set('#7cc650'); return lm; })(); m.material = LEAF[k]; } }); t.position.set(s * (roadW / 2 + 2.2 + ((z * 13) % 14) + (big ? 2 : 0)), 0, -z); t.rotation.y = z; g.add(t); }
      if ((k + (s > 0 ? 1 : 0)) % 2 === 0) { const bb = new THREE.Group(); const pnl = new THREE.Mesh(new RoundedBoxGeometry(9, 4, 0.3, 2, 0.1), [post, post, post, post, adT[(k * 2 + (s > 0 ? 1 : 0)) % adT.length], post]); pnl.position.y = 6.5; bb.add(pnl); for (const dx of [-3, 3]) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4.6, 8), post); lg.position.set(dx, 2.3, 0); bb.add(lg); } bb.position.set(s * (roadW / 2 + 9), 0, -60); bb.rotation.y = s > 0 ? -0.35 : 0.35; g.add(bb); } }
    return g; }
  const { bakeMulti } = await import('./runner3x.js'); const rows = [0, 1].map(k => { const b = bakeMulti(rowGroup(k)); b.traverse(o => { if (o.isMesh) o.castShadow = false; }); b.userData.z0 = -k * ROW; scene.add(b); return b; });
  // painted backdrop: hills + mountains
  const bd = new THREE.Mesh(new THREE.PlaneGeometry(420, 160), new THREE.MeshBasicMaterial({ fog: false, depthWrite: false, map: canvasTex(1024, 512, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#4aa3ff'); g.addColorStop(0.72, '#cfeaff'); g.addColorStop(1, '#d8efff'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 7; i++) { x.fillStyle = 'rgba(255,255,255,.75)'; const cx = (i * 173) % w, cy = 50 + (i * 41) % 110; for (let j = 0; j < 5; j++) { x.beginPath(); x.ellipse(cx + j * 28, cy + Math.sin(j * 2) * 9, 36, 20, 0, 0, 7); x.fill(); } }
      [['#a9bfdc', 0.6, 130], ['#8fb59a', 0.72, 60], ['#6fa36a', 0.8, 34]].forEach(([c, base, amp], li) => { x.fillStyle = c; x.beginPath(); x.moveTo(0, h); for (let px = 0; px <= w; px += 8) x.lineTo(px, h * base - amp * (0.5 + 0.5 * Math.sin(px * (0.006 + li * 0.004) + li * 2) * Math.sin(px * 0.013 + li))); x.lineTo(w, h); x.fill(); if (li === 0) { x.fillStyle = 'rgba(255,255,255,.85)'; for (let px = 40; px < w; px += 210) { const y = h * base - amp * 0.95; x.beginPath(); x.moveTo(px - 28, y + 26); x.lineTo(px, y - 4); x.lineTo(px + 28, y + 26); x.fill(); } } }); }) }));
  scene.add(bd); scene.background = new THREE.Color('#4aa3ff'); scene.fog = new THREE.Fog('#cfe6fa', 80, 155); hemi.color.set('#eaf6ff'); hemi.groundColor.set('#5a7a4a'); hemi.intensity = 1.15; sun.color.set('#fff1dc'); sun.intensity = 2.1; S.r.toneMappingExposure = 1.0; cam.far = 160; cam.updateProjectionMatrix();
  const traffic = []; const pl = { x: 0, vx: 0, steer: 0 };
  window.__LR = { traffic, pl, get g() { return window.__GL && __GL.g; } };
  const laneX = (l) => -LW * 1.5 + l * LW;
  K.run({ id: cfg.id, title: cfg.title, help: cfg.help, bg: 'transparent', overText: 'CRASHED',
    init(g) { for (const t of traffic) scene.remove(t.o); traffic.length = 0; Object.assign(pl, { x: laneX(1), vx: 0, steer: 0 }); g.z = 0; g.sp = cfg.speed || 22; g.lastM = 0; g.next = 2; g.combo = 0; g.comboT = 0; g.nm = 0; g.camX = pl.x; },
    update(g, dt) { if (g.state !== 'play') return; if (g.ptr.pressed && g.ptr.x < 64 && g.ptr.y < 64) { g.paused = true; return; }
      let st = g.ax(); if (g.ptr.down && !(g.ptr.x < 64 && g.ptr.y < 64)) st = g.ptr.x < g.W / 2 ? -1 : 1; pl.steer = K.lerp(pl.steer, st, Math.min(1, dt * 10));
      pl.vx = K.lerp(pl.vx, pl.steer * 11, Math.min(1, dt * 6)); pl.x = K.clamp(pl.x + pl.vx * dt, -LW * 2 + 1.1, LW * 2 - 1.1); if (Math.abs(pl.x) >= LW * 2 - 1.11) { pl.vx *= -0.3; }
      g.sp = Math.min(cfg.vmax || 48, (cfg.speed || 22) + g.t * 0.18); g.z -= g.sp * dt; const m = Math.floor(-g.z / 10); if (m > g.lastM) { g.add(m - g.lastM, 'm'); g.lastM = m; }
      g.next -= dt; if (g.next <= 0) { g.next = Math.max(0.42, 1.4 - g.t * 0.006) * g.R(0.8, 1.3); const lanes = [0, 1, 2, 3].sort(() => g.rnd() - 0.5); const n = g.rnd() < 0.15 + Math.min(0.4, g.t / 240) ? 2 : 1;
        for (let i = 0; i < n; i++) { const p = protos[g.RI(0, protos.length - 1)]; const o = p.o.clone(); o.position.set(laneX(lanes[i]), 0, 0); scene.add(o); traffic.push({ o, x: laneX(lanes[i]), z: g.z - 120, v: g.R(10, 17) * (p.n === 'cv-truck' || p.n === 'cv-transporter' ? 0.8 : 1), len: p.len, w: p.w }); } }
      for (const t of traffic) { t.z -= t.v * dt; const dz = t.z - g.z; const dx = Math.abs(t.x - pl.x);
        if (dx < (t.w + 1.7) / 2 && Math.abs(dz) < (t.len + 3.8) / 2) { g.shake(16); g.sfx('boom'); g.flash('#fff', 0.2); g.mark('h', 1); return g.end('Crashed'); }
        if (!t.passed && dz > (t.len + 4.2) / 2) { t.passed = true; if (dx < (t.w + 1.9) / 2 + 1.1) { g.combo = g.comboT > 0 ? g.combo + 1 : 1; g.comboT = 2.5; g.nm++; const pts = 20 * Math.min(5, g.combo); g.add(pts, 'n'); g.float(g.W / 2, g.H * 0.55, (g.combo > 1 ? 'x' + g.combo + ' ' : '') + 'NEAR MISS +' + pts, '#22d3ee', 20); g.sfx('whoosh'); } } }
      g.comboT = Math.max(0, g.comboT - dt); if (g.comboT <= 0) g.combo = 0;
      for (let i = traffic.length - 1; i >= 0; i--) if (traffic[i].z - g.z > 20) { scene.remove(traffic[i].o); traffic.splice(i, 1); }
    },
    draw(g, c) { c.clearRect(0, 0, g.W, g.H);
      player.position.set(pl.x, 0, 0); player.rotation.y = -pl.vx * 0.025; player.rotation.z = pl.vx * 0.012; for (const t of traffic) t.o.position.z = t.z - g.z;
      roadT.offset.y = (-g.z / 12) % 1; for (const r of rows) r.position.z = ((((r.userData.z0 - g.z) % (2 * ROW)) + 2 * ROW) % (2 * ROW)) - ROW + 20;
      g.camX = K.lerp(g.camX, pl.x * 0.8, 0.1); const sh = g.shakeT > 0 ? g.shakeM * 0.02 : 0; cam.fov = 62 + (g.sp - 22) * 0.35; cam.updateProjectionMatrix();
      cam.position.set(g.camX + (Math.random() - 0.5) * sh, 8.2, 9.5); cam.lookAt(g.camX, 0, -14); bd.position.set(cam.position.x, 26, -150);
      sun.position.set(pl.x + 8, 18, 6); sun.target.position.set(pl.x, 0, -6); S.render();
      if (g.state === 'play' && g.sp > 30) { c.strokeStyle = `rgba(255,255,255,${Math.min(0.28, (g.sp - 30) * 0.02)})`; c.lineWidth = 2; c.beginPath(); for (let i = 0; i < 16; i++) { const a = (i * 2.399) % 6.283, r0 = 160 + ((g.t * 900 + i * 97) % 240); c.moveTo(g.W / 2 + Math.cos(a) * r0, g.H * 0.4 + Math.sin(a) * r0); c.lineTo(g.W / 2 + Math.cos(a) * (r0 + 46), g.H * 0.4 + Math.sin(a) * (r0 + 46)); } c.stroke(); }
    },
    hudDraw(g, c) { const W = g.W; const pg = c.createLinearGradient(0, 12, 0, 56); pg.addColorStop(0, '#6ad1ff'); pg.addColorStop(1, '#2a7fd6'); c.fillStyle = pg; K.rr(c, 12, 12, 44, 44, 12); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke(); c.fillStyle = '#fff'; c.fillRect(26, 23, 6, 22); c.fillRect(37, 23, 6, 22);
      c.fillStyle = 'rgba(20,16,40,.72)'; K.rr(c, W - 176, 12, 164, 40, 20); c.fill(); g.txt(String(Math.floor(g.score)).padStart(6, '0'), W - 94, 32, 22, '#fff');
      // speedometer
      const cx = W / 2, cy = g.H - 46; c.fillStyle = 'rgba(20,16,40,.72)'; c.beginPath(); c.arc(cx, cy, 40, Math.PI, 0); c.lineTo(cx + 40, cy + 14); c.lineTo(cx - 40, cy + 14); c.fill(); const f = Math.min(1, (g.sp - 15) / 40); c.strokeStyle = '#ffd23f'; c.lineWidth = 6; c.beginPath(); c.arc(cx, cy, 32, Math.PI, Math.PI + Math.PI * f); c.stroke(); g.txt(Math.round(g.sp * 3.6) + '', cx, cy - 4, 18, '#fff'); g.txt('KM/H', cx, cy + 10, 9, '#9fb3d9');
      if (g.combo > 1) g.txt('COMBO x' + g.combo, W - 70, 70, 15, '#22d3ee'); c.fillStyle = 'rgba(20,16,40,.6)'; K.rr(c, W - 92, 84, 80, 42, 10); c.fill(); g.txt('BEST', W - 52, 96, 10, '#ffd23f'); g.txt(String(g.best), W - 52, 114, 14, '#fff'); } });
}
