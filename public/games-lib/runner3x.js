// Shared three.js lane-runner engine v2 (original code, MIT) - "bright stylized cartoon" art direction.
// Toon gradient shading + warm rim light, ACES tone mapping, tuned shadows, fog, adaptive DPR (cap 1.5), baked scenery,
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
import { loadBrand, leaf } from './brand.js';

const LANE = 2.4, GRAV = 42, JUMP = 14.5, ROW = 80, U = 2.4;
export async function loadModels(names, base) {
  const ld = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder); const out = {};
  await Promise.all(names.map(n => ld.loadAsync((base || '../assets3d/') + n + '.glb').then(gl => { gl.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); out[n] = gl; })));
  return out;
}
export function fit(obj, axis, size) { const b = new THREE.Box3().setFromObject(obj), s = new THREE.Vector3(); b.getSize(s); obj.scale.multiplyScalar(size / s[axis]); return center(obj); }
export function center(obj) { const b2 = new THREE.Box3().setFromObject(obj), c = new THREE.Vector3(); b2.getCenter(c); obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= b2.min.y; const w = new THREE.Group(); w.add(obj); return w; }
// Render-only fit for licensed train models; never changes collision dimensions.
export function railTrainVisualFit(sx,sy,sz,maxWidth,maxHeight,maxLength){
  if([sx,sy,sz,maxWidth,maxHeight,maxLength].some(v=>!Number.isFinite(v)||v<=0))return null;
  const rotate=sx>sz,w=rotate?sz:sx,l=rotate?sx:sz;
  const scale=Math.min(maxWidth/w,maxHeight/sy,maxLength/l);
  return Number.isFinite(scale)&&scale>0?{rotate,scale}:null;
}
// ---- toon look ----
const GRAD = (() => { const t = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 175, 175, 175, 255, 225, 225, 225, 255, 255, 255, 255, 255]), 4, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const RIM = new THREE.Color('#ffd9b0');
export function toonMat(o) { const m = new THREE.MeshToonMaterial(Object.assign({ gradientMap: GRAD }, o)); m.onBeforeCompile = (sh) => { sh.uniforms.rimC = { value: RIM }; sh.fragmentShader = 'uniform vec3 rimC;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.6);\n  gl_FragColor.rgb += rimC * rimF * 0.45;'); }; return m; }
const MC = new Map();
// Paints an original outfit onto a smooth CC0 base body by bind-pose region (object space before skinning).
// Realistic characters (Reese, Oct 10): soft PBR skin/cloth that keeps the source normal + roughness maps, smooth normals.
export function pbrChar(root) { const C = new Map(); root.traverse(o => { if (!o.isMesh) return; const s = o.material; if (!C.has(s.uuid)) { const m = new THREE.MeshStandardMaterial({ map: s.map || null, normalMap: s.normalMap || null, roughnessMap: s.roughnessMap || null, roughness: s.roughnessMap ? 1 : 0.75, metalness: 0, color: s.color ? s.color.clone() : new THREE.Color(1, 1, 1), alphaTest: s.alphaTest || (s.transparent ? 0.5 : 0), side: s.side, envMapIntensity: 0.6 }); m.name = s.name; m.userData.pbr = true; C.set(s.uuid, m); } o.material = C.get(s.uuid); }); return root; }
export function outfit(root, o) { let big = null; root.traverse(m => { if (m.isSkinnedMesh && (!big || m.geometry.attributes.position.count > big.geometry.attributes.position.count)) big = m; }); [big].forEach(m => { if (!m) return; m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox; const src = m.material;
    const mat = src.userData && src.userData.pbr ? Object.assign(src.clone(), { onBeforeCompile: () => {} }) : toonMat({ map: src.map }); if (src.userData && src.userData.pbr) mat.onBeforeCompile = () => {}; const U0 = { y0: { value: bb.min.y }, hh: { value: bb.max.y - bb.min.y }, xw: { value: Math.max(-bb.min.x, bb.max.x) }, cTop: { value: new THREE.Color(o.top) }, cTop2: { value: new THREE.Color(o.top2 || o.top) }, cPants: { value: new THREE.Color(o.pants) }, cShoe: { value: new THREE.Color(o.shoes) }, cSole: { value: new THREE.Color(o.sole || '#ffffff') }, sleeve: { value: o.sleeve || 0.72 } };
    const prev = mat.onBeforeCompile; mat.onBeforeCompile = (sh) => { prev(sh); Object.assign(sh.uniforms, U0);
      sh.vertexShader = 'varying vec3 vBP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vBP = position;');
      sh.fragmentShader = 'varying vec3 vBP; uniform float y0, hh, xw, sleeve; uniform vec3 cTop, cTop2, cPants, cShoe, cSole;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        float t = (vBP.y - y0) / hh; float ax = abs(vBP.x) / xw; float lum = dot(diffuseColor.rgb, vec3(.3,.59,.11)); float sh = 0.75 + lum * 0.55; vec3 col = diffuseColor.rgb; bool skin = true;
        if (t < 0.018) { col = cSole; skin = false; } else if (t < 0.055) { col = cShoe * sh; skin = false; }
        else if (t < 0.50) { col = cPants * sh; skin = false; if (abs(t - 0.49) < 0.008) col *= 0.6; }
        else if (t < (sleeve > 1.0 ? 0.845 : 0.815) && ax < sleeve) { col = mix(cTop, cTop2, step(0.70, t) * step(ax, 0.2) + step(t, 0.53)) * sh; skin = false; if (ax > 0.62) col *= 0.82; }
        diffuseColor.rgb = col;`); };
    m.material = mat; }); if (o.hair) root.traverse(m => { if (m.isMesh && /Hair|Brow/i.test(m.material.name)) { m.material = m.material.clone(); m.material.color.set(o.hair); } }); return root; }
export function toonify(obj, tint) { const tc = new THREE.Color(tint || '#ffffff'); obj.traverse(o => { if (!o.isMesh) return; const src = o.material; const key = src.uuid + '|' + tc.getHexString(); if (!MC.has(key)) MC.set(key, toonMat({ map: src.map || null, color: (src.color ? src.color.clone() : new THREE.Color(1, 1, 1)).multiply(tc), vertexColors: !!src.vertexColors, alphaTest: src.alphaTest || (src.alphaMap || src.transparent ? 0.5 : 0), side: src.side, emissive: src.emissive && src.emissive.getHex() ? src.emissive.clone() : new THREE.Color(0), emissiveMap: src.emissiveMap || null })); o.material = MC.get(key); o.material.name = src.name; }); return obj; }
const BM = new Map();
export function bake(group, shadows) { group.updateMatrixWorld(true); const by = new Map(); group.traverse(o => { if (!o.isMesh) return; let g = o.geometry.clone(); if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) { if (!['position', 'normal', 'uv', 'color'].includes(k)) { g.deleteAttribute(k); continue; } const a = g.attributes[k], f = new Float32Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let j = 0; j < a.itemSize; j++) f[i * a.itemSize + j] = a.getComponent(i, j); g.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize)); }
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); if (!g.attributes.normal) g.computeVertexNormals(); g.applyMatrix4(o.matrixWorld); g.computeBoundingBox(); const ck = Math.floor(-(g.boundingBox.min.z + g.boundingBox.max.z) / 2 / 32);
    const mt = o.material; const merge = mt.isMeshToonMaterial && !mt.userData.keep; const col = mt.color || new THREE.Color(1, 1, 1); const n = g.attributes.position.count; const ca = new Float32Array(n * 3); const vc = g.attributes.color;
    for (let i = 0; i < n; i++) { const r = vc && mt.vertexColors ? vc.getX(i) : 1, gg = vc && mt.vertexColors ? vc.getY(i) : 1, b = vc && mt.vertexColors ? vc.getZ(i) : 1; ca[i * 3] = col.r * r; ca[i * 3 + 1] = col.g * gg; ca[i * 3 + 2] = col.b * b; } g.setAttribute('color', new THREE.BufferAttribute(ca, 3));
    const mk = merge ? 'toon|' + (mt.map ? mt.map.uuid : 'none') : mt.uuid; const key = mk + '#' + ck; if (!by.has(key)) by.set(key, { m: merge ? (BM.get(mk) || BM.set(mk, toonMat({ map: mt.map || null, vertexColors: true })).get(mk)) : mt, gs: [] }); by.get(key).gs.push(g); });
  const out = new THREE.Group(); for (const { m, gs } of by.values()) { const me = new THREE.Mesh(mergeGeometries(gs), m); me.receiveShadow = true; me.castShadow = !!shadows; out.add(me); } return out; }
export function bakeMulti(group) { const subs = []; group.traverse(o => { if (o.isMesh && Array.isArray(o.material)) subs.push(o); }); for (const o of subs) { let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry; for (const gr of o.geometry.groups) { const sg = new THREE.BufferGeometry(); for (const k in g.attributes) { const a = g.attributes[k]; sg.setAttribute(k, new THREE.BufferAttribute(a.array.slice(gr.start * a.itemSize, (gr.start + gr.count) * a.itemSize), a.itemSize)); } const m = new THREE.Mesh(sg, o.material[gr.materialIndex]); m.position.copy(o.position); m.rotation.copy(o.rotation); m.scale.copy(o.scale); o.parent.add(m); } o.parent.remove(o); } return bake(group, true); }
export function canvasTex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; }
function cobbles(base, stone, grout, rep) { return canvasTex(256, 256, (x, w, h) => { x.fillStyle = grout; x.fillRect(0, 0, w, h); const r = 16; for (let row = 0; row < 8; row++) for (let col = 0; col < 9; col++) { const cx = col * 32 + (row % 2) * 16 + (Math.random() - 0.5) * 4, cy = row * 32 + 16; const g = x.createRadialGradient(cx - 5, cy - 6, 2, cx, cy, r); g.addColorStop(0, stone); g.addColorStop(1, base); x.fillStyle = g; x.beginPath(); x.ellipse(cx, cy, r - 2 + Math.random() * 2, r - 4 + Math.random() * 2, Math.random(), 0, 7); x.fill(); } }, rep); }
function stripes(a, b) { return canvasTex(128, 32, (x) => { x.fillStyle = a; x.fillRect(0, 0, 128, 32); x.fillStyle = b; for (let i = -2; i < 8; i++) { x.beginPath(); x.moveTo(i * 24, 32); x.lineTo(i * 24 + 12, 32); x.lineTo(i * 24 + 28, 0); x.lineTo(i * 24 + 16, 0); x.fill(); } const g = x.createLinearGradient(0, 0, 0, 32); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.2)'); x.fillStyle = g; x.fillRect(0, 0, 128, 32); }); }
function planks(base) { return canvasTex(128, 128, (x) => { for (let i = 0; i < 4; i++) { const g = x.createLinearGradient(0, i * 32, 0, i * 32 + 32); g.addColorStop(0, base); g.addColorStop(1, '#7a4a22'); x.fillStyle = g; x.fillRect(0, i * 32 + 1, 128, 30); x.fillStyle = 'rgba(60,30,10,.35)'; x.fillRect(0, i * 32 + 30, 128, 2); x.fillRect((i * 37) % 100 + 10, i * 32 + 10, 3, 3); } }); }
function signTex(text, bg, fg) { return canvasTex(512, 128, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]); x.fillStyle = g; x.fillRect(0, 0, w, h); x.strokeStyle = fg; x.lineWidth = 8; x.strokeRect(10, 10, w - 20, h - 20); x.font = '900 64px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(0,0,0,.35)'; x.fillText(text, w / 2 + 3, h / 2 + 5); x.fillStyle = fg; x.fillText(text, w / 2, h / 2 + 2); if (/DISPENS|GREEN|GROW|LEAF|KUSH|HAZE/.test(text)) { leaf(x, 48, 64, 34, '#7ee07a'); leaf(x, w - 48, 64, 34, '#7ee07a'); } }); }

export function stage(o) {
  const cv = document.createElement('canvas'); cv.id = 'gl3d'; document.body.insertBefore(cv, document.body.firstChild);
  const maxPixelRatio = Math.min(1.5, devicePixelRatio || 1);
  let activePixelRatio = maxPixelRatio, lastRenderAt = 0, slowFrameStreak = 0;
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: (devicePixelRatio || 1) < 2, powerPreference: 'high-performance' }); r.setPixelRatio(activePixelRatio);
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1; r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); const pm = new THREE.PMREMGenerator(r); const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const hemi = new THREE.HemisphereLight('#fff', '#888', 1.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff', 2.6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = -12; sc.right = 12; sc.top = 16; sc.bottom = -10; sc.near = 1; sc.far = 70; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04; scene.add(sun, sun.target);
  const cam = new THREE.PerspectiveCamera(58, 1, 0.1, 130); window.__R = r; window.__TRI = () => { const o = {}; scene.traverse(m => { if (m.isMesh && m.visible) { let n = m.name || m.parent?.name || m.geometry.type; const t = (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3 * (m.isInstancedMesh ? m.count : 1); const k = (m.material && m.material.name || m.geometry.type) + (m.isInstancedMesh ? '-inst' : ''); o[k] = (o[k] || 0) + Math.round(t); } }); return o; };
  function sync() { const k = document.getElementById('gl'); if (!k) return; if (cv.style.cssText !== k.style.cssText) { cv.style.cssText = k.style.cssText; cv.style.pointerEvents = 'none'; } const w = parseInt(k.style.width), h = parseInt(k.style.height); if (w && (cam.aspect !== w / h || r.domElement.width !== Math.floor(w * r.getPixelRatio()))) { r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); } }
  function skyTex(top, bot) { return canvasTex(2, 256, (x) => { const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, top); g.addColorStop(0.7, bot); g.addColorStop(1, bot); x.fillStyle = g; x.fillRect(0, 0, 2, 256); }); }
  function adaptResolution(now) {
    if (lastRenderAt) {
      const frameMs = now - lastRenderAt;
      // Only reduce resolution after sustained slow frames; never oscillate or lower fidelity on one-off spikes.
      slowFrameStreak = frameMs > 23 ? slowFrameStreak + 1 : 0;
      if (slowFrameStreak >= 45 && activePixelRatio > 1) {
        activePixelRatio = Math.max(1, Math.round((activePixelRatio - 0.25) * 100) / 100);
        r.setPixelRatio(activePixelRatio);
        slowFrameStreak = 0;
      }
    }
    lastRenderAt = now;
  }
  return { r, scene, sun, hemi, cam, env, sync, skyTex, render() { adaptResolution(performance.now()); sync(); r.render(scene, cam); } };
}

// ---- world themes (original names/signs; no references to any commercial game) ----
const THEMES = {
  desert: { name: 'Dustwater Junction', sky: ['#a99be0', '#ffcf9e'], fog: '#f4b896', fogNear: 40, fogFar: 125, hemi: ['#ffe6cc', '#c0644a', 1.7], sun: ['#fff1d8', 2.7], ground: ['#b9694a', '#d98d68', '#8e4a33'], side: '#e9a77c',
    trains: [['tr-train-diesel-b', '#ffb347'], ['tr-train-carriage-container-blue', '#5fd3c6'], ['tr-train-carriage-tank-large', '#ff7a59']], signs: ['GENERAL STORE', 'DISPENSARY', 'GOLD & GRAIN', 'HAZE HOUSE', 'POST', 'GREEN CROSS'] },
  jungle: { name: 'Verdant Ruins', sky: ['#1f4a3c', '#b9a66a'], fog: '#4a6b4c', fogNear: 16, fogFar: 88, hemi: ['#d6ecc4', '#1c2a16', 1.15], sun: ['#ffd49a', 2.1], ground: ['#8a8466', '#a9a283', '#5f5a44'], side: '#6d7a4a',
    trains: [], signs: ['GROW TEMPLE', 'SACRED LEAF', 'HAZE GROTTO'] },
  old: { name: 'Lindenhof Old Town', sky: ['#58a9f2', '#e6f4ff'], fog: '#cfe7f8', fogNear: 40, fogFar: 125, hemi: ['#eef7ff', '#8f7c6a', 1.6], sun: ['#fff6e6', 2.5], ground: ['#8f8073', '#b8a899', '#6c6057'], side: '#a49384',
    trains: [['tr-train-tram-classic', '#ffcc33'], ['tr-train-electric-city-b', '#ff8a5c']], signs: ['BAKERY', 'GROW ROOM', 'BOOKS', 'LEAF & LANTERN', 'CAFE', 'KUSH CORNER'] } };
let ORDER = ['desert', 'old']; const JLEAF = {};
const MODELS = ['hero', 'chaser2', 'rail', 'pu-magnet', 'pu-jump', 'pu-double', 'tr-train-diesel-b', 'tr-train-carriage-container-blue', 'tr-train-carriage-tank-large', 'tr-train-tram-classic', 'tr-train-electric-city-b',
  'ot-wall', 'ot-wall-window-shutters', 'ot-wall-door', 'ot-wall-window-stone', 'ot-wall-wood', 'ot-wall-wood-window-glass', 'ot-wall-wood-window-small', 'ot-roof-high-gable', 'ot-roof-flat', 'ot-balcony-wall', 'ot-lantern', 'ot-stall-red', 'ot-stall-green', 'ot-banner-green', 'ot-cart', 'ot-chimney', 'ot-tree-high',
  'ds-cactus_tall', 'ds-cactus_short', 'ds-cliff_large_rock', 'ds-rock_largeA', 'ds-rock_tallB', 'ds-plant_bushLarge', 'ds-log_stackLarge', 'qn-CommonTree_3', 'qn-TwistedTree_1', 'qn-Fern_1', 'qn-Plant_7_Big', 'qn-Rock_Medium_1', 'ru-detail-awning-wide', 'ru-pallet'];

export default async function RailRunner(cfg) {
  if (cfg.themes) ORDER = cfg.themes; const JG = ORDER[0] === 'jungle';
  // Poly Haven CC0 PBR textures for the ruins (mossy cobblestone path, slate-stone masonry)
  const TLd = new THREE.TextureLoader(); const phT = (n, rx, ry, srgb) => { const t = TLd.load('../assets3d/tex/' + n); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const stoneMat = (rx, ry, tint) => toonMat({ map: phT('ph-castle_wall_slates-diff.webp', rx, ry, true), normalMap: phT('ph-castle_wall_slates-nor_gl.webp', rx, ry), color: new THREE.Color(tint || '#d8d2b8') });
  const JST = JG ? stoneMat(1, 1) : null, JWALL = JG ? stoneMat(ROW / 4, 0.4, '#b9c4a0') : null, JPATH = JG ? toonMat({ map: phT('ph-mossy_cobblestone-diff.webp', 2.5, ROW / 4, true), normalMap: phT('ph-mossy_cobblestone-nor_gl.webp', 2.5, ROW / 4), color: new THREE.Color('#e8e2c8') }) : null;
  const K = window.Kit; const S = stage(cfg); const { scene, cam, sun, hemi } = S; let M = null; await loadModels(MODELS).then(m => (M = m));
  const place = (n, s, tint) => { const o = toonify(M[n].scene.clone(), tint); o.scale.setScalar(s); return center(o); };
  // ---- shared props built in code (bevelled, readable) ----
  const MAT = { post: toonMat({ color: '#e8e8f0' }), stripeR: toonMat({ map: stripes('#ff4d4d', '#ffffff') }), stripeY: toonMat({ map: stripes('#ffd23f', '#2b2b3a') }), wood: toonMat({ map: planks('#d9984f') }), steel: new THREE.MeshStandardMaterial({ color: '#c9d2dc', metalness: 0.9, roughness: 0.3, envMap: S.env }), wire: new THREE.MeshBasicMaterial({ color: '#2a2230' }), steelT: toonMat({ color: '#d6dde6' }), rampSide: toonMat({ color: '#c9d2dc' }) };
  function lowBarrier() { const g = new THREE.Group(); for (const s of [-1, 1]) { const p = new THREE.Mesh(new RoundedBoxGeometry(0.16, 1.05, 0.16, 3, 0.05), MAT.post); p.position.set(s * 0.92, 0.52, 0); g.add(p); } for (const y of [0.55, 0.9]) { const b = new THREE.Mesh(new RoundedBoxGeometry(2.1, 0.3, 0.12, 3, 0.05), MAT.stripeR); b.position.set(0, y, 0.06); g.add(b); } g.traverse(o => o.isMesh && (o.castShadow = true)); return g; }
  function highBarrier() { const g = new THREE.Group(); for (const s of [-1, 1]) { const p = new THREE.Mesh(new RoundedBoxGeometry(0.2, 2.5, 0.2, 3, 0.06), MAT.post); p.position.set(s * 1.0, 1.25, 0); g.add(p); } const b = new THREE.Mesh(new RoundedBoxGeometry(2.3, 0.55, 0.16, 3, 0.07), MAT.stripeY); b.position.set(0, 1.95, 0); g.add(b); const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: '#ff5a3c' })); lamp.position.set(0, 2.32, 0); g.add(lamp); g.traverse(o => o.isMesh && (o.castShadow = true)); return g; }
  function ramp(h) { const L = 4.6, g = new THREE.Group(); const sh = new THREE.Shape(); const N = 14; sh.moveTo(-L / 2, 0); for (let i = 0; i <= N; i++) { const u = i / N; sh.lineTo(-L / 2 + u * L, h * u * u); } sh.lineTo(L / 2, 0); sh.lineTo(-L / 2, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 2.0, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2, curveSegments: 4 }); geo.translate(0, 0, -1.0); geo.rotateY(Math.PI / 2); const d = new THREE.Mesh(geo, [MAT.rampSide, MAT.wood]); d.castShadow = d.receiveShadow = true; g.add(d);
    for (const sx of [-1.05, 1.05]) { const pts = []; for (let i = 0; i <= N; i++) { const u = i / N; pts.push(new THREE.Vector3(sx, h * u * u + 0.22, L / 2 - u * L)); } const rl = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.07, 8), MAT.steel); rl.castShadow = true; g.add(rl); for (let i = 3; i <= N; i += 4) { const u = i / N; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h * u * u + 0.22, 6), MAT.steel); p.position.set(sx, (h * u * u + 0.22) / 2, L / 2 - u * L); g.add(p); } }
    return g; }
  // coins: one instanced glossy lathe coin + instanced rim (2 draw calls for every coin on screen)
  const pts = []; const R0 = 0.42, T0 = 0.07; pts.push(new THREE.Vector2(0, -T0), new THREE.Vector2(R0 - 0.04, -T0), new THREE.Vector2(R0, -T0 + 0.03), new THREE.Vector2(R0, T0 - 0.03), new THREE.Vector2(R0 - 0.04, T0), new THREE.Vector2(0.3, T0), new THREE.Vector2(0.28, T0 - 0.03), new THREE.Vector2(0, T0 - 0.03));
  const coinGeo = new THREE.LatheGeometry(pts, 20); coinGeo.rotateX(Math.PI / 2); const coinMat = new THREE.MeshStandardMaterial({ color: '#ffc531', metalness: 1, roughness: 0.22, envMap: S.env, envMapIntensity: 1.6, emissive: '#7a4a00', emissiveIntensity: 0.35 });
  const MAXC = 160; const coins = new THREE.InstancedMesh(coinGeo, coinMat, MAXC); coins.castShadow = false; coins.count = 0; scene.add(coins);
  const spk = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3), 3)), new THREE.PointsMaterial({ size: 0.5, map: canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, '#fff'); g.addColorStop(0.2, 'rgba(255,240,180,.9)'); g.addColorStop(1, 'rgba(255,220,120,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); x.fillStyle = '#fff'; x.fillRect(30, 0, 4, 64); x.fillRect(0, 30, 64, 4); }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(spk);
  // ---- hero + chaser ----
  const ch = SkeletonUtils.clone(M.hero.scene); pbrChar(ch); outfit(ch, { top: '#ff5a36', top2: '#ffd23f', pants: '#2f5fd0', shoes: '#ffffff', sole: '#ff3b5c', hair: '#3a2416' }); ch.scale.setScalar(1.3); const hero = new THREE.Group(); hero.add(ch); scene.add(hero); ch.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; } });
  const mixer = new THREE.AnimationMixer(ch); const acts = {}; const AN = { sprint: 'Sprint_Loop', jump: 'Jump_Loop', crouch: 'Roll', die: 'Death01', idle: 'Idle_Loop' }; for (const k in AN) { const c = M.hero.animations.find(a => a.name === AN[k]); if (c) acts[k] = mixer.clipAction(c); } let cur = null;
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.28, depthWrite: false })); blob.rotation.x = -Math.PI / 2; scene.add(blob);
  const cc = SkeletonUtils.clone(M.chaser2.scene); pbrChar(cc); outfit(cc, { top: '#26375f', top2: '#f2c14e', pants: '#1c2440', shoes: '#111111', sole: '#444', hair: '#c0502a' }); cc.scale.setScalar(1.35);  cc.traverse(o => { if (o.isMesh) o.castShadow = false; }); const chaser = new THREE.Group(); chaser.add(cc); chaser.rotation.y = Math.PI; scene.add(chaser); const cmixer = new THREE.AnimationMixer(cc); const csp = M.chaser2.animations.find(a => a.name === 'Sprint_Loop'); if (csp) cmixer.clipAction(csp).play();
  hero.rotation.y = Math.PI; const BIG = []; for (const r of [ch, cc]) r.traverse(b => { if (b.userData.big) BIG.push(b); });
  function play(n, fade) { const a = acts[n]; if (!a || cur === a) return; a.reset().setEffectiveTimeScale(n === 'sprint' ? 1.15 : n === 'crouch' ? 1.4 : 1).fadeIn(fade || 0.12).play(); if (cur) cur.fadeOut(fade || 0.12); cur = a; if (n === 'die' || n === 'crouch') { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; } }
  // ---- per-theme scenery rows (baked) + ground ----
  const world = new THREE.Group(); scene.add(world);
  const SL = ROW; const strip = new THREE.Group(); const sleeperM = toonMat({ color: '#7a5236' }); const ballM = toonMat({ map: canvasTex(128, 128, (x) => { x.fillStyle = '#7a5e4c'; x.fillRect(0, 0, 128, 128); for (let i = 0; i < 900; i++) { const v = 100 + Math.random() * 70 | 0; x.fillStyle = `rgb(${v + 20},${v - 4},${v - 24})`; x.beginPath(); x.arc(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2.2, 0, 7); x.fill(); } }, [1, ROW / 4]) });
  const slG = new RoundedBoxGeometry(2.2, 0.16, 0.36, 1, 0.04), rlG = new RoundedBoxGeometry(0.12, 0.18, ROW, 2, 0.04);
  for (let l = -1; l <= 1; l++) { const b = new THREE.Mesh(new THREE.PlaneGeometry(2.6, ROW), ballM); b.rotation.x = -Math.PI / 2; b.position.set(l * LANE, 0.03, -ROW / 2); strip.add(b); for (let i = 0; i < ROW / 1.35; i++) { const sl = new THREE.Mesh(slG, sleeperM); sl.position.set(l * LANE, 0.08, -i * 1.35 - 0.5); strip.add(sl); } for (const sx of [-0.62, 0.62]) { const r = new THREE.Mesh(rlG, MAT.steelT); r.position.set(l * LANE + sx, 0.25, -ROW / 2); strip.add(r); } }
  const railRow = bake(strip);
  const rails = [railRow, railRow.clone()]; rails.forEach((m, k) => { m.userData.z0 = -k * SL; world.add(m); });
  const T = {}; for (const key of ORDER) { const th = THEMES[key]; const gm = key === 'jungle' ? JPATH : toonMat({ map: cobbles(th.ground[0], th.ground[1], th.ground[2], [5, ROW / 3.4]) }); const side = toonMat({ color: th.side });
    const rows = [0, 1].map(k => { const g = new THREE.Group(); const gr = new THREE.Mesh(new THREE.PlaneGeometry(LANE * 3 + 1.6, ROW), gm); gr.rotation.x = -Math.PI / 2; gr.position.z = -ROW / 2; g.add(gr); for (const s of [-1, 1]) { const sd = new THREE.Mesh(new THREE.PlaneGeometry(60, ROW), side); sd.rotation.x = -Math.PI / 2; sd.position.set(s * (LANE * 1.5 + 0.8 + 30), -0.01, -ROW / 2); g.add(sd); }
      (key === 'desert' ? desertRow : key === 'jungle' ? jungleRow : oldRow)(g, k, th); const b = bake(g); b.traverse(o => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = false; } }); b.userData.z0 = -k * ROW; b.visible = false; world.add(b); return b; });
    T[key] = { rows, th, sky: S.skyTex(th.sky[0], th.sky[1]) }; }
  function signBoard(text, w, pal) { const m = new THREE.Mesh(new RoundedBoxGeometry(w, 0.9, 0.14, 3, 0.05), [MAT.wood, MAT.wood, MAT.wood, MAT.wood, toonMat({ map: signTex(text, pal[0], pal[1]) }), MAT.wood]); return m; }
  function wires(g, z, x0, x1, y0, y1, sag) { const c = new THREE.CatmullRomCurve3([new THREE.Vector3(x0, y0, z), new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2 - sag, z + 0.4), new THREE.Vector3(x1, y1, z)]); g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 10, 0.025, 4), MAT.wire)); }
  function saloon(g, x, z, s) { const f = new THREE.Group(); const W = 12, H = 10; const tex = canvasTex(512, 512, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#e9a95f'); gr.addColorStop(1, '#b8713c'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(90,45,15,.45)'; c.lineWidth = 3; for (let y = 0; y < h; y += 22) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      c.fillStyle = '#5a2a14'; K.rr(c, 60, 40, 392, 110, 18); c.fill(); c.fillStyle = '#ffd76a'; c.font = '900 64px Georgia'; c.textAlign = 'center'; c.fillText('THE DRY GULCH', 256, 118);
      for (const wx of [70, 300]) { c.fillStyle = '#3a1f12'; c.fillRect(wx, 200, 140, 120); const wg = c.createLinearGradient(0, 200, 0, 320); wg.addColorStop(0, '#ffe7a8'); wg.addColorStop(1, '#e09a4a'); c.fillStyle = wg; c.fillRect(wx + 8, 208, 124, 104); c.fillStyle = '#3a1f12'; c.fillRect(wx + 66, 208, 8, 104); }
      c.fillStyle = '#3a1f12'; c.fillRect(196, 360, 120, 152); c.fillStyle = '#c8823f'; c.fillRect(204, 380, 50, 90); c.fillRect(258, 380, 50, 90); });
    const face = new THREE.Mesh(new RoundedBoxGeometry(0.5, H, W, 3, 0.15), [toonMat({ map: tex }), toonMat({ map: tex }), MAT.wood, MAT.wood, MAT.wood, MAT.wood]); face.position.set(0, H / 2, 0); f.add(face);
    const bal = new THREE.Mesh(new RoundedBoxGeometry(2.2, 0.3, W + 0.4, 2, 0.08), MAT.wood); bal.position.set(-1.1, H * 0.45, 0); f.add(bal); for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, H * 0.45, 10), MAT.wood); p.position.set(-2.0, H * 0.225, -W / 2 + 0.5 + i * (W - 1) / 4); f.add(p); }
    const top = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.5, W + 0.6, 2, 0.12), toonMat({ color: '#7a3d1e' })); top.position.set(0, H + 0.2, 0); f.add(top); f.position.set(x, 0, z); if (s > 0) f.rotation.y = Math.PI; g.add(f); }
  function clockTower(g, x, z) { const t = new THREE.Group(); const stone = toonMat({ color: '#e8d9c4' }); const sh = new THREE.Mesh(new RoundedBoxGeometry(4.2, 18, 4.2, 3, 0.25), stone); sh.position.y = 9; t.add(sh); const band = new THREE.Mesh(new RoundedBoxGeometry(4.6, 0.5, 4.6, 2, 0.15), toonMat({ color: '#b98f6a' })); band.position.y = 14.2; t.add(band);
    const face = toonMat({ map: canvasTex(256, 256, (c) => { c.fillStyle = '#2a3f6b'; c.fillRect(0, 0, 256, 256); c.fillStyle = '#fff8e8'; c.beginPath(); c.arc(128, 128, 110, 0, 7); c.fill(); c.strokeStyle = '#c9a24a'; c.lineWidth = 10; c.stroke(); c.fillStyle = '#222'; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; c.fillRect(128 + Math.cos(a) * 88 - 4, 128 + Math.sin(a) * 88 - 4, 8, 8); } c.lineWidth = 8; c.strokeStyle = '#222'; c.beginPath(); c.moveTo(128, 128); c.lineTo(128, 50); c.moveTo(128, 128); c.lineTo(180, 140); c.stroke(); }) });
    for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { const f = new THREE.Mesh(new THREE.CircleGeometry(1.7, 32), face); f.position.set(Math.sin(r) * 2.12, 16.2, Math.cos(r) * 2.12); f.rotation.y = r; t.add(f); }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 6, 4, 1), toonMat({ color: '#2f6f5a' })); roof.rotation.y = Math.PI / 4; roof.position.y = 21.2; t.add(roof); const ball = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), toonMat({ color: '#ffcf40' })); ball.position.y = 24.4; t.add(ball); t.position.set(x, 0, z); g.add(t); }
  function bridge(g, z, X) { const b = new THREE.Group(); const st = toonMat({ map: canvasTex(256, 128, (c) => { c.fillStyle = '#c9b49a'; c.fillRect(0, 0, 256, 128); c.strokeStyle = 'rgba(90,70,50,.5)'; c.lineWidth = 3; for (let y = 0; y < 128; y += 32) for (let x = (y / 32 % 2) * 32; x < 256; x += 64) c.strokeRect(x, y, 64, 32); }) });
    const arch = new THREE.Mesh(new THREE.TorusGeometry(X, 0.9, 12, 40, Math.PI), st); arch.scale.y = 0.75; arch.position.y = 1.5; b.add(arch); const deck = new THREE.Mesh(new RoundedBoxGeometry(2 * X + 4, 1.3, 3.4, 3, 0.3), st); deck.position.y = X * 0.75 + 1.9; b.add(deck);
    for (const dz of [-1.5, 1.5]) { const rl = new THREE.Mesh(new RoundedBoxGeometry(2 * X + 4, 0.18, 0.18, 2, 0.06), MAT.wire); rl.position.set(0, X * 0.75 + 3.4, dz); b.add(rl); for (let i = -X; i <= X; i += 1.4) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6), MAT.wire); p.position.set(i, X * 0.75 + 2.9, dz); b.add(p); } }
    for (const sx of [-1, 1]) { const pl = new THREE.Mesh(new RoundedBoxGeometry(2, 1.6 + 0.2, 4, 2, 0.2), st); pl.position.set(sx * X, 0.8, 0); b.add(pl); const bx = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), toonMat({ color: '#e0475a' })); bx.position.set(sx * (X - 1), X * 0.75 + 3.0, 1.9); b.add(bx); }
    b.position.z = z; g.add(b); }
  function desertRow(g, k, th) { const X = LANE * 1.5 + 2.2; const woods = ['#e0a46a', '#c98652', '#f0b77a', '#b8774d']; const awn = ['#ff6b5b', '#38c6b8', '#ffcf4a', '#7f8cff'];
    for (const s of [-1, 1]) { let z = -2 - k * 3; let i = k * 3 + (s > 0 ? 1 : 0); while (z > -ROW + 6) { const w = 2 + (i % 2); const floors = 2 + ((i * 7 + k) % 2); const tint = woods[i % woods.length]; const x = s * X;
        for (let c = 0; c < w; c++) for (let f = 0; f < floors; f++) { const n = f === 0 ? (c === 1 ? 'ot-wall-wood' : 'ot-wall-wood-window-glass') : 'ot-wall-wood-window-small'; const p = place(n, U, tint); p.position.set(x, f * U, z - c * U - U / 2); p.rotation.y = s > 0 ? Math.PI : 0; g.add(p); }
        const cap = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.35, w * U + 0.3, 2, 0.08), toonMat({ color: '#7a4526' })); cap.position.set(x, floors * U + 0.9, z - w * U / 2); g.add(cap);
        const sign = signBoard(th.signs[i % th.signs.length], w * U * 0.85, [['#7a2e1f', '#4a170e'], '#ffd76a']); sign.scale.y = 1.5; sign.position.set(x - s * 0.12, floors * U + 0.05, z - w * U / 2); sign.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(sign);
        const aw = place('ru-detail-awning-wide', 1, awn[i % awn.length]); aw.scale.set(U * w * 0.9, U * 1.4, U * 1.4); aw.position.set(x - s * 0.9, U * 0.95, z - w * U / 2); aw.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(aw);
        if (i % 2 === 0) { const cac = place(i % 4 ? 'ds-cactus_tall' : 'ds-cactus_short', 4.2, '#5fbf5a'); cac.position.set(s * (X - 1.1), 0, z - w * U - 0.9); g.add(cac); } else { const lg = place('ds-log_stackLarge', 2.2, '#e0a070'); lg.position.set(s * (X - 1.2), 0, z - w * U - 0.8); g.add(lg); }
        z -= w * U + 1.8; i++; }
      if ((k === 0) === (s < 0)) saloon(g, s * (X - 0.2), -30, s); if ((k === 1) === (s < 0)) { const big = place('ds-cliff_large_rock', 46, '#e8835c'); big.position.set(s * (X + 14), 0, -40); big.rotation.y = -Math.PI / 2; g.add(big); }
      for (let j = 0; j < 4; j++) { const cl = place('ds-cliff_large_rock', 14 + (j % 3) * 4, '#e07a55'); cl.position.set(s * (X + 12 + (j % 2) * 6), 0, -j * 22 - k * 9); cl.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(cl); }
      for (let j = 0; j < 3; j++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 7, 8), MAT.wood); p.position.set(s * (LANE * 1.5 + 1.1), 3.5, -j * 26 - 6); g.add(p); const bar = new THREE.Mesh(new RoundedBoxGeometry(1.4, 0.12, 0.12, 2, 0.04), MAT.wood); bar.position.set(s * (LANE * 1.5 + 1.1), 6.6, -j * 26 - 6); g.add(bar); if (s < 0) for (const d of [-0.5, 0.5]) wires(g, -j * 26 - 6, -(LANE * 1.5 + 1.1) + d, LANE * 1.5 + 1.1 + d, 6.65, 6.65, 0.7); } } }
  function jungleRow(g, k, th) { const X = LANE * 1.5 + 2.0; const stone = JST;
    for (const s of [-1, 1]) { const wall = new THREE.Mesh(new RoundedBoxGeometry(1.4, 1.1, ROW, 2, 0.15), JWALL); wall.position.set(s * (LANE * 1.5 + 1.0), 0.55, -ROW / 2); g.add(wall);
      for (let z = -4 - k * 3; z > -ROW + 4; z -= 9) { const col = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 7 + (z % 3), 12), stone); col.position.set(s * (X + 0.4), 3.5, z); g.add(col); const cap = new THREE.Mesh(new RoundedBoxGeometry(2.2, 0.6, 2.2, 2, 0.12), stone); cap.position.set(s * (X + 0.4), 7.3 + (z % 3), z); g.add(cap); }
      for (let z = -2 - k * 4; z > -ROW + 3; z -= 13 + (Math.abs(z) % 4)) { const n = (Math.abs(z) + k) % 3 ? 'qn-CommonTree_3' : 'qn-TwistedTree_1'; const t = place(n, 1, '#ffffff'); fit(t, 'y', 9 + (Math.abs(z) % 5)); t.traverse(m => { if (m.isMesh && /Leaves/i.test(m.material.name || '')) { const k = m.material.uuid; JLEAF[k] = JLEAF[k] || Object.assign(m.material.clone(), {}); JLEAF[k].color.set('#3f7a34'); m.material = JLEAF[k]; } }); t.position.set(s * (X + 5 + (Math.abs(z) % 3) * 2), 0, z); g.add(t);
        const f = place('qn-Fern_1', 1, '#ffffff'); fit(f, 'y', 1.6); f.position.set(s * (X - 1.2), 1.1, z - 3); g.add(f); }
      const big = new THREE.Group(); const st = new THREE.Mesh(new RoundedBoxGeometry(10, 4, 10, 2, 0.3), stone); st.position.y = 2; big.add(st); const st2 = new THREE.Mesh(new RoundedBoxGeometry(7, 4, 7, 2, 0.3), stone); st2.position.y = 6; big.add(st2); const st3 = new THREE.Mesh(new RoundedBoxGeometry(4, 4, 4, 2, 0.3), stone); st3.position.y = 10; big.add(st3);
      const sg = signBoard(th.signs[k % th.signs.length], 3.6, [['#2f5a2a', '#173a16'], '#ffd76a']); sg.position.set(0, 12.6, 0); big.add(sg); big.position.set(s * (X + 14), 0, -30 - k * 20 - (s > 0 ? 18 : 0)); g.add(big); } }
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
    clockTower(g, (k ? -1 : 1) * (X + 3.5), -24); bridge(g, -64, X);
    for (let j = 0; j < 6; j++) { const z = -j * 13 - 4; wires(g, z, -(X - 0.1), X - 0.1, U * 3.2, U * 3.0, 0.9); wires(g, z - 2, -(X - 0.1), X - 0.1, U * 2.9, U * 3.1, 0.7); } }
  // Source-asset upgrade. Keep the preexisting collision envelope unchanged.
  function originalTrain(id) {
    const CL=9.5,H=3,W=2.3, gltf=M[id];
    if(!gltf?.scene)throw Error('Required licensed train asset absent: '+id);
    const art=gltf.scene.clone(true),bounds=new THREE.Box3().setFromObject(art);
    const size=bounds.getSize(new THREE.Vector3());
    const fit=railTrainVisualFit(size.x,size.y,size.z,W-.1,H-.1,CL-.2);
    if(!fit)throw Error('Invalid original train geometry: '+id);
    if(fit.rotate)art.rotation.y+=Math.PI/2;
    art.scale.multiplyScalar(fit.scale);
    art.updateMatrixWorld(true);
    const placed=new THREE.Box3().setFromObject(art),mid=placed.getCenter(new THREE.Vector3());
    art.position.set(art.position.x-mid.x,art.position.y-placed.min.y,art.position.z-mid.z);
    art.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}});
    const wrapped=new THREE.Group();wrapped.add(art);
    return {car:bakeMulti(wrapped),len:CL,h:H+.25};
  }
  const trainProto={};
  for(const key of ORDER) trainProto[key]=key==='jungle'?ruinBlocks():THEMES[key].trains.map(([id])=>originalTrain(id));
  function ruinBlocks() { const stone = JST; const top = toonMat({ color: '#6f8f45' }); return [0, 1].map(v => { const CL = 6 + v * 2, H = 3.0, W = 2.3; const car = new THREE.Group(); const b = new THREE.Mesh(new RoundedBoxGeometry(W, H, CL, 3, 0.25), [stone, stone, top, stone, stone, stone]); b.position.y = H / 2; car.add(b); const bk = bakeMulti(car); bk.traverse(o => { if (o.isMesh) o.castShadow = true; }); return { car: bk, len: CL, h: H }; }); }
  function makeTrain(key, g, moving) { const set = trainProto[key]; const grp = new THREE.Group(); const p = set[g.RI(0, set.length - 1)]; const n = 2 + (g.rnd() < 0.5 ? 1 : 0); for (let i = 0; i < n; i++) { const c = p.car.clone(); c.position.z = -i * (p.len + 0.4) - p.len / 2; grp.add(c); } const L = n * (p.len + 0.4) - 0.4; grp.children.forEach(c => c.position.z += L / 2); return { o: grp, len: L, h: p.h }; }
  const PU = { magnet: { label: 'MAGNET', c: '#ff6fb5', m: 'pu-magnet' }, jump: { label: 'SUPER JUMP', c: '#3ee08f', m: 'pu-jump' }, double: { label: '2X SCORE', c: '#ffd23f', m: 'pu-double' } };
  for (const k in PU) { const o = toonify(fit(M[PU[k].m].scene.clone(), 'y', 0.9), '#ffffff'); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.07, 10, 40), new THREE.MeshBasicMaterial({ color: PU[k].c })); ring.position.y = 0.45; o.add(ring); PU[k].proto = o; }
  const items = []; let theme = ORDER[0];
  function mk(kind, lane, z, extra) { let o = null, h = 0, len = 0;
    if (kind === 'train') { const t = makeTrain(theme, gref, extra.moving); o = t.o; len = t.len; h = t.h; }
    else if (kind === 'turn') o = junction(extra.dir); else if (kind === 'gap') o = chasm(); else if (kind === 'low') o = lowBarrier(); else if (kind === 'high') o = highBarrier(); else if (kind === 'ramp') o = ramp(extra.h); else if (PU[kind]) o = PU[kind].proto.clone();
    if (o && JG && (kind === 'low' || kind === 'high' || kind === 'ramp')) o.traverse(m => { if (m.isMesh) m.material = RST; });
    if (o) { o.position.set(kind === 'turn' || kind === 'gap' ? 0 : lane * LANE, extra.y || 0, z); world.add(o); } const it = Object.assign({ kind, lane, z, o, y: extra.y || 0, len, h }, extra); items.push(it); return it; }
  let gref = null;
  // --- Verdant Ruins set pieces: corner junctions (swipe to turn) and cliff drops (jump) ---
  const RST = JG ? JST : toonMat({ color: '#8a8466' });
  const PATH = toonMat({ map: canvasTex(256, 256, (c) => { c.fillStyle = '#8a8466'; c.fillRect(0, 0, 256, 256); for (let i = 0; i < 260; i++) { const v = 110 + (i * 37) % 60; c.fillStyle = `rgb(${v},${v - 6},${v - 30})`; c.beginPath(); c.ellipse((i * 53) % 256, (i * 97) % 256, 10, 7, 0, 0, 7); c.fill(); } }) });
  const JW = LANE * 3 + 1.6; window.__JW = JW;
  function junction(dir) { const j = new THREE.Group(); const W = LANE * 3 + 1.6; const wall = new THREE.Mesh(new RoundedBoxGeometry(W + 6, 9, 2.2, 3, 0.3), RST); wall.position.set(0, 4.5, -W / 2 - 1.1); j.add(wall);
    const glyph = new THREE.Mesh(new THREE.CircleGeometry(1.3, 24), new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.85 })); glyph.position.set(0, 6.2, -W / 2 + 0.02); j.add(glyph);
    const arw = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.4, 3), new THREE.MeshBasicMaterial({ color: '#2a1a08' })); arw.rotation.z = dir === 'l' ? Math.PI / 2 : -Math.PI / 2; arw.position.set(0, 6.2, -W / 2 + 0.1); j.add(arw);
    // branch corridor stub so the turn swings into real scenery
    const sx = dir === 'l' ? -1 : 1; const L = 70; const gr = new THREE.Mesh(new THREE.PlaneGeometry(L, W), PATH); gr.rotation.x = -Math.PI / 2; gr.position.set(sx * (L / 2), 0.02, -W / 2 + 0.2); j.add(gr);
    for (const zz of [0.6, -W - 0.4]) { const w2 = new THREE.Mesh(new RoundedBoxGeometry(L, 1.1, 1.4, 2, 0.15), RST); w2.position.set(sx * (L / 2 + W / 2), 0.55, zz); j.add(w2); for (let x = 6; x < L; x += 9) { const col = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 7.5, 12), RST); col.position.set(sx * (x + W / 2), 3.75, zz + (zz > 0 ? 2 : -2)); j.add(col); } }
    const blk = new THREE.Mesh(new RoundedBoxGeometry(2.2, 9, W + 4, 3, 0.3), RST); blk.position.set(-sx * (W / 2 + 1.1), 4.5, -W / 2); j.add(blk); return j; }
  const MIST = new THREE.MeshBasicMaterial({ map: canvasTex(128, 64, (x) => { const g = x.createRadialGradient(64, 32, 2, 64, 32, 60); g.addColorStop(0, 'rgba(220,235,210,.55)'); g.addColorStop(1, 'rgba(220,235,210,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 64); }), transparent: true, depthWrite: false });
  function chasm() { const c = new THREE.Group(); const W = LANE * 3 + 1.6, D = 3.6; const hole = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.2, D), new THREE.MeshBasicMaterial({ map: canvasTex(64, 256, (x) => { const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#0a0f08'); g.addColorStop(0.5, '#000'); g.addColorStop(1, '#14100a'); x.fillStyle = g; x.fillRect(0, 0, 64, 256); }), fog: true }));
    hole.rotation.x = -Math.PI / 2; hole.position.y = 0.035; c.add(hole); for (const zz of [-D / 2, D / 2]) { const lip = new THREE.Mesh(new RoundedBoxGeometry(W + 0.6, 0.5, 0.7, 2, 0.15), RST); lip.position.set(0, -0.05, zz); c.add(lip); }
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.6), MIST); m.position.set(-W / 2 + i * W / 4, 0.6, (i % 2 - 0.5) * 0.8); c.add(m); } return c; }
  function pattern(g, z) { if (JG) { if (z < g.nextTurn) { g.nextTurn = z - 110 - g.rnd() * 90; mk('turn', 0, z - 16, { dir: g.rnd() < 0.5 ? 'l' : 'r' }); return 50; }
      if (g.rnd() < 0.2) { mk('gap', 0, z, {}); const L = g.pick([-1, 0, 1]); for (let i = 0; i < 6; i++) mk('coin', L, z + 3 - i * 1.4, { y: 0.8 + Math.sin(i / 5 * Math.PI) * 1.6 }); return 20; } } const lv = Math.min(1, g.t / 150); const lanes = [-1, 0, 1].sort(() => g.rnd() - 0.5); const free = lanes[0]; const r = g.rnd();
    if (r < 0.58) { const n = g.rnd() < 0.5 + lv * 0.3 ? 2 : 1; let TL = 0; for (let i = 1; i <= n; i++) { const L = lanes[i]; const moving = g.rnd() < 0.12 + lv * 0.3 && i === 1; const t = mk('train', L, 0, { moving }); t.z = z - t.len / 2; TL = Math.max(TL, t.len); const rampOn = !moving && g.rnd() < 0.5; if (rampOn) mk('ramp', L, z + 2.3, { h: t.h }); if (rampOn || g.rnd() < 0.5) for (let k = 0; k < 7; k++) mk('coin', L, z - 1.5 - k * 2, { y: (rampOn ? t.h : 0) + 0.7 }); }
      for (let k = 0; k < 6; k++) mk('coin', free, z - k * 2.2, { y: 0.7 }); if (g.rnd() < 0.22) mk(g.pick(Object.keys(PU)), free, z - 15, { y: 0.5, pu: true }); return TL + 6 + (1 - lv) * 8; }
    if (r < 0.84) { const kinds = ['low', 'high']; for (const L of [lanes[1], lanes[2]]) if (g.rnd() < 0.75) mk(g.pick(kinds), L, z, {}); const kk = g.pick(kinds); mk(kk, free, z - 14, {}); for (let i = 0; i < 5; i++) mk('coin', free, z + 4 - i * 2, { y: kk === 'low' && i >= 3 ? 2.0 : 0.7 }); return 32 - lv * 8; }
    const L = lanes[1]; for (let i = 0; i < 8; i++) mk('coin', L, z - i * 1.6, { y: 0.7 + Math.sin(i / 7 * Math.PI) * 1.9 }); mk('low', L, z - 5.6, {}); return 22 - lv * 5; }
  let setTheme = function (key) { theme = key; const th = THEMES[key]; for (const k of ORDER) for (const r of T[k].rows) r.visible = k === key; scene.background = T[key].sky; scene.fog = new THREE.Fog(th.fog, th.fogNear, th.fogFar); hemi.color.set(th.hemi[0]); hemi.groundColor.set(th.hemi[1]); hemi.intensity = th.hemi[2]; sun.color.set(th.sun[0]); sun.intensity = th.sun[1]; };
  function backdrop(key) { return canvasTex(1024, 512, (x, w, h) => { const th = THEMES[key]; const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, th.sky[0]); g.addColorStop(0.75, th.sky[1]); g.addColorStop(1, th.fog); x.fillStyle = g; x.fillRect(0, 0, w, h);
      const sun = x.createRadialGradient(w * 0.7, h * 0.35, 5, w * 0.7, h * 0.35, 120); sun.addColorStop(0, 'rgba(255,250,220,.9)'); sun.addColorStop(1, 'rgba(255,240,200,0)'); x.fillStyle = sun; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(255,255,255,.55)'; const cx = (i * 197) % w, cy = 60 + (i * 53) % 120; for (let j = 0; j < 5; j++) { x.beginPath(); x.ellipse(cx + j * 26, cy + Math.sin(j) * 8, 34, 18, 0, 0, 7); x.fill(); } }
      const layers = key === 'jungle' ? [['#3f6b4a', 0.5, 80], ['#2c5238', 0.64, 60], ['#1b3a26', 0.78, 45]] : key === 'desert' ? [['#e8a07e', 0.55, 90], ['#d47a5a', 0.66, 70], ['#b85e48', 0.78, 50]] : [['#b8cde0', 0.58, 60], ['#93acc6', 0.7, 45], ['#7590ad', 0.8, 35]];
      layers.forEach(([c, base, amp], li) => { x.fillStyle = c; x.beginPath(); x.moveTo(0, h); let px = 0; while (px <= w) { if (key === 'jungle') { const r = 26 + ((px * 13 + li * 29) % 30); const top = h * base - amp * (0.3 + ((px * 7 + li * 11) % 100) / 160); x.lineTo(px, top + r * 0.6); x.quadraticCurveTo(px + r * 0.1, top - r * 0.9, px + r, top - r * 0.2); x.quadraticCurveTo(px + r * 1.6, top - r, px + r * 2, top + r * 0.3); px += r * 1.8; continue; }
          if (key === 'desert') { const wd = 60 + ((px * 7 + li * 31) % 90); const top = h * base - amp * (0.4 + ((px * 13 + li * 7) % 100) / 100); x.lineTo(px, h * base); x.lineTo(px + 10, top); x.lineTo(px + wd - 10, top); x.lineTo(px + wd, h * base); px += wd + ((px * 3) % 40); }
          else { const wd = 26 + ((px * 7 + li * 13) % 40); const top = h * base - amp * (0.5 + ((px * 11 + li * 5) % 100) / 100); x.lineTo(px, top + 10); x.lineTo(px + wd / 2, top - (li < 2 && (px % 7 < 2) ? 50 : 14)); x.lineTo(px + wd, top + 10); px += wd; } } x.lineTo(w, h); x.fill(); x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(0, h * base - 4, w, 4); }); }); }
  const BD = {}; for (const k of ORDER) BD[k] = backdrop(k); const bdM = new THREE.MeshBasicMaterial({ map: BD[ORDER[0]], fog: false, depthWrite: false }); const bdMesh = new THREE.Mesh(new THREE.PlaneGeometry(300, 150), bdM); bdMesh.renderOrder = -1; scene.add(bdMesh);
  const _st = setTheme; setTheme = (k) => { _st(k); bdM.map = BD[k]; bdM.needsUpdate = true; scene.background = new THREE.Color(THEMES[k].sky[0]); };
  setTheme(ORDER[0]); if (JG && S.r) S.r.toneMappingExposure *= 0.8; if (JG) rails.forEach(r => (r.visible = false));
  const pl = { lane: 0, x: 0, y: 0, vy: 0, roll: 0, stumble: 0, ground: 0, immune: 0 };
  window.__RR = { items, pl, get g() { return window.__GL && __GL.g; } };
  const dummy = new THREE.Object3D(); const proj = new THREE.Vector3();
  const pill = (c, x, y, w, h) => { c.fillStyle = 'rgba(20,16,40,.72)'; K.rr(c, x, y, w, h, h / 2); c.fill(); c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 2; c.stroke(); };
  const coinIcon = (c, x, y, r) => { const gr = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r); gr.addColorStop(0, '#fff6c4'); gr.addColorStop(0.5, '#ffc531'); gr.addColorStop(1, '#c47a00'); c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.strokeStyle = '#9a5c00'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r * 0.62, 0, 7); c.stroke(); };
  const star = (c, x, y, r, col) => { c.fillStyle = col; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.fill(); };
  K.run({ id: cfg.id, title: cfg.title, help: cfg.help, bg: 'transparent', overText: 'CAUGHT',
    init(g) { gref = g; for (const it of items) if (it.o) world.remove(it.o); items.length = 0; Object.assign(pl, { lane: 0, x: 0, y: 0, vy: 0, roll: 0, stumble: 0, ground: 0, immune: 0 }); g.z = 0; g.nextTurn = -120; g.turnT = 0; world.rotation.y = 0; g.sp = cfg.speed || 15; g.next = -30; g.lastM = 0; g.coins = 0; g.pu = { magnet: 0, jump: 0, double: 0 }; g.chase = 0.2; g.land = 0; g.camX = 0; g.themeAt = 1000; g.ti = 0; setTheme(new URLSearchParams(location.search).get('theme') || ORDER[0]); play('sprint'); g.mult = 1; },
    update(g, dt) {
      mixer.update(g.state === 'play' ? dt : dt * 0.3); cmixer.update(g.state === 'play' ? dt * 1.15 : 0); for (const b of BIG) b.scale.setScalar(b.userData.big); if (g.state !== 'play') return;
      if (g.ptr.pressed && g.ptr.x < 64 && g.ptr.y < 64) { g.paused = true; return; }
      for (const k in g.pu) g.pu[k] = Math.max(0, g.pu[k] - dt); g.mult = (1 + Math.min(4, Math.floor(g.coins / 50))) * (g.pu.double > 0 ? 2 : 1);
      g.sp = Math.min(34, (cfg.speed || 15) + g.t * 0.09); g.z -= g.sp * dt; const m = Math.floor(-g.z / 2); if (m > g.lastM) { g.add((m - g.lastM) * g.mult, 'm'); g.lastM = m; }
      if (g.lastM >= g.themeAt) { g.themeAt += 1000; g.ti++; setTheme(ORDER[g.ti % ORDER.length]); g.flash('#fff', 0.35); g.float(g.W / 2, g.H * 0.3, THEMES[theme].name.toUpperCase(), '#fff', 22); g.mark('t', g.ti); }
      const P = g.ptr; let sw = null; if (P.released && !(P.sx < 64 && P.sy < 64)) { const dx = P.x - P.sx, dy = P.y - P.sy; if (Math.abs(dx) > 25 && Math.abs(dx) > Math.abs(dy)) sw = dx > 0 ? 'r' : 'l'; else if (Math.abs(dy) > 25) sw = dy < 0 ? 'u' : 'd'; else sw = 'u'; }
      if (g.kd('ArrowLeft') || g.kd('a')) sw = 'l'; if (g.kd('ArrowRight') || g.kd('d')) sw = 'r'; if (g.kd('ArrowUp') || g.kd('w') || g.kd(' ')) sw = 'u'; if (g.kd('ArrowDown') || g.kd('s')) sw = 'd';
      if (JG && (sw === 'l' || sw === 'r') && !g.turnT) { const jn = items.find(it => it.kind === 'turn' && !it.done && it.z - g.z > -2.5 && it.z - g.z < JW); if (jn) { if (sw === jn.dir) { jn.done = true; g.turnT = 0.42; g.turnDir = sw === 'l' ? 1 : -1; g.sfx('whoosh'); g.add(25 * g.mult, 'u'); } sw = null; } }
      if (g.turnT) { g.turnT = Math.max(0, g.turnT - dt); const k = 1 - g.turnT / 0.42; world.rotation.y = g.turnDir * (Math.PI / 2) * (k * k * (3 - 2 * k)); world.position.set(0, 0, 0);
        if (!g.turnT) { world.rotation.y = 0; for (const it of items) if (it.z - g.z > -45) it.dead = true; g.next = Math.min(g.next, g.z - 40); pl.lane = 0; pl.x = 0; g.flash('#1b2a1a', 0.18); } }
      if (sw === 'l' && pl.lane > -1) { pl.lane--; g.sfx('whoosh'); } if (sw === 'r' && pl.lane < 1) { pl.lane++; g.sfx('whoosh'); }
      const grounded = pl.y <= pl.ground + 0.001; if (sw === 'u' && grounded) { pl.vy = JUMP * (g.pu.jump > 0 ? 1.35 : 1); pl.roll = 0; g.sfx('jump'); play('jump', 0.08); } if (sw === 'd') { if (!grounded) pl.vy = -26; pl.roll = 0.65; play('crouch', 0.08); g.sfx('whoosh'); }
      const prevX = pl.x; pl.x = K.lerp(pl.x, pl.lane * LANE, Math.min(1, dt * 14)); pl.roll = Math.max(0, pl.roll - dt); pl.stumble = Math.max(0, pl.stumble - dt); pl.immune = Math.max(0, pl.immune - dt);
      let gh = 0; for (const it of items) { const iz = it.z - g.z; if (it.kind === 'train' && Math.abs(it.lane * LANE - pl.x) < 1.1 && iz - it.len / 2 < 0.4 && iz + it.len / 2 > -0.4 && pl.y >= it.h - 0.35) gh = Math.max(gh, it.h); if (it.kind === 'ramp' && Math.abs(it.lane * LANE - pl.x) < 1 && iz < 2.3 && iz > -2.3) { const u = (2.3 - iz) / 4.6; gh = Math.max(gh, it.h * u * u); } }
      pl.ground = gh; pl.vy -= GRAV * dt; pl.y += pl.vy * dt; if (pl.y < gh) { if (pl.vy < -8) g.land = 0.16; pl.y = gh; pl.vy = 0; if (cur === acts.jump) play(pl.roll > 0 ? 'crouch' : 'sprint', 0.1); }
      if (grounded && pl.roll <= 0 && cur !== acts.sprint && cur !== acts.jump) play('sprint');
      for (const it of items) { if (it.dead) continue; if (it.moving) it.z += 10 * dt; const iz = it.z - g.z; const dx = Math.abs(it.lane * LANE - pl.x);
        if (it.pu) { if (dx < 1.1 && Math.abs(iz) < 0.9 && pl.y < 2.5) { it.dead = true; g.pu[it.kind] = 10; g.add(25, 'u'); g.sfx('power'); g.flash(PU[it.kind].c, 0.12); g.float(g.W / 2, g.H * 0.35, PU[it.kind].label + '!', PU[it.kind].c, 26); } continue; }
        if (it.kind === 'coin') { if (g.pu.magnet > 0 && iz < 1 && iz > -14) it.mag = true; if (it.mag) { it.lane += (pl.x / LANE - it.lane) * Math.min(1, dt * 9); it.y += (pl.y + 0.8 - it.y) * Math.min(1, dt * 9); it.z += (g.z - it.z) * Math.min(1, dt * 7); }
          if (Math.abs(it.lane * LANE - pl.x) < 1 && Math.abs(it.z - g.z) < 0.8 && Math.abs(it.y - (pl.y + 0.8)) < 1.2) { it.dead = true; g.coins++; g.add(10 * g.mult, 'c'); g.sfx('coin'); proj.set(it.lane * LANE, it.y, it.z - g.z).project(cam); g.burst((proj.x + 1) / 2 * g.W, (1 - proj.y) / 2 * g.H, ['#fff3b0', '#ffc531', '#fff'], 12, 160, 0.45, 4); } continue; }
        if (it.kind === 'turn') { if (!it.done && iz > JW + 0.5) return die(g, 'Hit a temple wall'); continue; }
        if (it.kind === 'gap') { if (Math.abs(iz) < 1.5 && pl.y < 0.25) return die(g, 'Fell into the ravine'); continue; }
        if (dx > 1.1) continue; let hit = false;
        if (it.kind === 'train' && iz + it.len / 2 > -0.3 && iz - it.len / 2 < 0.3 && pl.y < it.h - 0.4) hit = Math.abs(iz - it.len / 2) < 1.2 || it.moving ? 'front' : 'side';
        if (it.kind === 'low' && Math.abs(iz) < 0.45 && pl.y < 1.05) hit = 'front'; if (it.kind === 'high' && Math.abs(iz) < 0.35 && pl.roll <= 0 && pl.y < 1.5) hit = 'front';
        if (hit === 'side' || (hit && Math.abs(prevX - pl.x) > 0.05 && dx > 0.5)) { const back = pl.x > it.lane * LANE ? 1 : -1; pl.lane = K.clamp(it.lane + back, -1, 1); if (pl.immune > 0) continue; pl.immune = 0.9; if (pl.stumble > 0) return die(g, 'Tripped twice'); pl.stumble = 2.0; g.chase = 0; g.shake(6); g.sfx('hit'); g.float(g.W / 2, g.H * 0.4, 'STUMBLE!', '#ffd23f', 24); continue; }
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
      const portrait=cam.aspect<0.72; cam.position.set(g.camX+(Math.random()-.5)*shake,(portrait?5.3:4.9)+pl.y*.55,portrait?9.5:7.5); cam.lookAt(g.camX*.9,1.3+pl.y*.45,portrait?-11.6:-10);
      bdMesh.position.set(cam.position.x, 28, -126); sun.position.set(pl.x + 7, 16, 4); sun.target.position.set(pl.x, 0, -8); S.render();
      if (g.state === 'play' && g.sp > 21) { c.strokeStyle = `rgba(255,255,255,${Math.min(0.3, (g.sp - 21) * 0.025)})`; c.lineWidth = 2; c.beginPath(); for (let i = 0; i < 14; i++) { const a = (i * 2.399) % 6.283, r0 = 170 + ((g.t * 900 + i * 97) % 220); c.moveTo(g.W / 2 + Math.cos(a) * r0, g.H * 0.42 + Math.sin(a) * r0); c.lineTo(g.W / 2 + Math.cos(a) * (r0 + 40), g.H * 0.42 + Math.sin(a) * (r0 + 40)); } c.stroke(); }
      if (g.state === 'play' && pl.stumble > 0) { c.fillStyle = `rgba(239,68,68,${0.14 + Math.sin(g.t * 10) * 0.07})`; c.fillRect(0, 0, 10, g.H); c.fillRect(g.W - 10, 0, 10, g.H); }
    },
    hudDraw(g,c){const W=g.W,right=W-12;
      // Fit long score strings into portrait panels; no off-screen overhang.
      const number=(value,x,y,width,maxSize,align)=>{
        const v=String(value);c.save();let size=maxSize;
        while(size>10){c.font='bold '+size+'px system-ui,sans-serif';if(c.measureText(v).width<width-5)break;size--;}
        c.beginPath();c.rect(align==='right'?x-width:x-width/2,y-18,width,36);c.clip();
        g.txt(v,x,y,size,'#fff',align);c.restore();
      };
      const pg=c.createLinearGradient(0,12,0,56);pg.addColorStop(0,'#6ad1ff');pg.addColorStop(1,'#2a7fd6');
      c.fillStyle=pg;K.rr(c,12,12,44,44,12);c.fill();c.strokeStyle='#fff';c.lineWidth=3;c.stroke();
      c.fillStyle='#fff';c.fillRect(26,23,6,22);c.fillRect(37,23,6,22);
      pill(c,right-184,12,184,40);star(c,right-148,32,13,'#ffd23f');
      g.txt('x'+g.mult,right-171,32,16,'#ffd23f');
      number(Math.floor(g.score).toLocaleString('en-US'),right-9,32,95,22,'right');
      pill(c,right-108,58,108,34);coinIcon(c,right-18,75,11);
      number(g.coins,right-36,75,61,17,'right');
      c.fillStyle='rgba(20,16,40,.6)';K.rr(c,right-80,98,80,46,10);c.fill();
      g.txt('BEST',right-40,110,10,'#ffd23f');number(g.best,right-40,130,67,15,'center');
      let yy = 68; for (const k in PU) if (g.pu[k] > 0) { pill(c, 12, yy, 130, 22); c.fillStyle = PU[k].c; K.rr(c, 14, yy + 2, 126 * g.pu[k] / 10, 18, 9); c.fill(); g.txt(PU[k].label, 77, yy + 11, 11, '#1a1030'); yy += 28; }
    } });
  function die(g, why) { play('die', 0.05); g.flash('#fff', 0.15); g.end(why); }
}
