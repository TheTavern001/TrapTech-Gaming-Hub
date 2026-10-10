// Shared three.js lane-runner engine v2 (original code, MIT) - "bright stylized cartoon" art direction.
// Toon gradient shading + warm rim light, ACES tone mapping, one tuned shadow map, fog, DPR cap 1.5, baked scenery,
// instanced glossy coins with sparkles, rotating world themes (desert town / old town). Models: Kenney CC0 kits
// (assets3d/*.glb, meshopt + WebP), retinted; barriers, ramps, coins, signs, wires, ground built in code.
// Kit (kit.js) runs the logic, input, HUD overlay, title/over screens and the Hub adapter on a transparent 2D canvas.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const LANE = 2.4, GRAV = 42, JUMP = 14.5, ROW = 80, U = 2.4;
export async function loadModels(names, base) {
  const ld = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder); const out = {};
  await Promise.all(names.map(n => ld.loadAsync((base || '../assets3d/') + n + '.glb').then(gl => { gl.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); out[n] = gl; })));
  return out;
}
export function fit(obj, axis, size) { const b = new THREE.Box3().setFromObject(obj), s = new THREE.Vector3(); b.getSize(s); obj.scale.multiplyScalar(size / s[axis]); return center(obj); }
function center(obj) { const b2 = new THREE.Box3().setFromObject(obj), c = new THREE.Vector3(); b2.getCenter(c); obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= b2.min.y; const w = new THREE.Group(); w.add(obj); return w; }
// ---- toon look ----
const GRAD = (() => { const t = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 175, 175, 175, 255, 225, 225, 225, 255, 255, 255, 255, 255]), 4, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const RIM = new THREE.Color('#ffd9b0');
export function toonMat(o) { const m = new THREE.MeshToonMaterial(Object.assign({ gradientMap: GRAD }, o)); m.onBeforeCompile = (sh) => { sh.uniforms.rimC = { value: RIM }; sh.fragmentShader = 'uniform vec3 rimC;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.6);\n  gl_FragColor.rgb += rimC * rimF * 0.45;'); }; return m; }
const MC = new Map();
export function toonify(obj, tint) { const tc = new THREE.Color(tint || '#ffffff'); obj.traverse(o => { if (!o.isMesh) return; const src = o.material; const key = src.uuid + '|' + tc.getHexString(); if (!MC.has(key)) MC.set(key, toonMat({ map: src.map || null, color: (src.color ? src.color.clone() : new THREE.Color(1, 1, 1)).multiply(tc), vertexColors: !!src.vertexColors })); o.material = MC.get(key); }); return obj; }
export function bake(group, shadows) { group.updateMatrixWorld(true); const by = new Map(); group.traverse(o => { if (!o.isMesh) return; let g = o.geometry.clone(); if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) { if (!['position', 'normal', 'uv'].includes(k)) { g.deleteAttribute(k); continue; } const a = g.attributes[k], f = new Float32Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let j = 0; j < a.itemSize; j++) f[i * a.itemSize + j] = a.getComponent(i, j); g.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize)); }
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); if (!g.attributes.normal) g.computeVertexNormals(); g.applyMatrix4(o.matrixWorld);
    const key = o.material.uuid; if (!by.has(key)) by.set(key, { m: o.material, gs: [] }); by.get(key).gs.push(g); });
  const out = new THREE.Group(); for (const { m, gs } of by.values()) { const me = new THREE.Mesh(mergeGeometries(gs), m); me.receiveShadow = true; me.castShadow = !!shadows; out.add(me); } return out; }
function canvasTex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; }
function cobbles(base, stone, grout, rep) { return canvasTex(256, 256, (x, w, h) => { x.fillStyle = grout; x.fillRect(0, 0, w, h); const r = 16; for (let row = 0; row < 8; row++) for (let col = 0; col < 9; col++) { const cx = col * 32 + (row % 2) * 16 + (Math.random() - 0.5) * 4, cy = row * 32 + 16; const g = x.createRadialGradient(cx - 5, cy - 6, 2, cx, cy, r); g.addColorStop(0, stone); g.addColorStop(1, base); x.fillStyle = g; x.beginPath(); x.ellipse(cx, cy, r - 2 + Math.random() * 2, r - 4 + Math.random() * 2, Math.random(), 0, 7); x.fill(); } }, rep); }
function stripes(a, b) { return canvasTex(128, 32, (x) => { x.fillStyle = a; x.fillRect(0, 0, 128, 32); x.fillStyle = b; for (let i = -2; i < 8; i++) { x.beginPath(); x.moveTo(i * 24, 32); x.lineTo(i * 24 + 12, 32); x.lineTo(i * 24 + 28, 0); x.lineTo(i * 24 + 16, 0); x.fill(); } const g = x.createLinearGradient(0, 0, 0, 32); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.2)'); x.fillStyle = g; x.fillRect(0, 0, 128, 32); }); }
function planks(base) { return canvasTex(128, 128, (x) => { for (let i = 0; i < 4; i++) { const g = x.createLinearGradient(0, i * 32, 0, i * 32 + 32); g.addColorStop(0, base); g.addColorStop(1, '#7a4a22'); x.fillStyle = g; x.fillRect(0, i * 32 + 1, 128, 30); x.fillStyle = 'rgba(60,30,10,.35)'; x.fillRect(0, i * 32 + 30, 128, 2); x.fillRect((i * 37) % 100 + 10, i * 32 + 10, 3, 3); } }); }
function signTex(text, bg, fg) { return canvasTex(512, 128, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]); x.fillStyle = g; x.fillRect(0, 0, w, h); x.strokeStyle = fg; x.lineWidth = 8; x.strokeRect(10, 10, w - 20, h - 20); x.font = '900 64px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(0,0,0,.35)'; x.fillText(text, w / 2 + 3, h / 2 + 5); x.fillStyle = fg; x.fillText(text, w / 2, h / 2 + 2); }); }

export function stage(o) {
  const cv = document.createElement('canvas'); cv.id = 'gl3d'; document.body.insertBefore(cv, document.body.firstChild);
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: (devicePixelRatio || 1) < 2, powerPreference: 'high-performance' }); r.setPixelRatio(Math.min(1.5, devicePixelRatio || 1));
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1; r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); const pm = new THREE.PMREMGenerator(r); const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const hemi = new THREE.HemisphereLight('#fff', '#888', 1.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff', 2.6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = -12; sc.right = 12; sc.top = 22; sc.bottom = -14; sc.near = 1; sc.far = 70; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04; scene.add(sun, sun.target);
  const cam = new THREE.PerspectiveCamera(58, 1, 0.1, 400); window.__R = r;
  function sync() { const k = document.getElementById('gl'); if (!k) return; if (cv.style.cssText !== k.style.cssText) { cv.style.cssText = k.style.cssText; cv.style.pointerEvents = 'none'; } const w = parseInt(k.style.width), h = parseInt(k.style.height); if (w && (cam.aspect !== w / h || r.domElement.width !== Math.floor(w * r.getPixelRatio()))) { r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); } }
  function skyTex(top, bot) { return canvasTex(2, 256, (x) => { const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, top); g.addColorStop(0.7, bot); g.addColorStop(1, bot); x.fillStyle = g; x.fillRect(0, 0, 2, 256); }); }
  return { r, scene, sun, hemi, cam, env, sync, skyTex, render() { sync(); r.render(scene, cam); } };
}

// ---- world themes (original names/signs; no references to any commercial game) ----
const THEMES = {
  desert: { name: 'Dustwater Junction', sky: ['#a99be0', '#ffcf9e'], fog: '#f4b896', fogNear: 45, fogFar: 150, hemi: ['#ffe6cc', '#c0644a', 1.7], sun: ['#fff1d8', 2.7], ground: ['#b9694a', '#d98d68', '#8e4a33'], side: '#e9a77c',
    trains: [['tr-train-diesel-b', '#ffb347'], ['tr-train-carriage-container-blue', '#5fd3c6'], ['tr-train-carriage-tank-large', '#ff7a59']], signs: ['GENERAL STORE', 'HOTEL', 'GOLD & GRAIN', 'BARBER', 'POST', 'CANTINA'] },
  old: { name: 'Lindenhof Old Town', sky: ['#58a9f2', '#e6f4ff'], fog: '#cfe7f8', fogNear: 45, fogFar: 150, hemi: ['#eef7ff', '#8f7c6a', 1.6], sun: ['#fff6e6', 2.5], ground: ['#8f8073', '#b8a899', '#6c6057'], side: '#a49384',
    trains: [['tr-train-tram-classic', '#ffcc33'], ['tr-train-electric-city-b', '#ff8a5c']], signs: ['BAKERY', 'CAFE', 'BOOKS', 'FLOWERS', 'CHEESE', 'MUSEUM'] } };
const ORDER = ['desert', 'old'];
const MODELS = ['runner', 'chaser', 'rail', 'pu-magnet', 'pu-jump', 'pu-double', 'tr-train-diesel-b', 'tr-train-carriage-container-blue', 'tr-train-carriage-tank-large', 'tr-train-tram-classic', 'tr-train-electric-city-b',
  'ot-wall', 'ot-wall-window-shutters', 'ot-wall-door', 'ot-wall-window-stone', 'ot-wall-wood', 'ot-wall-wood-window-glass', 'ot-wall-wood-window-small', 'ot-roof-high-gable', 'ot-roof-flat', 'ot-balcony-wall', 'ot-lantern', 'ot-stall-red', 'ot-stall-green', 'ot-banner-green', 'ot-cart', 'ot-chimney', 'ot-tree-high',
  'ds-cactus_tall', 'ds-cactus_short', 'ds-cliff_large_rock', 'ds-rock_largeA', 'ds-rock_tallB', 'ds-plant_bushLarge', 'ds-log_stackLarge', 'ru-detail-awning-wide', 'ru-pallet'];

export default async function RailRunner(cfg) {
  const K = window.Kit; const S = stage(cfg); const { scene, cam, sun, hemi } = S; let M = null; await loadModels(MODELS).then(m => (M = m));
  const place = (n, s, tint) => { const o = toonify(M[n].scene.clone(), tint); o.scale.setScalar(s); return center(o); };
  // ---- shared props built in code (bevelled, readable) ----
  const MAT = { post: toonMat({ color: '#e8e8f0' }), stripeR: toonMat({ map: stripes('#ff4d4d', '#ffffff') }), stripeY: toonMat({ map: stripes('#ffd23f', '#2b2b3a') }), wood: toonMat({ map: planks('#d9984f') }), steel: new THREE.MeshStandardMaterial({ color: '#c9d2dc', metalness: 0.9, roughness: 0.3, envMap: S.env }), wire: new THREE.MeshBasicMaterial({ color: '#2a2230' }) };
  function lowBarrier() { const g = new THREE.Group(); for (const s of [-1, 1]) { const p = new THREE.Mesh(new RoundedBoxGeometry(0.16, 1.05, 0.16, 3, 0.05), MAT.post); p.position.set(s * 0.92, 0.52, 0); g.add(p); } for (const y of [0.55, 0.9]) { const b = new THREE.Mesh(new RoundedBoxGeometry(2.1, 0.3, 0.12, 3, 0.05), MAT.stripeR); b.position.set(0, y, 0.06); g.add(b); } g.traverse(o => o.isMesh && (o.castShadow = true)); return g; }
  function highBarrier() { const g = new THREE.Group(); for (const s of [-1, 1]) { const p = new THREE.Mesh(new RoundedBoxGeometry(0.2, 2.5, 0.2, 3, 0.06), MAT.post); p.position.set(s * 1.0, 1.25, 0); g.add(p); } const b = new THREE.Mesh(new RoundedBoxGeometry(2.3, 0.55, 0.16, 3, 0.07), MAT.stripeY); b.position.set(0, 1.95, 0); g.add(b); const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: '#ff5a3c' })); lamp.position.set(0, 2.32, 0); g.add(lamp); g.traverse(o => o.isMesh && (o.castShadow = true)); return g; }
  function ramp(h) { const L = 4.6, g = new THREE.Group(); const d = new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.22, Math.hypot(L, h), 3, 0.06), MAT.wood); d.rotation.x = Math.atan2(h, L); d.position.set(0, h / 2, 0); d.castShadow = d.receiveShadow = true; g.add(d); for (const s of [-1, 1]) { const rl = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.12, Math.hypot(L, h), 2, 0.04), MAT.stripeR); rl.rotation.x = d.rotation.x; rl.position.set(s * 1.0, h / 2 + 0.2, 0); g.add(rl); } return g; }
  // coins: one instanced glossy lathe coin + instanced rim (2 draw calls for every coin on screen)
  const pts = []; const R0 = 0.42, T0 = 0.07; pts.push(new THREE.Vector2(0, -T0), new THREE.Vector2(R0 - 0.04, -T0), new THREE.Vector2(R0, -T0 + 0.03), new THREE.Vector2(R0, T0 - 0.03), new THREE.Vector2(R0 - 0.04, T0), new THREE.Vector2(0.3, T0), new THREE.Vector2(0.28, T0 - 0.03), new THREE.Vector2(0, T0 - 0.03));
  const coinGeo = new THREE.LatheGeometry(pts, 28); coinGeo.rotateX(Math.PI / 2); const coinMat = new THREE.MeshStandardMaterial({ color: '#ffc531', metalness: 1, roughness: 0.22, envMap: S.env, envMapIntensity: 1.6, emissive: '#7a4a00', emissiveIntensity: 0.35 });
  const MAXC = 160; const coins = new THREE.InstancedMesh(coinGeo, coinMat, MAXC); coins.castShadow = true; coins.count = 0; scene.add(coins);
  const spk = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3), 3)), new THREE.PointsMaterial({ size: 0.5, map: canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, '#fff'); g.addColorStop(0.2, 'rgba(255,240,180,.9)'); g.addColorStop(1, 'rgba(255,220,120,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); x.fillStyle = '#fff'; x.fillRect(30, 0, 4, 64); x.fillRect(0, 30, 64, 4); }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(spk);
  // ---- hero + chaser ----
  const ch = SkeletonUtils.clone(M.runner.scene); toonify(ch, '#ffffff'); ch.scale.setScalar(2.3); const hero = new THREE.Group(); hero.add(ch); scene.add(hero); ch.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  const mixer = new THREE.AnimationMixer(ch); const acts = {}; for (const c of M.runner.animations) acts[c.name] = mixer.clipAction(c); let cur = null;
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.28, depthWrite: false })); blob.rotation.x = -Math.PI / 2; scene.add(blob);
  const cc = SkeletonUtils.clone(M.chaser.scene); toonify(cc, '#ffe0e0'); cc.scale.setScalar(2.4); const chaser = new THREE.Group(); chaser.add(cc); chaser.rotation.y = Math.PI; scene.add(chaser); const cmixer = new THREE.AnimationMixer(cc); const csp = M.chaser.animations.find(a => a.name === 'sprint'); if (csp) cmixer.clipAction(csp).play();
  hero.rotation.y = Math.PI;
  function play(n, fade) { const a = acts[n]; if (!a || cur === a) return; a.reset().setEffectiveTimeScale(n === 'sprint' ? 1.3 : 1).fadeIn(fade || 0.12).play(); if (cur) cur.fadeOut(fade || 0.12); cur = a; if (n === 'jump' || n === 'die') { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; } }
  // ---- per-theme scenery rows (baked) + ground ----
  const world = new THREE.Group(); scene.add(world);
  const railProto = toonify(fit(M.rail.scene.clone(), 'x', 1.75), '#a78470'); const rb0 = new THREE.Box3().setFromObject(railProto); const RL = rb0.max.z - rb0.min.z;
  const strip = new THREE.Group(); for (let l = -1; l <= 1; l++) for (let i = 0; i < Math.ceil(ROW / RL); i++) { const m = railProto.clone(); m.position.set(l * LANE, 0.02, -i * RL); strip.add(m); } const SL = Math.ceil(ROW / RL) * RL; const railRow = bake(strip);
  const rails = [railRow, railRow.clone()]; rails.forEach((m, k) => { m.userData.z0 = -k * SL; world.add(m); });
  const T = {}; for (const key of ORDER) { const th = THEMES[key]; const gm = toonMat({ map: cobbles(th.ground[0], th.ground[1], th.ground[2], [5, ROW / 3.4]) }); const side = toonMat({ color: th.side });
    const rows = [0, 1].map(k => { const g = new THREE.Group(); const gr = new THREE.Mesh(new THREE.PlaneGeometry(LANE * 3 + 1.6, ROW), gm); gr.rotation.x = -Math.PI / 2; gr.position.z = -ROW / 2; g.add(gr); for (const s of [-1, 1]) { const sd = new THREE.Mesh(new THREE.PlaneGeometry(60, ROW), side); sd.rotation.x = -Math.PI / 2; sd.position.set(s * (LANE * 1.5 + 0.8 + 30), -0.01, -ROW / 2); g.add(sd); }
      (key === 'desert' ? desertRow : oldRow)(g, k, th); const b = bake(g); b.traverse(o => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = false; } }); b.userData.z0 = -k * ROW; b.visible = false; world.add(b); return b; });
    T[key] = { rows, th, sky: S.skyTex(th.sky[0], th.sky[1]) }; }
  function signBoard(text, w, pal) { const m = new THREE.Mesh(new RoundedBoxGeometry(w, 0.9, 0.14, 3, 0.05), [MAT.wood, MAT.wood, MAT.wood, MAT.wood, toonMat({ map: signTex(text, pal[0], pal[1]) }), MAT.wood]); return m; }
  function wires(g, z, x0, x1, y0, y1, sag) { const c = new THREE.CatmullRomCurve3([new THREE.Vector3(x0, y0, z), new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2 - sag, z + 0.4), new THREE.Vector3(x1, y1, z)]); g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 10, 0.025, 4), MAT.wire)); }
  function desertRow(g, k, th) { const X = LANE * 1.5 + 2.2; const woods = ['#e0a46a', '#c98652', '#f0b77a', '#b8774d']; const awn = ['#ff6b5b', '#38c6b8', '#ffcf4a', '#7f8cff'];
    for (const s of [-1, 1]) { let z = -2 - k * 3; let i = k * 3 + (s > 0 ? 1 : 0); while (z > -ROW + 6) { const w = 2 + (i % 2); const floors = 2 + ((i * 7 + k) % 2); const tint = woods[i % woods.length]; const x = s * X;
        for (let c = 0; c < w; c++) for (let f = 0; f < floors; f++) { const n = f === 0 ? (c === 1 ? 'ot-wall-wood' : 'ot-wall-wood-window-glass') : 'ot-wall-wood-window-small'; const p = place(n, U, tint); p.position.set(x, f * U, z - c * U - U / 2); p.rotation.y = s > 0 ? Math.PI : 0; g.add(p); const bk = place('ot-wall-wood', U, tint); bk.position.set(x + s * U, f * U, z - c * U - U / 2); bk.rotation.y = Math.PI / 2; bk.scale.x = 1; g.add(bk); }
        const cap = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.35, w * U + 0.3, 2, 0.08), toonMat({ color: '#7a4526' })); cap.position.set(x, floors * U + 0.9, z - w * U / 2); g.add(cap);
        const sign = signBoard(th.signs[i % th.signs.length], w * U * 0.85, [['#7a2e1f', '#4a170e'], '#ffd76a']); sign.scale.y = 1.5; sign.position.set(x - s * 0.12, floors * U + 0.05, z - w * U / 2); sign.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(sign);
        const aw = place('ru-detail-awning-wide', 1, awn[i % awn.length]); aw.scale.set(U * w * 0.9, U * 1.4, U * 1.4); aw.position.set(x - s * 0.9, U * 0.95, z - w * U / 2); aw.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(aw);
        if (i % 2 === 0) { const cac = place(i % 4 ? 'ds-cactus_tall' : 'ds-cactus_short', 4.2, '#5fbf5a'); cac.position.set(s * (X - 1.1), 0, z - w * U - 0.9); g.add(cac); } else { const lg = place('ds-log_stackLarge', 2.2, '#e0a070'); lg.position.set(s * (X - 1.2), 0, z - w * U - 0.8); g.add(lg); }
        z -= w * U + 1.8; i++; }
      for (let j = 0; j < 4; j++) { const cl = place('ds-cliff_large_rock', 14 + (j % 3) * 4, '#e07a55'); cl.position.set(s * (X + 12 + (j % 2) * 6), 0, -j * 22 - k * 9); cl.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(cl); }
      for (let j = 0; j < 3; j++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 7, 8), MAT.wood); p.position.set(s * (LANE * 1.5 + 1.1), 3.5, -j * 26 - 6); g.add(p); const bar = new THREE.Mesh(new RoundedBoxGeometry(1.4, 0.12, 0.12, 2, 0.04), MAT.wood); bar.position.set(s * (LANE * 1.5 + 1.1), 6.6, -j * 26 - 6); g.add(bar); if (s < 0) for (const d of [-0.5, 0.5]) wires(g, -j * 26 - 6, -(LANE * 1.5 + 1.1) + d, LANE * 1.5 + 1.1 + d, 6.65, 6.65, 0.7); } } }
  function oldRow(g, k, th) { const X = LANE * 1.5 + 2.6; const pastel = ['#ffd2b8', '#ffe9a8', '#c9ecd0', '#ffc2c2', '#c7dcff', '#f0cfff', '#fff3e6']; const roofs = ['#d9583f', '#3f6fd9', '#e07b39', '#5a7d4a'];
    for (const s of [-1, 1]) { const curb = new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.3, ROW, 2, 0.08), toonMat({ color: '#c8bcb0' })); curb.position.set(s * (LANE * 1.5 + 1.6), 0.15, -ROW / 2); g.add(curb);
      let z = -1 - k * 2; let i = k * 5 + (s > 0 ? 2 : 0); while (z > -ROW + 4) { const w = 2 + (i % 2); const floors = 3 + ((i * 5 + k) % 2); const tint = pastel[i % pastel.length]; const x = s * X;
        for (let c = 0; c < w; c++) { for (let f = 0; f < floors; f++) { const n = f === 0 ? (c === 0 ? 'ot-wall-door' : 'ot-wall-window-stone') : f === 1 && c === w - 1 ? 'ot-balcony-wall' : 'ot-wall-window-shutters'; const p = place(n, U, f === 0 ? '#f2e6d8' : tint); p.position.set(x, f * U, z - c * U - U / 2); p.rotation.y = s > 0 ? Math.PI : 0; g.add(p); }
          const rf = place('ot-roof-high-gable', U, roofs[(i + c) % roofs.length]); rf.position.set(x + s * U * 0.45, floors * U, z - c * U - U / 2); rf.rotation.y = Math.PI / 2; g.add(rf); }
        if (i % 3 === 0) { const st = place(i % 2 ? 'ot-stall-red' : 'ot-stall-green', U, '#ffffff'); st.position.set(s * (X - 1.6), 0.3, z - U); st.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(st); }
        const sg = signBoard(th.signs[i % th.signs.length], 2.2, [['#1f3b6b', '#12234a'], '#ffe08a']); sg.position.set(x - s * 0.15, U * 0.98 + 0.5, z - w * U / 2); sg.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(sg);
        if (i % 2) { const bn = place('ot-banner-green', U * 1.2, i % 4 === 1 ? '#ff6b6b' : '#ffffff'); bn.position.set(x - s * 0.3, U * 2.1, z - 0.3); bn.rotation.y = s > 0 ? Math.PI : 0; g.add(bn); }
        z -= w * U + 0.2; i++; }
      for (let j = 0; j < 4; j++) { const ln = place('ot-lantern', 4.2, '#ffffff'); ln.position.set(s * (LANE * 1.5 + 1.2), 0.3, -j * 20 - 8 - k * 4); g.add(ln); } }
    for (let j = 0; j < 6; j++) { const z = -j * 13 - 4; wires(g, z, -(X - 0.1), X - 0.1, U * 3.2, U * 3.0, 0.9); wires(g, z - 2, -(X - 0.1), X - 0.1, U * 2.9, U * 3.1, 0.7); } }
  // trains per theme: 3 cars, toon tinted
  const trainProto = {}; for (const key of ORDER) trainProto[key] = THEMES[key].trains.map(([n, tint]) => { const car = toonify(fit(M[n].scene.clone(), 'x', 2.15), tint); const b = new THREE.Box3().setFromObject(car), s = new THREE.Vector3(); b.getSize(s); return { car, len: s.z, h: s.y }; });
  function makeTrain(key, g, moving) { const set = trainProto[key]; const grp = new THREE.Group(); let z = 0, h = 0; const n = 3; const pick = set[g.RI(0, set.length - 1)]; for (let i = 0; i < n; i++) { const p = i === 0 ? pick : set[(set.indexOf(pick) + i) % set.length]; const c = p.car.clone(); c.position.z = z - p.len / 2; if (i > 0 || moving) c.rotation.y = Math.PI; grp.add(c); z -= p.len + 0.25; h = Math.max(h, p.h); } grp.children.forEach(c => c.position.z -= z / 2); return { o: grp, len: -z, h: Math.min(...grp.children.map((c, i) => set[0].h)) || h }; }
  const PU = { magnet: { label: 'MAGNET', c: '#ff6fb5', m: 'pu-magnet' }, jump: { label: 'SUPER JUMP', c: '#3ee08f', m: 'pu-jump' }, double: { label: '2X SCORE', c: '#ffd23f', m: 'pu-double' } };
  for (const k in PU) { const o = toonify(fit(M[PU[k].m].scene.clone(), 'y', 0.9), '#ffffff'); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.07, 10, 40), new THREE.MeshBasicMaterial({ color: PU[k].c })); ring.position.y = 0.45; o.add(ring); PU[k].proto = o; }
  const items = []; let theme = 'desert';
  function mk(kind, lane, z, extra) { let o = null, h = 0, len = 0;
    if (kind === 'train') { const t = makeTrain(theme, gref, extra.moving); o = t.o; len = t.len; h = t.h; }
    else if (kind === 'low') o = lowBarrier(); else if (kind === 'high') o = highBarrier(); else if (kind === 'ramp') o = ramp(extra.h); else if (PU[kind]) o = PU[kind].proto.clone();
    if (o) { o.position.set(lane * LANE, extra.y || 0, z); world.add(o); } const it = Object.assign({ kind, lane, z, o, y: extra.y || 0, len, h }, extra); items.push(it); return it; }
  let gref = null;
  function pattern(g, z) { const lv = Math.min(1, g.t / 120); const lanes = [-1, 0, 1].sort(() => g.rnd() - 0.5); const free = lanes[0]; const r = g.rnd();
    if (r < 0.4) { const n = g.rnd() < 0.5 + lv * 0.3 ? 2 : 1; let TL = 0; for (let i = 1; i <= n; i++) { const L = lanes[i]; const moving = g.rnd() < 0.12 + lv * 0.3 && i === 1; const t = mk('train', L, 0, { moving }); t.z = z - t.len / 2; TL = Math.max(TL, t.len); const rampOn = !moving && g.rnd() < 0.5; if (rampOn) mk('ramp', L, z + 2.3, { h: t.h }); if (rampOn || g.rnd() < 0.5) for (let k = 0; k < 7; k++) mk('coin', L, z - 1.5 - k * 2, { y: (rampOn ? t.h : 0) + 0.7 }); }
      for (let k = 0; k < 6; k++) mk('coin', free, z - k * 2.2, { y: 0.7 }); if (g.rnd() < 0.22) mk(g.pick(Object.keys(PU)), free, z - 15, { y: 0.5, pu: true }); return TL + 10; }
    if (r < 0.72) { const kinds = ['low', 'high']; for (const L of [lanes[1], lanes[2]]) if (g.rnd() < 0.75) mk(g.pick(kinds), L, z, {}); const kk = g.pick(kinds); mk(kk, free, z - 14, {}); for (let i = 0; i < 5; i++) mk('coin', free, z + 4 - i * 2, { y: kk === 'low' && i >= 3 ? 2.0 : 0.7 }); return 26 - lv * 6; }
    const L = lanes[1]; for (let i = 0; i < 8; i++) mk('coin', L, z - i * 1.6, { y: 0.7 + Math.sin(i / 7 * Math.PI) * 1.9 }); mk('low', L, z - 5.6, {}); return 22 - lv * 5; }
  function setTheme(key) { theme = key; const th = THEMES[key]; for (const k of ORDER) for (const r of T[k].rows) r.visible = k === key; scene.background = T[key].sky; scene.fog = new THREE.Fog(th.fog, th.fogNear, th.fogFar); hemi.color.set(th.hemi[0]); hemi.groundColor.set(th.hemi[1]); hemi.intensity = th.hemi[2]; sun.color.set(th.sun[0]); sun.intensity = th.sun[1]; }
  setTheme('desert');
  const pl = { lane: 0, x: 0, y: 0, vy: 0, roll: 0, stumble: 0, ground: 0, immune: 0 };
  window.__RR = { items, pl, get g() { return window.__GL && __GL.g; } };
  const dummy = new THREE.Object3D(); const proj = new THREE.Vector3();
  const pill = (c, x, y, w, h) => { c.fillStyle = 'rgba(20,16,40,.72)'; K.rr(c, x, y, w, h, h / 2); c.fill(); c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 2; c.stroke(); };
  const coinIcon = (c, x, y, r) => { const gr = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r); gr.addColorStop(0, '#fff6c4'); gr.addColorStop(0.5, '#ffc531'); gr.addColorStop(1, '#c47a00'); c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.strokeStyle = '#9a5c00'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r * 0.62, 0, 7); c.stroke(); };
  const star = (c, x, y, r, col) => { c.fillStyle = col; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.fill(); };
  K.run({ id: cfg.id, title: cfg.title, help: cfg.help, bg: 'transparent', overText: 'CAUGHT',
    init(g) { gref = g; for (const it of items) if (it.o) world.remove(it.o); items.length = 0; Object.assign(pl, { lane: 0, x: 0, y: 0, vy: 0, roll: 0, stumble: 0, ground: 0, immune: 0 }); g.z = 0; g.sp = cfg.speed || 15; g.next = -30; g.lastM = 0; g.coins = 0; g.pu = { magnet: 0, jump: 0, double: 0 }; g.chase = 0.2; g.land = 0; g.camX = 0; g.themeAt = 1000; g.ti = 0; setTheme(new URLSearchParams(location.search).get('theme') || 'desert'); play('sprint'); g.mult = 1; },
    update(g, dt) {
      mixer.update(g.state === 'play' ? dt : dt * 0.3); cmixer.update(g.state === 'play' ? dt * 1.15 : 0); if (g.state !== 'play') return;
      if (g.ptr.pressed && g.ptr.x < 64 && g.ptr.y < 64) { g.paused = true; return; }
      for (const k in g.pu) g.pu[k] = Math.max(0, g.pu[k] - dt); g.mult = (1 + Math.min(4, Math.floor(g.coins / 50))) * (g.pu.double > 0 ? 2 : 1);
      g.sp = Math.min(34, (cfg.speed || 15) + g.t * 0.12); g.z -= g.sp * dt; const m = Math.floor(-g.z / 2); if (m > g.lastM) { g.add((m - g.lastM) * g.mult, 'm'); g.lastM = m; }
      if (g.lastM >= g.themeAt) { g.themeAt += 1000; g.ti++; setTheme(ORDER[g.ti % ORDER.length]); g.flash('#fff', 0.35); g.float(g.W / 2, g.H * 0.3, THEMES[theme].name.toUpperCase(), '#fff', 22); g.mark('t', g.ti); }
      const P = g.ptr; let sw = null; if (P.released && !(P.sx < 64 && P.sy < 64)) { const dx = P.x - P.sx, dy = P.y - P.sy; if (Math.abs(dx) > 25 && Math.abs(dx) > Math.abs(dy)) sw = dx > 0 ? 'r' : 'l'; else if (Math.abs(dy) > 25) sw = dy < 0 ? 'u' : 'd'; else sw = 'u'; }
      if (g.kd('ArrowLeft') || g.kd('a')) sw = 'l'; if (g.kd('ArrowRight') || g.kd('d')) sw = 'r'; if (g.kd('ArrowUp') || g.kd('w') || g.kd(' ')) sw = 'u'; if (g.kd('ArrowDown') || g.kd('s')) sw = 'd';
      if (sw === 'l' && pl.lane > -1) { pl.lane--; g.sfx('whoosh'); } if (sw === 'r' && pl.lane < 1) { pl.lane++; g.sfx('whoosh'); }
      const grounded = pl.y <= pl.ground + 0.001; if (sw === 'u' && grounded) { pl.vy = JUMP * (g.pu.jump > 0 ? 1.35 : 1); pl.roll = 0; g.sfx('jump'); play('jump', 0.08); } if (sw === 'd') { if (!grounded) pl.vy = -26; pl.roll = 0.65; play('crouch', 0.08); g.sfx('whoosh'); }
      const prevX = pl.x; pl.x = K.lerp(pl.x, pl.lane * LANE, Math.min(1, dt * 14)); pl.roll = Math.max(0, pl.roll - dt); pl.stumble = Math.max(0, pl.stumble - dt); pl.immune = Math.max(0, pl.immune - dt);
      let gh = 0; for (const it of items) { const iz = it.z - g.z; if (it.kind === 'train' && Math.abs(it.lane * LANE - pl.x) < 1.1 && iz - it.len / 2 < 0.4 && iz + it.len / 2 > -0.4 && pl.y >= it.h - 0.35) gh = Math.max(gh, it.h); if (it.kind === 'ramp' && Math.abs(it.lane * LANE - pl.x) < 1 && iz < 2.3 && iz > -2.3) gh = Math.max(gh, it.h * (2.3 - iz) / 4.6); }
      pl.ground = gh; pl.vy -= GRAV * dt; pl.y += pl.vy * dt; if (pl.y < gh) { if (pl.vy < -8) g.land = 0.16; pl.y = gh; pl.vy = 0; if (cur === acts.jump) play(pl.roll > 0 ? 'crouch' : 'sprint', 0.1); }
      if (grounded && pl.roll <= 0 && cur !== acts.sprint && cur !== acts.jump) play('sprint');
      for (const it of items) { if (it.dead) continue; if (it.moving) it.z += 10 * dt; const iz = it.z - g.z; const dx = Math.abs(it.lane * LANE - pl.x);
        if (it.pu) { if (dx < 1.1 && Math.abs(iz) < 0.9 && pl.y < 2.5) { it.dead = true; g.pu[it.kind] = 10; g.add(25, 'u'); g.sfx('power'); g.flash(PU[it.kind].c, 0.12); g.float(g.W / 2, g.H * 0.35, PU[it.kind].label + '!', PU[it.kind].c, 26); } continue; }
        if (it.kind === 'coin') { if (g.pu.magnet > 0 && iz < 1 && iz > -14) it.mag = true; if (it.mag) { it.lane += (pl.x / LANE - it.lane) * Math.min(1, dt * 9); it.y += (pl.y + 0.8 - it.y) * Math.min(1, dt * 9); it.z += (g.z - it.z) * Math.min(1, dt * 7); }
          if (Math.abs(it.lane * LANE - pl.x) < 1 && Math.abs(it.z - g.z) < 0.8 && Math.abs(it.y - (pl.y + 0.8)) < 1.2) { it.dead = true; g.coins++; g.add(10 * g.mult, 'c'); g.sfx('coin'); proj.set(it.lane * LANE, it.y, it.z - g.z).project(cam); g.burst((proj.x + 1) / 2 * g.W, (1 - proj.y) / 2 * g.H, ['#fff3b0', '#ffc531', '#fff'], 12, 160, 0.45, 4); } continue; }
        if (dx > 1.1) continue; let hit = false;
        if (it.kind === 'train' && iz + it.len / 2 > -0.3 && iz - it.len / 2 < 0.3 && pl.y < it.h - 0.4) hit = Math.abs(iz - it.len / 2) < 1.2 || it.moving ? 'front' : 'side';
        if (it.kind === 'low' && Math.abs(iz) < 0.45 && pl.y < 1.05) hit = 'front'; if (it.kind === 'high' && Math.abs(iz) < 0.35 && pl.roll <= 0 && pl.y < 1.5) hit = 'front';
        if (hit === 'side' || (hit && Math.abs(prevX - pl.x) > 0.05 && dx > 0.5)) { const back = pl.x > it.lane * LANE ? 1 : -1; pl.lane = K.clamp(it.lane + back, -1, 1); if (pl.immune > 0) continue; pl.immune = 0.6; if (pl.stumble > 0) return die(g, 'Tripped twice'); pl.stumble = 4; g.chase = 0; g.shake(6); g.sfx('hit'); g.float(g.W / 2, g.H * 0.4, 'STUMBLE!', '#ffd23f', 24); continue; }
        if (hit) return die(g, it.kind === 'train' ? 'Hit a train' : 'Hit a barrier'); }
      for (const it of items) if (!it.dead && it.z - g.z > 14) it.dead = true;
      for (let i = items.length - 1; i >= 0; i--) if (items[i].dead) { if (items[i].o) world.remove(items[i].o); items.splice(i, 1); }
      while (g.next > g.z - 130) g.next -= pattern(g, g.next);
      g.chase = Math.min(1.6, g.chase + dt * (pl.stumble > 0 ? 0.06 : 0.4)); g.land = Math.max(0, g.land - dt);
    },
    draw(g, c) { c.clearRect(0, 0, g.W, g.H);
      const lean = pl.lane * LANE - pl.x; hero.position.set(pl.x, pl.y, 0); hero.rotation.z = -lean * 0.12; hero.rotation.y = Math.PI - lean * 0.22; hero.scale.set(1 + g.land * 0.6, 1 - g.land * 1.1, 1 + g.land * 0.6);
      blob.position.set(pl.x, pl.ground + 0.03, 0); const bs = Math.max(0.4, 1 - (pl.y - pl.ground) * 0.15); blob.scale.setScalar(bs);
      const cz = g.state === 'over' && g.why === 'Tripped twice' ? 2.2 : pl.stumble > 0 ? 3.4 : 3.4 + g.chase * 9; chaser.position.x = K.lerp(chaser.position.x, pl.x, 0.08); chaser.position.z = K.lerp(chaser.position.z || cz, cz, 0.1); chaser.visible = chaser.position.z < 10;
      let n = 0; const sp = spk.geometry.attributes.position; let sn = 0;
      for (const it of items) { if (it.o) { it.o.position.z = it.z - g.z; if (it.mag) it.o.position.x = it.lane * LANE; if (it.pu) { it.o.rotation.y = g.t * 2.5; it.o.position.y = it.y + Math.sin(g.t * 4) * 0.15; } continue; }
        if (it.kind === 'coin' && n < MAXC) { dummy.position.set(it.lane * LANE, it.y + Math.sin(g.t * 5 + it.z) * 0.08, it.z - g.z); dummy.rotation.set(0, g.t * 4 + it.z, 0); dummy.updateMatrix(); coins.setMatrixAt(n++, dummy.matrix);
          if (sn < 24 && it.z - g.z < 0 && ((Math.floor(g.t * 3) + Math.floor(it.z)) % 5 === 0)) { sp.setXYZ(sn++, it.lane * LANE + 0.2, it.y + 0.35, it.z - g.z + 0.1); } } }
      coins.count = n; coins.instanceMatrix.needsUpdate = true; for (let i = sn; i < 24; i++) sp.setXYZ(i, 0, -50, 0); sp.needsUpdate = true; spk.material.size = 0.45 + Math.sin(g.t * 12) * 0.15;
      for (const m of rails) { const z0 = m.userData.z0; m.position.z = ((((z0 - g.z) % (2 * SL)) + 2 * SL) % (2 * SL)) - SL + 14; }
      for (const key of ORDER) for (const r of T[key].rows) { const z0 = r.userData.z0; r.position.z = ((((z0 - g.z) % (2 * ROW)) + 2 * ROW) % (2 * ROW)) - ROW + 14; }
      g.camX = K.lerp(g.camX, pl.x * 0.75, 0.12); const shake = g.shakeT > 0 ? g.shakeM * 0.02 : 0; cam.fov = 56 + (g.sp - 15) * 0.4; cam.updateProjectionMatrix();
      cam.position.set(g.camX + (Math.random() - 0.5) * shake, 5.3 + pl.y * 0.55, 8.4); cam.lookAt(g.camX * 0.9, 1.0 + pl.y * 0.45, -10);
      sun.position.set(pl.x + 7, 16, 4); sun.target.position.set(pl.x, 0, -8); S.render();
      if (g.state === 'play' && g.sp > 21) { c.strokeStyle = `rgba(255,255,255,${Math.min(0.3, (g.sp - 21) * 0.025)})`; c.lineWidth = 2; c.beginPath(); for (let i = 0; i < 14; i++) { const a = (i * 2.399) % 6.283, r0 = 170 + ((g.t * 900 + i * 97) % 220); c.moveTo(g.W / 2 + Math.cos(a) * r0, g.H * 0.42 + Math.sin(a) * r0); c.lineTo(g.W / 2 + Math.cos(a) * (r0 + 40), g.H * 0.42 + Math.sin(a) * (r0 + 40)); } c.stroke(); }
      if (g.state === 'play' && pl.stumble > 0) { c.fillStyle = `rgba(239,68,68,${0.14 + Math.sin(g.t * 10) * 0.07})`; c.fillRect(0, 0, 10, g.H); c.fillRect(g.W - 10, 0, 10, g.H); }
    },
    hudDraw(g, c) { const W = g.W;
      // pause button (top-left)
      const pg = c.createLinearGradient(0, 12, 0, 56); pg.addColorStop(0, '#6ad1ff'); pg.addColorStop(1, '#2a7fd6'); c.fillStyle = pg; K.rr(c, 12, 12, 44, 44, 12); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke(); c.fillStyle = '#fff'; c.fillRect(26, 23, 6, 22); c.fillRect(37, 23, 6, 22);
      // score + multiplier pill
      pill(c, W - 196, 12, 184, 40); star(c, W - 160, 32, 13, '#ffd23f'); g.txt('x' + g.mult, W - 182, 32, 16, '#ffd23f'); g.txt(String(Math.floor(g.score)).padStart(6, '0'), W - 78, 32, 22, '#ffffff');
      pill(c, W - 120, 58, 108, 34); coinIcon(c, W - 30, 75, 11); g.txt(String(g.coins), W - 72, 75, 17, '#fff');
      // best badge
      c.fillStyle = 'rgba(20,16,40,.6)'; K.rr(c, W - 92, 98, 80, 46, 10); c.fill(); g.txt('BEST', W - 52, 110, 10, '#ffd23f'); g.txt(String(g.best), W - 52, 130, 15, '#fff');
      let yy = 68; for (const k in PU) if (g.pu[k] > 0) { pill(c, 12, yy, 130, 22); c.fillStyle = PU[k].c; K.rr(c, 14, yy + 2, 126 * g.pu[k] / 10, 18, 9); c.fill(); g.txt(PU[k].label, 77, yy + 11, 11, '#1a1030'); yy += 28; }
    } });
  function die(g, why) { play('die', 0.05); g.flash('#fff', 0.15); g.end(why); }
}
