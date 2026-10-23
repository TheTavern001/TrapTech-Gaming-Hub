// Drift Rush v9 - 3D highway drift racer (original code, MIT). Reference gameplay: Traffic Racer / Drift Boss.
// Chase camera on a curving 4-lane highway at golden hour. Weave through one-way traffic, slide through bends to build drift
// points, pass cars close for near-miss bonuses, grab nitro, dodge roadworks and oil. 3 hearts, a repair every 1,500 m.
// Render: three.js on a WebGL canvas behind the game canvas; the 2D canvas is a transparent HUD overlay.
// Assets: Hub car set rc-*.glb (original, CC0), Quaternius Stylized Nature (CC0), Kenney lamp (CC0), Poly Haven asphalt/grass (CC0).
// Scoring contract unchanged (src/ac-levels.js): score = meters + banked points; 'm' every 250 m (<= 75 m/s), 'd' per bank
// (<= 95 pts/s since the previous bank). Banks are clamped client-side so a legitimate run can never exceed the server bound.
// Fairness: every gameplay random draw comes from the run seed (this.r) in distance order; visuals use their own RNG.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Game8, PAL, TAU, clamp, lerp, fmt, roundRect } from './kit.js';

const A3 = '/games-lib/assets3d/';
const CARS = ['rc-sedan', 'rc-hatch', 'rc-suv', 'rc-van', 'rc-pickup', 'rc-boxtruck'];
const CAR_W = { 'rc-sedan': 1.85, 'rc-hatch': 1.8, 'rc-suv': 1.95, 'rc-van': 2.0, 'rc-pickup': 2.0, 'rc-boxtruck': 2.3 };
const NATURE = ['qn-Rock_Medium_1'];
const PAINTS = ['#f2f2f0', '#c9ccd1', '#1c1d21', '#24426e', '#7d1f22', '#5b6168', '#2f4f3b', '#d8c9a8', '#3b6fb6'];
const LANES = 4, BEHIND = 25, AHEAD = 340, SEG = 3;
const half = (d) => Math.max(6.0, 7.2 - d / 2500);                                    // road half-width at distance d (m)
const frac = (v) => v - Math.floor(v);
// Sharp chicanes every ~1.1-1.5 km (fixed layout, identical for every player): the road swings 13-20 m out and back over 150 m.
const CH_L = 150; const chicane = (k) => { const r = frac(Math.sin(k * 127.1 + 3.7) * 43758.5453); return { start: 1000 + k * 1150 + r * 350, A: (k % 2 ? 1 : -1) * (13 + r * 7) }; };
function chicaneOff(d) { if (d < 1000) return 0; const k0 = Math.floor((d - 1000) / 1150); let o = 0; for (let k = Math.max(0, k0 - 1); k <= k0; k++) { const c = chicane(k), u = (d - c.start) / CH_L; if (u > 0 && u < 1) o += c.A * Math.sin(Math.PI * u) ** 2; } return o; }
const curve = (d) => Math.min(10, 1.2 + d / 260) * (Math.sin(d / 95) + 0.5 * Math.sin(d / 39 + 1.3)) + chicaneOff(d); // centreline offset (m)
const laneX = (d, i) => curve(d) - half(d) + (half(d) * 2 / LANES) * (i + 0.5);
function vrng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function tex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t; }

// A glTF scene flattened into InstancedMeshes (one per sub-mesh): many copies cost one draw call per material.
function instanced(scene, count, xf, parent, paintable, noShadow) {
  scene.updateMatrixWorld(true); const parts = [];
  scene.traverse(o => { if (!o.isMesh) return; const g = o.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(xf, o.matrixWorld));
    const im = new THREE.InstancedMesh(g, o.material, count); im.castShadow = !noShadow; im.receiveShadow = !noShadow; im.frustumCulled = false;
    if (paintable && o.material.userData.paint) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(1), 3);
    const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < count; i++) im.setMatrixAt(i, z); parent.add(im); parts.push(im); });
  return { parts, set(i, m) { for (const p of parts) p.setMatrixAt(i, m); }, color(i, c) { for (const p of parts) if (p.instanceColor) p.setColorAt(i, c); },
    hide(i) { const z = new THREE.Matrix4().makeScale(0, 0, 0); for (const p of parts) p.setMatrixAt(i, z); }, use(n) { for (const p of parts) p.count = n; }, flush() { for (const p of parts) { p.instanceMatrix.needsUpdate = true; if (p.instanceColor) p.instanceColor.needsUpdate = true; } } };
}
// Transform that scales a model to `size` along `axis`, centres it on x/z, sits it on y=0 and optionally turns +X-forward to -Z.
function fitXf(scene, axis, size, turn) {
  scene.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(scene), s = new THREE.Vector3(), c = new THREE.Vector3(); b.getSize(s); b.getCenter(c);
  const k = size / s[axis]; const m = new THREE.Matrix4().makeTranslation(-c.x * k, -b.min.y * k, -c.z * k).multiply(new THREE.Matrix4().makeScale(k, k, k));
  return turn ? new THREE.Matrix4().makeRotationY(Math.PI / 2).multiply(m) : m;
}
// A strip that follows the road: lateral edges from fn(d) -> [left, right], rebuilt every frame around the car.
class Ribbon {
  constructor(parent, mat, y, fn, vLen, uLen) {
    this.fn = fn; this.y = y; this.vLen = vLen; this.uLen = uLen; this.n = Math.ceil((BEHIND + AHEAD) / SEG) + 1;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.n * 6), 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.n * 4), 2));
    const idx = []; for (let i = 0; i < this.n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.n * 6).map((_, i) => i % 3 === 1 ? 1 : 0), 3));
    this.mesh = new THREE.Mesh(g, mat); this.mesh.receiveShadow = true; this.mesh.frustumCulled = false; parent.add(this.mesh);
  }
  update(D) {
    const P = this.mesh.geometry.attributes.position.array, U = this.mesh.geometry.attributes.uv.array; const d0 = Math.floor((D - BEHIND) / SEG) * SEG;
    for (let i = 0; i < this.n; i++) { const d = d0 + i * SEG, [l, r] = this.fn(d), j = i * 6, k = i * 4;
      P[j] = l; P[j + 1] = this.y; P[j + 2] = -d; P[j + 3] = r; P[j + 4] = this.y; P[j + 5] = -d;
      const v = d / this.vLen; U[k] = 0; U[k + 1] = v; U[k + 2] = this.uLen ? (r - l) / this.uLen : 1; U[k + 3] = v; }
    this.mesh.geometry.attributes.position.needsUpdate = true; this.mesh.geometry.attributes.uv.needsUpdate = true; this.mesh.geometry.computeBoundingSphere();
  }
}

export class DriftRush extends Game8 {
  get title() { return 'DRIFT RUSH'; }
  get hint() { return 'Hold the left or right side of the screen to steer. Slide through bends to build drift points, then straighten up to bank them. Pass traffic closely for near-miss bonuses (they raise your multiplier, up to x3). Grab nitro, avoid roadworks and oil. 3 hearts, with a repair every 1,500 m.'; }
  get accent() { return '#fb923c'; }
  get musicOpts() { return { root: 52, bpm: 134, mode: 'minor', seed: 21, vol: 0.26 }; }
  // Per-game settings shown in the game's settings panel / pause menu (display only, no gameplay effect)
  get settingsSchema() { return [
    { key: 'pov', label: 'Camera view', def: 'chase', options: [['chase', 'Chase'], ['far', 'Chase (far)'], ['hood', 'Hood'], ['bumper', 'Bumper'], ['top', 'Top-down']] },
    { key: 'detail', label: 'Graphics detail', def: 'balanced', options: [['high', 'High'], ['balanced', 'Balanced'], ['performance', 'Performance (battery saver)']] },
    { key: 'fx', label: 'Camera shake & speed effects', def: 'on', options: [['on', 'On'], ['off', 'Off']] }]; }
  applySettings(x) { this.opt = { pov: 'chase', detail: 'balanced', fx: 'on', ...x }; this._camInit = false; if (this.ready3) this.applyDetail(); }
  applyDetail() {
    const d = (this.opt || {}).detail || 'balanced', R = this.R3; const shadows = d !== 'performance';
    if (R.shadowMap.enabled !== shadows) { R.shadowMap.enabled = shadows; this.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); }); }
    this.prMax = d === 'high' ? Math.min(devicePixelRatio || 1, 2) : d === 'balanced' ? Math.min(devicePixelRatio || 1, 1.4) : 1; this.pr = this.prMax; R.setPixelRatio(this.pr); this._rw = 0;
    this.density = d === 'high' ? 1 : d === 'balanced' ? 0.75 : 0.45;
  }

  // ---------- 3D setup ----------
  async load() {
    const parent = this.c.parentElement; const cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;z-index:-1;pointer-events:none;display:block';
    parent.insertBefore(cv, this.c); this.gl = cv;
    const R = this.R3 = new THREE.WebGLRenderer({ canvas: cv, antialias: (devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
    this.pr = Math.min(devicePixelRatio || 1, 1.5); R.setPixelRatio(this.pr); R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
    R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.0; R.outputColorSpace = THREE.SRGBColorSpace;
    const S = this.scene = new THREE.Scene(); const pm = new THREE.PMREMGenerator(R); this.pm = pm;
    // golden-hour sky + matching fog
    const HZ = '#f3c38c'; S.fog = new THREE.Fog(HZ, 140, 330);
    const sky = tex(4, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#3f63a0'); g.addColorStop(0.5, '#8aa7cf'); g.addColorStop(0.74, '#ecc29a'); g.addColorStop(0.8, HZ); g.addColorStop(1, HZ); x.fillStyle = g; x.fillRect(0, 0, w, h); });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(600, 24, 16), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, fog: false, depthWrite: false })); S.add(this.sky);
    const glow = tex(128, 128, (x, w) => { const g = x.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(255,248,225,1)'); g.addColorStop(0.18, 'rgba(255,214,150,.9)'); g.addColorStop(1, 'rgba(255,180,110,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
    this.sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, fog: false, depthWrite: false, transparent: true })); this.sun.scale.set(95, 95, 1); S.add(this.sun);
    { // reflections: PMREM of the real sky + ground + a bright sun, so paint and glass mirror golden hour
      const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide })));
      const gr = new THREE.Mesh(new THREE.CircleGeometry(49, 32), new THREE.MeshBasicMaterial({ color: '#6f7a4a' })); gr.rotation.x = -Math.PI / 2; gr.position.y = -2; es.add(gr);
      const sn = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 7.5, 5.5) })); sn.position.set(18, 10, -40); es.add(sn);
      S.environment = pm.fromScene(es, 0.02).texture; }
    S.add(new THREE.HemisphereLight('#bcd3f2', '#6b5a3a', 0.9));
    const L = this.light = new THREE.DirectionalLight('#ffe2b8', 2.6); L.castShadow = true; L.shadow.mapSize.set(1024, 1024);
    Object.assign(L.shadow.camera, { left: -28, right: 28, top: 30, bottom: -30, near: 1, far: 120 }); L.shadow.bias = -0.0004; L.shadow.normalBias = 0.03; S.add(L, L.target);
    this.cam = new THREE.PerspectiveCamera(62, 1, 0.2, 700);

    // textures
    const tl = new THREE.TextureLoader(); const ld = (f, srgb, rx, ry) => { const t = tl.load(A3 + 'tex/' + f); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; return t; };
    const asphalt = new THREE.MeshStandardMaterial({ map: ld('ph-asphalt02-diff.webp', true, 1, 1), normalMap: ld('ph-asphalt02-nor.webp', false, 1, 1), color: '#9a958f', roughness: 0.92 });
    const grassT = ld('ph-grass-rock-diff.webp', true, 60, 60); this.grassT = grassT;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ map: grassT, color: '#7f9a4c', roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.04; ground.receiveShadow = true; S.add(ground); this.ground = ground;
    const line = (dash) => new THREE.MeshStandardMaterial({ map: tex(16, 128, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#f4f1e8'; if (dash) x.fillRect(0, 0, w, h * 0.45); else x.fillRect(0, 0, w, h); }, true), transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });
    const curb = new THREE.MeshStandardMaterial({ map: tex(16, 64, (x, w, h) => { x.fillStyle = '#c8202a'; x.fillRect(0, 0, w, h); x.fillStyle = '#f2f2f2'; x.fillRect(0, h / 2, w, h / 2); }, true), roughness: 0.7 });
    const shoulder = new THREE.MeshStandardMaterial({ color: '#8a7a62', roughness: 1 });
    const R0 = this.ribbons = [];
    R0.push(new Ribbon(S, shoulder, -0.01, d => [curve(d) - half(d) - 3.2, curve(d) + half(d) + 3.2], 30, 0));
    R0.push(new Ribbon(S, asphalt, 0.0, d => [curve(d) - half(d) - 0.5, curve(d) + half(d) + 0.5], 7, 7));
    for (const s of [-1, 1]) {
      R0.push(new Ribbon(S, line(false), 0.012, d => { const e = curve(d) + s * (half(d) - 0.35); return [e - 0.09, e + 0.09]; }, 9, 0));
      R0.push(new Ribbon(S, curb, 0.05, d => { const e = curve(d) + s * (half(d) + 0.5); return s < 0 ? [e - 0.55, e] : [e, e + 0.55]; }, 2, 0));
    }
    for (let i = 1; i < LANES; i++) R0.push(new Ribbon(S, line(true), 0.012, d => { const e = curve(d) - half(d) + (half(d) * 2 / LANES) * i; return [e - 0.07, e + 0.07]; }, 9, 0));

    // models
    const gl = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder); const M = {};
    await Promise.all([...CARS, ...NATURE].map(n => gl.loadAsync(A3 + n + '.glb').then(g => { M[n] = g.scene; }).catch(() => { M[n] = null; })));
    const mats = { glass: new THREE.MeshPhysicalMaterial({ color: '#0d1620', metalness: 0.1, roughness: 0.04, clearcoat: 1, envMapIntensity: 1.6 }), chrome: new THREE.MeshStandardMaterial({ color: '#e9edf2', metalness: 1, roughness: 0.14 }),
      rim: new THREE.MeshStandardMaterial({ color: '#b9bec6', metalness: 1, roughness: 0.3 }), tire: new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.9 }), trim: new THREE.MeshStandardMaterial({ color: '#16171a', roughness: 0.55, metalness: 0.2 }),
      light_f: new THREE.MeshStandardMaterial({ color: '#fff6dc', emissive: '#fff1c8', emissiveIntensity: 1.4, roughness: 0.1 }), light_r: new THREE.MeshStandardMaterial({ color: '#5a0505', emissive: '#d0101a', emissiveIntensity: 0.9, roughness: 0.2 }),
      box: new THREE.MeshStandardMaterial({ color: '#eceae4', roughness: 0.5, envMapIntensity: 0.6 }) };
    const paintMat = (c) => { const m = new THREE.MeshPhysicalMaterial({ color: c, metalness: 0.5, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.05 }); m.userData.paint = true; return m; };
    const dress = (scene, paint) => { scene.traverse(m => { if (!m.isMesh) return; const n = (m.material.name || '').replace(/\.\d+$/, ''); m.material = n === 'paint' ? paint : (mats[n] || mats.trim); }); return scene; };
    this.traffic3 = []; const trafficPaint = paintMat('#ffffff');
    for (const n of CARS) if (M[n]) this.traffic3.push({ n, w: CAR_W[n], I: instanced(dress(M[n].clone(true), trafficPaint), 8, fitXf(M[n], 'z', CAR_W[n], true), S, true) });
    if (!this.traffic3.length) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.3, 4.2), trafficPaint); b.position.y = 0.75; g.add(b); this.traffic3.push({ n: 'box', w: 1.8, I: instanced(g, 8, new THREE.Matrix4(), S, true) }); }
    const pc = M['rc-hatch'] || M['rc-sedan']; this.player = new THREE.Group();
    if (pc) { const body = dress(pc.clone(true), paintMat('#d0182a')); body.applyMatrix4(fitXf(pc, 'z', 1.82, true)); body.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); this.player.add(body); }
    // real wheels: replace the body's baked tyres/rims with 4 wheels that spin with speed; the front pair steers
    this.wheels = []; if (pc) { this.player.updateMatrixWorld(true); const pts = []; const inv = new THREE.Matrix4().copy(this.player.matrixWorld).invert();
      this.player.traverse(m => { if (!m.isMesh || (m.material !== mats.tire && m.material !== mats.rim)) return; const pos = m.geometry.attributes.position, mw = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld), v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i += 3) { v.fromBufferAttribute(pos, i).applyMatrix4(mw); pts.push(v.clone()); } m.visible = false; });
      const rimT = tex(128, 128, (x, w) => { x.fillStyle = '#16171a'; x.fillRect(0, 0, w, w); const g = x.createRadialGradient(64, 64, 6, 64, 64, 58); g.addColorStop(0, '#f4f6f8'); g.addColorStop(0.75, '#9aa1aa'); g.addColorStop(1, '#5b6169'); x.fillStyle = g; x.beginPath(); x.arc(64, 64, 52, 0, TAU); x.fill();
        x.fillStyle = '#1b1c20'; for (let k = 0; k < 5; k++) { x.save(); x.translate(64, 64); x.rotate(k * TAU / 5 + 0.63); x.beginPath(); x.moveTo(-9, 16); x.lineTo(9, 16); x.lineTo(15, 46); x.lineTo(-15, 46); x.fill(); x.restore(); } x.fillStyle = '#c8cdd3'; x.beginPath(); x.arc(64, 64, 10, 0, TAU); x.fill(); });
      const rimM = new THREE.MeshStandardMaterial({ map: rimT, metalness: 0.9, roughness: 0.28 });
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const q = pts.filter(v => Math.sign(v.x) === sx && Math.sign(v.z) === sz); if (q.length < 6) continue; const b = new THREE.Box3().setFromPoints(q), c = new THREE.Vector3(), z = new THREE.Vector3(); b.getCenter(c); b.getSize(z);
        const r = z.y / 2, wd = Math.max(0.18, z.x); const hub = new THREE.Group(); hub.position.copy(c); const spin = new THREE.Group(); hub.add(spin);
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, wd, 28, 1, true).rotateZ(Math.PI / 2), mats.tire); const side = new THREE.Mesh(new THREE.CircleGeometry(r * 0.66, 28).rotateY(sx * Math.PI / 2), rimM); side.position.x = sx * wd / 2 + sx * 0.005;
        const wall = new THREE.Mesh(new THREE.RingGeometry(r * 0.64, r, 28).rotateY(sx * Math.PI / 2), mats.tire); wall.position.x = sx * wd / 2; spin.add(tire, side, wall); spin.traverse(m => { if (m.isMesh) m.castShadow = true; });
        this.player.add(hub); this.wheels.push({ hub, spin, front: sz < 0, r }); } }
    // tail / brake lights + headlight glow (sprites) on the player car
    const lgT = tex(64, 64, (x, w) => { const g = x.createRadialGradient(32, 32, 1, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
    const pb2 = (() => { const b = new THREE.Box3().setFromObject(this.player), z = new THREE.Vector3(); b.getSize(z); return { zF: b.min.z, zR: b.max.z, w: z.x * 0.34, h: z.y }; })();
    this.tails = []; for (const sx of [-1, 1]) { const t = new THREE.Sprite(new THREE.SpriteMaterial({ map: lgT, color: '#ff2a2a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 })); t.scale.set(0.7, 0.45, 1); t.position.set(sx * pb2.w, pb2.h * 0.6, pb2.zR + 0.03); this.player.add(t); this.tails.push(t);
      const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: lgT, color: '#fff3d6', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 })); h.scale.set(0.8, 0.5, 1); h.position.set(sx * pb2.w, pb2.h * 0.5, pb2.zF - 0.03); this.player.add(h); }
    // nitro flames + headlight glow
    const pb = new THREE.Box3().setFromObject(this.player), pbS = new THREE.Vector3(); pb.getSize(pbS); this.pbox = { zF: pb.min.z, zR: pb.max.z, w: pbS.x, h: pbS.y };
    this.flames = new THREE.Group(); const fm = new THREE.MeshBasicMaterial({ color: '#7dd3fc', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const sx of [-0.45, 0.45]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.1, 10), fm); f.rotation.x = Math.PI / 2; f.position.set(sx * this.pbox.w * 0.6, 0.36, this.pbox.zR + 0.45); this.flames.add(f); }
    this.flames.visible = false; this.player.add(this.flames); S.add(this.player);
    // scenery (instanced pools, recycled as the car drives)
    this.scen = []; const VR = this.vr = vrng(0x5eed1e);
    // Scenery: photoreal impostors (Poly Haven CC0 models pre-rendered by tools/build-impostors) as crossed cards = 4 tris each,
    // one draw call per species, no shadow casting; a soft contact shadow grounds every tree.
    const addScen = (n, src, size, axis, count, spacing, lat, scl) => { if (!src) return; this.scen.push({ I: instanced(src, count, fitXf(src, axis, size, false), S, false, true), count, spacing, lat, scl, items: [], next: -BEHIND }); };
    const IMP = A3 + 'tex/imp/', blobT = tex(64, 64, (x, w) => { const g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
    const card = (map, aspect, blob) => { const h = 1, w = aspect; const a = new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0), b = a.clone().rotateY(Math.PI / 2); const g = new THREE.Group();
      g.add(new THREE.Mesh(mergeGeometries([a, b]), new THREE.MeshBasicMaterial({ map, alphaTest: 0.45, side: THREE.DoubleSide, color: '#e9e4da' })));
      if (blob) { const sh = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, w * 0.9).rotateX(-Math.PI / 2).translate(0, 0.03, 0), new THREE.MeshBasicMaterial({ map: blobT, transparent: true, depthWrite: false })); g.add(sh); } return g; };
    const impT = (f) => { const t = tl.load(IMP + f); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
    const pole = new THREE.Group(); { const metal = new THREE.MeshStandardMaterial({ color: '#8d939b', metalness: 0.7, roughness: 0.45 }); const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 8, 8), metal); p1.position.y = 4;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.2), metal); arm.position.set(0, 7.9, -1.05); const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.8), metal); head.position.set(0, 7.85, -2.0);
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.62), new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: '#ffd99a', emissiveIntensity: 1.2 })); bulb.position.set(0, 7.78, -2.0); pole.add(p1, arm, head, bulb); }
    addScen('tree-a', card(impT('imp-tree-a.webp'), 1.232, true), 9, 'y', 34, 13, [5, 45], [0.8, 1.35]);
    addScen('tree-b', card(impT('imp-tree-b.webp'), 1.274, true), 9, 'y', 30, 15, [6, 55], [0.8, 1.4]);
    addScen('fir', card(impT('imp-fir.webp'), 0.632, true), 12, 'y', 40, 10, [9, 70], [0.7, 1.4]);
    addScen('bush-a', card(impT('imp-bush-a.webp'), 0.897, false), 2.2, 'y', 34, 9, [1.6, 16], [0.7, 1.5]);
    addScen('bush-b', card(impT('imp-bush-b.webp'), 0.735, false), 2.4, 'y', 30, 11, [2, 22], [0.7, 1.5]);
    addScen('fern', card(impT('imp-fern.webp'), 2.313, false), 0.9, 'y', 40, 6, [0.9, 8], [0.8, 1.6]);
    addScen('qn-Rock_Medium_1', M['qn-Rock_Medium_1'], 1.8, 'y', 10, 36, [2.2, 30], [0.6, 1.8]);
    // hemp fields (subtle theme): rows of procedurally drawn cannabis plants on a few stretches of farmland
    const hempT = tex(256, 320, (x, w, h) => { x.clearRect(0, 0, w, h); const fan = (cx, cy, r, rot, col) => { x.save(); x.translate(cx, cy); x.rotate(rot); x.fillStyle = col; for (const [a, l] of [[0, 1], [-0.42, 0.85], [0.42, 0.85], [-0.85, 0.62], [0.85, 0.62], [-1.25, 0.38], [1.25, 0.38]]) { x.save(); x.rotate(a); x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(r * 0.16 * l, -r * 0.55 * l, 0, -r * l); x.quadraticCurveTo(-r * 0.16 * l, -r * 0.55 * l, 0, 0); x.fill(); x.restore(); } x.restore(); };
      x.strokeStyle = '#4d6b2a'; x.lineWidth = 6; x.beginPath(); x.moveTo(w / 2, h); x.lineTo(w / 2, 40); x.stroke();
      const greens = ['#2f5d1e', '#3d7426', '#4b8a2e', '#5aa035']; for (let i = 0; i < 26; i++) { const t = i / 26, y = h - 30 - t * (h - 70), side = i % 2 ? 1 : -1, r = 70 * (1 - t * 0.55); fan(w / 2 + side * r * 0.35, y, r, side * (0.9 - t * 0.5), greens[i % 4]); }
      x.fillStyle = '#7aa83f'; for (let i = 0; i < 9; i++) { x.beginPath(); x.ellipse(w / 2 + (i % 3 - 1) * 9, 40 + i * 9, 10, 14, 0, 0, TAU); x.fill(); } });
    this.hemp = { I: instanced(card(hempT, 0.8, false), 220, new THREE.Matrix4().makeScale(1.7, 1.7, 1.7), S, false, true), n: 0 };
    addScen('pole', pole, 8, 'y', 10, 44, null, [1, 1]);
    // distant hills + tree line: one textured ring around the camera (cheap depth on the horizon)
    const hills = tex(1024, 256, (x, w, h) => { x.clearRect(0, 0, w, h); const layer = (col, base, amp, f, ph) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, h); for (let i = 0; i <= w; i += 4) x.lineTo(i, base - amp * (0.6 * Math.sin(i / w * TAU * f + ph) + 0.4 * Math.sin(i / w * TAU * f * 2.7 + ph * 2))); x.lineTo(w, h); x.fill(); };
      layer('#9fb0c4', 120, 60, 3, 0.4); layer('#7d9479', 168, 34, 5, 1.7); x.fillStyle = '#5d7448'; for (let i = 0; i < w; i += 3) { const t = 200 - 10 * Math.sin(i * 0.37) - 8 * Math.sin(i * 0.11); x.fillRect(i, t, 3, h - t); } });
    hills.wrapS = THREE.RepeatWrapping; hills.repeat.set(3, 1);
    this.hills = new THREE.Mesh(new THREE.CylinderGeometry(460, 460, 70, 48, 1, true), new THREE.MeshBasicMaterial({ map: hills, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false })); S.add(this.hills);
    // hazards
    const cone = new THREE.Group(); { const o = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 16), new THREE.MeshStandardMaterial({ color: '#ff6a13', roughness: 0.55 })); o.position.y = 0.4; const b = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.14, 16), new THREE.MeshStandardMaterial({ color: '#f5f5f5', roughness: 0.4 })); b.position.y = 0.42; const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.62), new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.8 })); base.position.y = 0.025; cone.add(o, b, base); }
    const barrel = new THREE.Group(); { const t = tex(64, 64, (x, w, h) => { for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#f4f4f4' : '#ff6a13'; x.fillRect(0, i * h / 4, w, h / 4); } }); const o = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 18), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 })); o.position.y = 0.5; barrel.add(o); }
    const oil = new THREE.Mesh(new THREE.CircleGeometry(1.7, 24), new THREE.MeshPhysicalMaterial({ color: '#0b0b10', roughness: 0.08, metalness: 0.2, clearcoat: 1, transparent: true, opacity: 0.88, polygonOffset: true, polygonOffsetFactor: -3 })); oil.rotation.x = -Math.PI / 2; oil.position.y = 0.02;
    const nitro = new THREE.Group(); { const o = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.95, 16), new THREE.MeshStandardMaterial({ color: '#0ea5e9', emissive: '#22d3ee', emissiveIntensity: 0.9, metalness: 0.6, roughness: 0.25 })); o.position.y = 1.0; const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#67e8f9', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); h.scale.set(2.6, 2.6, 1); h.position.y = 1.0; nitro.add(o, h); }
    this.proto = { cone, barrel, oil, nitro }; this.hz3 = new THREE.Group(); S.add(this.hz3);
    // ---- roadside props: billboards (subtle hub / cannabis branding), farm buildings, a dispensary, chicane chevrons ----
    const leaf = (x, cx, cy, r, col) => { x.save(); x.translate(cx, cy); x.fillStyle = col; for (const [a, l] of [[0, 1], [-0.55, 0.82], [0.55, 0.82], [-1.1, 0.6], [1.1, 0.6], [-1.6, 0.36], [1.6, 0.36]]) { x.save(); x.rotate(a); x.beginPath(); x.ellipse(0, -r * l * 0.5, r * 0.12 * l + 2, r * l * 0.5, 0, 0, TAU); x.fill(); x.restore(); } x.fillRect(-r * 0.03, 0, r * 0.06, r * 0.32); x.restore(); };
    const font = (w, px) => `${w} ${px}px Orbitron, "Exo 2", system-ui, sans-serif`;
    const BB = [
      (x, w, h) => { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#0b1030'); g.addColorStop(1, '#2b1460'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = font(900, 92); x.fillText('THE GAMING HUB', 54, 190); x.fillStyle = '#c4b5fd'; x.font = font(700, 40); x.fillText('PLAY  ·  COMPETE  ·  WIN PRIZES', 58, 262); x.fillStyle = '#94a3b8'; x.font = font(600, 30); x.fillText('by Trap Tech Solutions', 58, 330); leaf(x, w - 110, 330, 80, '#4ade80'); },
      (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#14532d'); g.addColorStop(1, '#052e16'); x.fillStyle = g; x.fillRect(0, 0, w, h); leaf(x, 150, 250, 120, '#86efac'); x.fillStyle = '#f0fdf4'; x.font = font(900, 64); x.fillText('ROLLING HILLS', 300, 150); x.fillText('DISPENSARY', 300, 226); x.fillStyle = '#bbf7d0'; x.font = font(700, 36); x.fillText('NEXT EXIT  ·  21+ ONLY', 302, 290); x.fillStyle = '#052e16'; x.fillRect(0, h - 70, w, 70); x.fillStyle = '#fde68a'; x.font = font(700, 30); x.fillText('NEVER DRIVE IMPAIRED', 302, h - 24); },
      (x, w, h) => { x.fillStyle = '#f6efe0'; x.fillRect(0, 0, w, h); x.fillStyle = '#3f2a14'; x.font = font(900, 104); x.fillText('TERP TAVERN', 60, 200); x.fillStyle = '#7c5a2f'; x.font = font(700, 38); x.fillText('Good company. Elevated games.', 64, 280); leaf(x, w - 120, 300, 74, '#3f7d3a'); x.fillStyle = '#3f2a14'; x.fillRect(0, h - 22, w, 22); },
      (x, w, h) => { x.fillStyle = '#0a0a0c'; x.fillRect(0, 0, w, h); x.fillStyle = '#fb923c'; x.font = font(900, 110); x.fillText('DRIFT RUSH', 56, 200); x.fillStyle = '#fff'; x.font = font(700, 40); x.fillText('Bank every drift. Win weekly prizes.', 60, 280); x.fillStyle = '#fb923c'; x.fillRect(60, 320, 300, 10); }];
    const bbMats = BB.map(f => new THREE.MeshStandardMaterial({ map: tex(1024, 440, f), roughness: 0.55, emissive: '#ffffff', emissiveIntensity: 0.08 }));
    const steel = new THREE.MeshStandardMaterial({ color: '#7c838c', metalness: 0.7, roughness: 0.4 }), board = new THREE.PlaneGeometry(9.2, 3.95), post = new THREE.CylinderGeometry(0.14, 0.14, 6.2, 8), frame = new THREE.BoxGeometry(9.5, 4.25, 0.25);
    this.mkBillboard = (i) => { const g = new THREE.Group(); const f = new THREE.Mesh(frame, steel); f.position.y = 6.1; const b = new THREE.Mesh(board, bbMats[i % bbMats.length]); b.position.set(0, 6.1, 0.14); for (const px of [-2.8, 2.8]) { const pp = new THREE.Mesh(post, steel); pp.position.set(px, 2.9, -0.05); g.add(pp); } g.add(f, b); g.traverse(m => { if (m.isMesh) m.castShadow = true; }); return g; };
    const red = new THREE.MeshStandardMaterial({ color: '#8f2a22', roughness: 0.85 }), cream = new THREE.MeshStandardMaterial({ color: '#e7dcc4', roughness: 0.85 }), roofM = new THREE.MeshStandardMaterial({ color: '#3a3d42', roughness: 0.7, metalness: 0.2 }), white = new THREE.MeshStandardMaterial({ color: '#f1efe9', roughness: 0.8 }), silo = new THREE.MeshStandardMaterial({ color: '#b8bcc2', metalness: 0.6, roughness: 0.35 });
    const gable = (w, h, depth) => { const sh = new THREE.Shape(); sh.moveTo(-w / 2 - 0.4, 0); sh.lineTo(0, h); sh.lineTo(w / 2 + 0.4, 0); sh.lineTo(-w / 2 - 0.4, 0); const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2); return g; };
    const winT = tex(128, 64, (x, w, h) => { x.fillStyle = '#e7dcc4'; x.fillRect(0, 0, w, h); for (let i = 0; i < 3; i++) { x.fillStyle = '#f7f4ec'; x.fillRect(10 + i * 40, 14, 30, 34); x.fillStyle = '#41525f'; x.fillRect(13 + i * 40, 17, 24, 28); } }, true);
    this.mkBuilding = (kind) => { const g = new THREE.Group();
      if (kind === 0) { const b = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 15), red); b.position.y = 3; const r = new THREE.Mesh(gable(10, 4.2, 15.6), roofM); r.position.y = 6; const d = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.2), white); d.position.set(0, 2.1, 7.52); const s = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 13, 16), silo); s.position.set(7.5, 6.5, -2); const sd = new THREE.Mesh(new THREE.SphereGeometry(1.9, 16, 8, 0, TAU, 0, Math.PI / 2), silo); sd.position.set(7.5, 13, -2); g.add(b, r, d, s, sd); }
      else { const m = cream.clone(); m.map = winT; winT.repeat.set(2, 1); const b = new THREE.Mesh(new THREE.BoxGeometry(11, 5, 8), m); b.position.y = 2.5; const r = new THREE.Mesh(gable(8, 3, 11.6), roofM); r.rotation.y = Math.PI / 2; r.position.y = 5; const p2 = new THREE.Mesh(new THREE.BoxGeometry(3, 0.25, 8.6), white); p2.position.set(0, 2.6, 0.4); g.add(b, r); }
      g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; };
    const dispT = tex(512, 128, (x, w, h) => { x.fillStyle = '#0f172a'; x.fillRect(0, 0, w, h); x.fillStyle = '#22c55e'; x.fillRect(28, 34, 60, 20); x.fillRect(48, 14, 20, 60); x.fillStyle = '#ecfdf5'; x.font = font(900, 54); x.fillText('DISPENSARY', 116, 84); leaf(x, w - 50, 84, 40, '#4ade80'); });
    this.mkDispensary = () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(16, 4.6, 10), new THREE.MeshStandardMaterial({ color: '#3b4148', roughness: 0.7 })); b.position.y = 2.3;
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.6), new THREE.MeshPhysicalMaterial({ color: '#1f3b2c', roughness: 0.05, metalness: 0.2, clearcoat: 1, emissive: '#14532d', emissiveIntensity: 0.35 })); gl.position.set(-1.5, 1.6, 5.02);
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshStandardMaterial({ map: dispT, emissive: '#ffffff', emissiveMap: dispT, emissiveIntensity: 0.6 })); sg.position.set(0, 3.75, 5.03);
      const lot = new THREE.Mesh(new THREE.PlaneGeometry(22, 12), new THREE.MeshStandardMaterial({ color: '#2b2d31', roughness: 0.95 })); lot.rotation.x = -Math.PI / 2; lot.position.set(0, 0.02, 11);
      g.add(b, gl, sg, lot); g.traverse(o => { if (o.isMesh) { o.castShadow = o !== lot; o.receiveShadow = true; } }); return g; };
    const chevT = tex(128, 96, (x, w, h) => { x.fillStyle = '#facc15'; x.fillRect(0, 0, w, h); x.fillStyle = '#111'; for (const ox of [18, 62]) { x.beginPath(); x.moveTo(ox, 14); x.lineTo(ox + 28, 48); x.lineTo(ox, 82); x.lineTo(ox + 16, 82); x.lineTo(ox + 44, 48); x.lineTo(ox + 16, 14); x.fill(); } x.strokeStyle = '#111'; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h - 6); });
    const chevM = new THREE.MeshStandardMaterial({ map: chevT, roughness: 0.5, emissive: '#ffffff', emissiveMap: chevT, emissiveIntensity: 0.15, side: THREE.DoubleSide }), chevP = new THREE.PlaneGeometry(1.3, 0.98), chevPost = new THREE.CylinderGeometry(0.05, 0.05, 1.4, 6);
    this.mkChevron = (dir) => { const g = new THREE.Group(); const pl = new THREE.Mesh(chevP, chevM); pl.position.y = 1.85; pl.scale.x = dir; const pp = new THREE.Mesh(chevPost, steel); pp.position.y = 0.7; g.add(pl, pp); return g; };
    this.props = new Map(); this.props3 = new THREE.Group(); S.add(this.props3);
    // skid marks (instanced quads on the road) + tyre smoke sprites
    this.skid = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.7).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#141414', transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }), 360);
    this.skid.frustumCulled = false; const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < 360; i++) this.skid.setMatrixAt(i, z); this.skidN = 0; S.add(this.skid);
    const puff = tex(64, 64, (x, w) => { const g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(235,235,235,.9)'); g.addColorStop(1, 'rgba(235,235,235,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
    this.smoke = []; for (let i = 0; i < 70; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; S.add(s); this.smoke.push({ s, life: 0 }); }
    this.smokeI = 0; this.tmpM = new THREE.Matrix4(); this.tmpQ = new THREE.Quaternion(); this.tmpV = new THREE.Vector3(); this.tmpS = new THREE.Vector3(); this.tmpC = new THREE.Color();
    this.camPos = new THREE.Vector3(0, 3, 8); this.camLook = new THREE.Vector3(0, 1, -14); this.ready3 = true; if (!this.opt) this.opt = { pov: 'chase', detail: 'balanced', fx: 'on' }; this.applyDetail(); this.sync3(0);
  }
  destroy() { super.destroy(); try { this.R3 && this.R3.dispose(); this.R3 && this.R3.forceContextLoss(); } catch {} if (this.gl) this.gl.remove(); this.ready3 = false; }

  // ---------- game state ----------
  layout() {}
  reset() {
    super.reset(); this.score = 0; this.coins = 0; this.D = 0; this.meters = 0; this.x = curve(0); this.th = 0; this.ph = 0; this.v = 16; this.hearts = 3; this.inv = 0;
    this.banked = 0; this.pending = 0; this.chain = 0; this.calm = 0; this.lastBank = 0; this.slick = 0; this.nitro = 0; this.steer = 0; this.keyL = 0; this.keyR = 0; this.ptrX = null; this.flash = 0;
    this.cars = []; this.hz = []; this.nextCar = 60; this.nextHz = 160; this.nextCp = 1500; this.nextM = 250; this.drifting = false; this.knocked = [];
    if (this.hz3) { this.hz3.clear(); for (const s of this.scen) { s.items = []; s.next = -BEHIND; } for (let i = 0; i < 360; i++) this.skid.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); this.skid.instanceMatrix.needsUpdate = true; }
  }
  onDown(x) { this.ptrX = x; } onMove(x) { if (this.ptrX != null) this.ptrX = x; } onUp() { this.ptrX = null; }
  onKey(c, d) { if (c === 'ArrowLeft' || c === 'KeyA') this.keyL = d ? 1 : 0; if (c === 'ArrowRight' || c === 'KeyD') this.keyR = d ? 1 : 0; }
  mult() { return 1 + Math.min(2, Math.floor(this.chain)); }
  bank(force) { // move pending points into the score, never faster than the server's drift-rate bound
    const allow = Math.floor(95 * (this.playT - this.lastBank) + 8), p = Math.min(Math.floor(this.pending), allow); if (p <= 0) return 0;
    this.banked += p; this.pending -= p; this.lastBank = this.playT; this.mark('d', p); if (!force) this.chain = Math.min(4, this.chain + 1); return p;
  }
  hurt(why) {
    if (this.inv > 0) return; this.hearts--; this.inv = 1.6; this.pending = 0; this.chain = 0; this.v *= 0.55; this.flash = 0.35; this.fx.shake(14); this.hitstop(0.07);
    this.sfx.noise(0.3, { vol: 0.45, freq: 450 }); const [sx, sy] = this.screen(this.x, 0.8, this.D); this.fx.burst(sx, sy, ['#fff', '#fb923c', '#fde047'], 22, 380, 0.6, 12); this.pop(sx, sy - 70, why, '#f87171', 24);
    if (this.hearts <= 0) { this.score = Math.floor(this.meters + this.banked); this.mark('m', Math.floor(this.meters)); this.kill(1.1, '#f97316'); }
  }
  spawnCar() { // traffic: one-way, slower than the player; never closes every lane at once
    const d = this.nextCar, m = this.meters; const near = this.cars.filter(c => Math.abs(c.d - d) < 16).map(c => c.lane);
    let lane = Math.floor(this.r() * LANES); for (let k = 0; k < LANES && near.includes(lane); k++) lane = (lane + 1) % LANES;
    const t = Math.floor(this.r() * this.traffic3.length), speed = 12 + this.r() * 9 + Math.min(8, m / 900), change = this.r() < 0.28 ? d + 40 + this.r() * 90 : Infinity, dir = this.r() < 0.5 ? -1 : 1, paint = Math.floor(this.r() * PAINTS.length);
    if (near.length < LANES - 1) this.cars.push({ d, lane, lx: lane, speed, t, change, to: clamp(lane + dir, 0, LANES - 1), paint, rel: Infinity, slot: -1 });
    this.nextCar = d + Math.max(16, 55 - m / 90) + this.r() * 34;
  }
  spawnHz() {
    const d = this.nextHz, m = this.meters, roll = this.r(), lane = Math.floor(this.r() * LANES), side = this.r();
    if (roll < 0.34) { for (let i = 0; i < 4; i++) this.hz.push({ k: 'cone', d: d + i * 3.2, lat: (half(d) * 2 / LANES) * (lane + 0.15 + i * 0.22) - half(d), r: 0.4 }); }
    else if (roll < 0.52) this.hz.push({ k: 'barrel', d, lat: (half(d) * 2 / LANES) * (lane + 0.5) - half(d), r: 0.5 });
    else if (roll < 0.72 && m > 120) this.hz.push({ k: 'oil', d, lat: (half(d) * 2 / LANES) * (lane + 0.5) - half(d), r: 1.6 });
    else this.hz.push({ k: 'nitro', d, lat: (half(d) * 2 / LANES) * (lane + 0.5) - half(d), r: 1.1 });
    this.nextHz = d + Math.max(70, 150 - m / 40) + side * 80;
  }
  update(dt) {
    const D0 = this.D, T = this.playT;
    // analog touch: the further from the centre you hold, the harder you steer (small dead zone in the middle)
    let s = 0; if (this.ptrX != null) { const a = (this.ptrX - this.W / 2) / (this.W * 0.3); s = Math.sign(a) * clamp((Math.abs(a) - 0.08) / 0.92, 0.35, 1); } if (this.keyL || this.keyR) s = this.keyR - this.keyL;
    if (this.slick > 0) { this.slick -= dt; s = -s * 0.8 + Math.sin(T * 14) * 0.4; } this.steer = lerp(this.steer, s, Math.min(1, dt * 9));
    const tang = Math.atan2(curve(D0 + 3) - curve(D0), 3);
    const rate = 3.1 * (1.12 - Math.min(0.42, this.v / 140)); // calmer steering at speed
    if (s) this.th = clamp(this.th + this.steer * rate * dt, tang - 1.15, tang + 1.15); else this.th += (tang - this.th) * Math.min(1, dt * 3.2);
    const onRoad = Math.abs(this.x - curve(D0)) < half(D0) - 0.4; const catchSlide = s && Math.sign(s) !== Math.sign(this.th - this.ph) && Math.abs(this.th - this.ph) > 0.15 ? 1.7 : 1; this.offRoad = !onRoad; const grip = (onRoad ? 4.8 : 7) * (this.slick > 0 ? 0.35 : 1) * catchSlide; this.ph += (this.th - this.ph) * Math.min(1, dt * grip); const slip = this.th - this.ph;
    const target = 16 + Math.min(34, T * 0.19) + (this.nitro > 0 ? 9 : 0); this.v += (target - this.v) * Math.min(1, dt * 0.8) - (Math.abs(slip) > 0.3 ? this.v * 0.05 * dt : 0);
    if (!onRoad) this.v = Math.max(12, this.v * (1 - 1.1 * dt)); if (this.nitro > 0) this.nitro -= dt; this.v = Math.min(this.v, 62);
    this.x += this.v * Math.sin(this.ph) * dt; this.D += this.v * Math.cos(this.ph) * dt; this.meters = this.D;
    if (this.inv > 0) this.inv -= dt; if (this.flash > 0) this.flash -= dt;
    // drift: accrual <= 30/s per multiplier step; banked when the car straightens up
    this.drifting = onRoad && Math.abs(slip) > 0.2 && this.v > 14;
    if (this.drifting) { this.pending += Math.min(30, 60 * Math.abs(slip) * (this.v / 30)) * this.mult() * dt; this.calm = 0; this.setLevel(0.5 + Math.min(0.5, this.pending / 400)); }
    else if (this.pending >= 1) { this.calm += dt; if (this.calm > 0.35) { const p = this.bank(); if (p) { const [sx, sy] = this.screen(this.x, 1, this.D); this.pop(sx, sy - 80, `+${fmt(p)}`, '#34d399', 24); this.sfx.chord([523, 659, 784], 0.12, { type: 'triangle', vol: 0.14 }); } } }
    else { this.calm += dt; if (this.calm > 3.5) this.chain = 0; }
    // world spawning (seeded, in distance order)
    while (this.nextCar < this.D + AHEAD - 20) this.spawnCar(); while (this.nextHz < this.D + AHEAD - 20) this.spawnHz();
    // traffic
    for (const c of this.cars) {
      if (c.knock) { c.knock.t += dt; c.d += c.speed * dt * 0.6; c.knock.x += c.knock.vx * dt; c.knock.rot += c.knock.vr * dt; continue; }
      c.d += c.speed * dt; if (c.d > c.change) { c.lx += Math.sign(c.to - c.lx) * dt * 0.6; if (Math.abs(c.lx - c.to) < 0.02) { c.lx = c.to; c.lane = c.to; c.change = Infinity; } }
      const cx = curve(c.d) - half(c.d) + (half(c.d) * 2 / LANES) * (c.lx + 0.5), rel = c.d - this.D, dx = Math.abs(cx - this.x); c.x = cx;
      if (Math.abs(rel) < 4.3 && dx < 1.75 && this.inv <= 0) { c.knock = { t: 0, x: 0, vx: Math.sign(cx - this.x || 1) * 6, rot: 0, vr: (cx > this.x ? 1 : -1) * 4 }; this.hurt('CRASH'); continue; }
      if (c.rel > 0 && rel <= 0 && dx < 3.1 && this.inv <= 0) { // near miss
        const pts = Math.round(40 * this.mult()); this.pending += pts; this.chain = Math.min(4, this.chain + 0.5); this.calm = 0;
        const [sx, sy] = this.screen(this.x, 1, this.D); this.pop(sx, sy - 110, `NEAR MISS +${pts}`, '#facc15', 20); this.sfx.tone(1180, 0.08, { type: 'square', vol: 0.08, slide: 1.4 }); }
      c.rel = rel;
    }
    this.cars = this.cars.filter(c => c.d > this.D - BEHIND && (!c.knock || c.knock.t < 2.5));
    // hazards and pickups
    for (const h of this.hz) { if (h.gone) continue; const rel = h.d - this.D; if (Math.abs(rel) > 3) continue; const hx = curve(h.d) + h.lat, dx = Math.abs(hx - this.x);
      if (h.k === 'nitro') { if (dx < h.r && Math.abs(rel) < 2) { h.gone = true; this.nitro = 3; this.coins++; const [sx, sy] = this.screen(this.x, 1, this.D); this.pop(sx, sy - 90, 'NITRO', '#22d3ee', 22); this.sfx.chord([660, 990], 0.12, { type: 'square', vol: 0.1 }); } }
      else if (h.k === 'oil') { if (dx < h.r && Math.abs(rel) < 1.6 && this.slick <= 0) { this.slick = 1.1; const [sx, sy] = this.screen(this.x, 1, this.D); this.pop(sx, sy - 90, 'OIL!', '#a78bfa', 20); } }
      else if (dx < h.r + 0.9 && Math.abs(rel) < 2.3) { h.gone = true; this.hurt(h.k === 'cone' ? 'ROADWORKS' : 'BARREL'); } }
    this.hz = this.hz.filter(h => h.d > this.D - BEHIND);
    if (this.meters >= this.nextCp) { this.nextCp += 1500; const heal = this.hearts < 3; if (heal) this.hearts++; this.pop(this.W / 2, this.H * 0.3, heal ? 'CHECKPOINT  +1 HEART' : 'CHECKPOINT', '#fde047', 24); this.sfx.chord([523, 784, 1047], 0.16, { type: 'triangle', vol: 0.14 }); }
    this.score = Math.floor(this.meters + this.banked); if (this.meters >= this.nextM) { this.nextM += 250; this.mark('m', Math.floor(this.meters)); }
  }
  dyingUpdate(dt) { this.v *= 1 - dt * 2; this.D += this.v * dt; }

  // ---------- 3D sync + render ----------
  screen(x, y, d) { // world point -> logical 2D overlay coordinates
    if (!this.cam) return [this.W / 2, this.H * 0.7]; const v = this.tmpV.set(x, y, -d).project(this.cam); const r = this.c.getBoundingClientRect(), k = this.c.width / Math.max(1, r.width);
    return [(((v.x + 1) / 2) * r.width * k - this.ox) / this.scale, (((1 - v.y) / 2) * r.height * k - this.oy) / this.scale];
  }
  sync3(dt) {
    const D = this.D, cam = this.cam, P = this.player, M = this.tmpM, Q = this.tmpQ, V = this.tmpV, Sc = this.tmpS;
    // player car: yaw follows the body heading, roll/pitch from slip and acceleration
    const slip = this.th - this.ph; P.position.set(this.x, 0, -D); P.rotation.set(0, -this.th, 0); P.children[0] && (P.children[0].rotation.z = clamp(slip, -0.35, 0.35) * 0.18);
    P.visible = !(this.inv > 0 && ((this.t * 14) | 0) % 2);
    for (const w of this.wheels) { w.spin.rotation.x -= (this.v * dt) / w.r; if (w.front) w.hub.rotation.y = -clamp(this.steer * 0.42 + (this.th - this.ph) * 0.6, -0.5, 0.5); }
    const braking = this.v < (this._lastV || 0) - 0.4 * dt * 60 * 0.016 || this.drifting || this.slick > 0; this._lastV = this.v; for (const t of this.tails) t.material.opacity = lerp(t.material.opacity, braking ? 1 : 0.45, Math.min(1, dt * 10)); this.flames.visible = this.nitro > 0; if (this.nitro > 0) this.flames.children.forEach((f, i) => f.scale.set(1, 0.8 + Math.random() * 0.5, 1));
    // traffic -> instanced pools (slot per visible car)
    for (const t of this.traffic3) t.used = 0;
    for (const c of this.cars) { const T = this.traffic3[c.t]; if (!T || T.used >= 8) continue; const i = T.used++; const k = c.knock;
      const yaw = Math.atan2(curve(c.d + 3) - curve(c.d), 3); Q.setFromEuler(new THREE.Euler(0, -yaw + (k ? k.rot : 0), 0)); M.compose(V.set(c.x + (k ? k.x : 0), 0, -c.d), Q, Sc.set(1, 1, 1)); T.I.set(i, M); T.I.color(i, this.tmpC.set(PAINTS[c.paint])); }
    for (const t of this.traffic3) { t.I.use(t.used); t.I.flush(); } // draw only the occupied slots
    // hazards (plain meshes, few at a time)
    const live = new Set(); for (const h of this.hz) { if (h.gone) continue; if (!h.o) { h.o = this.proto[h.k].clone(); h.o.traverse(m => { if (m.isMesh) m.castShadow = true; }); h.o.position.set(curve(h.d) + h.lat, h.k === 'oil' ? 0.02 : 0, -h.d); this.hz3.add(h.o); } if (h.k === 'nitro') h.o.rotation.y = this.t * 2; live.add(h.o); }
    for (const o of [...this.hz3.children]) if (!live.has(o)) this.hz3.remove(o);
    // scenery pools
    const vr = this.vr;
    for (const s of this.scen) {
      s.items = s.items.filter(it => it.d > D - BEHIND);
      const cap = Math.max(2, Math.round(s.count * (this.density || 1))); while (s.items.length < cap && s.next < D + AHEAD) { const d = s.next; s.next += s.spacing * (0.6 + vr() * 0.8); const side = s.lat ? (vr() < 0.5 ? -1 : 1) : ((Math.round(d / s.spacing) % 2) ? 1 : -1);
        const off = s.lat ? half(d) + 0.6 + s.lat[0] + vr() * (s.lat[1] - s.lat[0]) : half(d) + 1.4; s.items.push({ d, x: curve(d) + side * off, yaw: s.lat ? vr() * TAU : (side > 0 ? Math.PI / 2 : -Math.PI / 2), sc: s.scl[0] + vr() * (s.scl[1] - s.scl[0]) }); }
      let i = 0; for (const it of s.items) { Q.setFromAxisAngle(V.set(0, 1, 0), it.yaw); M.compose(this.tmpS.set(it.x, 0, -it.d), Q, new THREE.Vector3(it.sc, it.sc, it.sc)); s.I.set(i++, M); } s.I.use(i); s.I.flush();
    }
    // hemp fields: 90 m long, 5 rows, every 1.4 km on alternating sides
    { let n = 0; const H = this.hemp; if (H) { for (let k = Math.max(0, Math.floor((D - BEHIND - 690) / 1400)); 600 + k * 1400 < D + AHEAD && n < 220; k++) { const d0 = 600 + k * 1400, side = k % 2 ? 1 : -1;
        for (let dd = 0; dd < 90 && n < 220; dd += 2.4) { const d = d0 + dd; if (d < D - BEHIND || d > D + AHEAD) continue; for (let r = 0; r < 5 && n < 220; r++) { const j = frac(Math.sin(d * 12.9 + r * 7.7) * 4375.5);
          Q.setFromAxisAngle(V.set(0, 1, 0), j * TAU); const sc = 0.8 + j * 0.45; M.compose(this.tmpS.set(curve(d) + side * (half(d) + 9 + r * 2.6 + j * 0.6), 0, -d), Q, new THREE.Vector3(sc, sc, sc)); H.I.set(n++, M); } } }
      H.I.use(n); H.I.flush(); } }
    // props: placed from fixed formulas of the distance index, so the route looks the same on every run
    const want = new Map(), lo = D - BEHIND, hi = D + AHEAD, hsh = (k, j) => frac(Math.sin(k * 91.7 + j * 47.3) * 24634.6345);
    for (let k = Math.max(0, Math.floor((lo - 300) / 380)); 300 + k * 380 < hi; k++) { const d = 300 + k * 380, side = k % 2 ? 1 : -1; want.set('b' + k, () => { const o = this.mkBillboard(k); o.position.set(curve(d) + side * (half(d) + 7), 0, -d); o.rotation.y = -side * 0.35; return o; }); }
    if (this.density > 0.5) for (let k = Math.max(0, Math.floor((lo - 120) / 170)); 120 + k * 170 < hi; k++) { const d = 120 + k * 170 + hsh(k, 1) * 60, side = hsh(k, 2) < 0.5 ? -1 : 1, lat = half(d) + 24 + hsh(k, 3) * 40; want.set('h' + k, () => { const o = this.mkBuilding(hsh(k, 4) < 0.45 ? 0 : 1); o.position.set(curve(d) + side * lat, 0, -d); o.rotation.y = side * (Math.PI / 2) + (hsh(k, 5) - 0.5) * 0.5; return o; }); }
    for (let k = Math.max(0, Math.floor((lo - 900) / 1600)); 900 + k * 1600 < hi; k++) { const d = 900 + k * 1600, side = k % 2 ? -1 : 1; want.set('s' + k, () => { const o = this.mkDispensary(); o.position.set(curve(d) + side * (half(d) + 20), 0, -d); o.rotation.y = -side * Math.PI / 2; return o; }); }
    for (let k = Math.max(0, Math.floor((lo - 1300) / 1150)); ; k++) { const c = chicane(k); if (c.start > hi) break; if (c.start + CH_L < lo) continue; const sA = Math.sign(c.A);
      [[0.1, -sA, sA], [0.2, -sA, sA], [0.3, -sA, sA], [0.6, sA, -sA], [0.7, sA, -sA], [0.8, sA, -sA]].forEach(([u, side, dir], j) => { const d = c.start + u * CH_L; want.set('c' + k + '_' + j, () => { const o = this.mkChevron(dir); o.position.set(curve(d) + side * (half(d) + 1.4), 0, -d); o.rotation.y = Math.atan2(curve(d) - curve(d + 3), 3); return o; }); }); }
    for (const [key, o] of this.props) if (!want.has(key)) { this.props3.remove(o); this.props.delete(key); }
    for (const [key, mk] of want) if (!this.props.has(key)) { const o = mk(); this.props.set(key, o); this.props3.add(o); }
    for (const r of this.ribbons) r.update(D);
    this.ground.position.set(this.x, -0.04, -D); this.grassT.offset.set(this.x / 15, D / 15);
    // skids + smoke
    if (this.offRoad && this.state === 'play' && this.v > 8) for (const sx of [-0.8, 0.8]) { const p = this.smoke[this.smokeI++ % this.smoke.length]; p.life = 0.9; p.s.visible = true; p.s.material.color.set('#b59a72'); p.s.position.set(this.x + Math.cos(this.th) * sx - Math.sin(this.th) * 1.4, 0.35, -D + Math.cos(this.th) * 1.4); p.s.scale.set(0.8, 0.8, 1); }
    if (this.drifting && this.state === 'play') { for (const sx of [-0.78, 0.78]) { const wx = this.x + Math.cos(this.th) * sx - Math.sin(this.th) * 1.3, wz = -D + Math.sin(this.th) * sx + Math.cos(this.th) * 1.3;
        Q.setFromAxisAngle(V.set(0, 1, 0), -this.th); M.compose(this.tmpS.set(wx, 0.015, wz), Q, new THREE.Vector3(1, 1, 1)); this.skid.setMatrixAt(this.skidN++ % 360, M);
        const p = this.smoke[this.smokeI++ % this.smoke.length]; p.life = 0.9; p.s.visible = true; p.s.material.color.set('#e5e7eb'); p.s.position.set(wx, 0.4, wz); p.s.scale.set(0.8, 0.8, 1); }
      this.skid.instanceMatrix.needsUpdate = true; }
    for (const p of this.smoke) { if (p.life <= 0) continue; p.life -= dt; p.s.position.y += dt * 0.9; const k = 1 - p.life / 0.9; p.s.scale.setScalar(0.8 + k * 3.2); p.s.material.opacity = Math.max(0, 0.5 * (1 - k)); if (p.life <= 0) p.s.visible = false; }
    // camera: player-selectable view (Settings > Camera view); chase views follow the velocity, cockpit views the body
    const pov = (this.opt && this.opt.pov) || 'chase', ready = this.state === 'ready', fxOn = !this.opt || this.opt.fx !== 'off';
    const a = this._camInit ? Math.min(1, dt * 6) : 1, al = this._camInit ? Math.min(1, dt * 8) : 1, af = this._camInit ? Math.min(1, dt * 3) : 1; this._camInit = true;
    const fw = (ang, k, y) => V.set(this.x + Math.sin(ang) * k, y, -D - Math.cos(ang) * k);
    let fov = 60 + this.v * 0.28 + (this.nitro > 0 ? 7 : 0), body = true;
    if (ready) { const yaw = Math.sin(this.t * 0.25) * 0.6; this.camPos.lerp(fw(yaw, -8, 3.4), a); this.camLook.lerp(fw(0, 6, 0.8), al); }
    else if (pov === 'far') { this.camPos.lerp(fw(this.ph, -(11 + this.v * 0.05), 5.4 + this.v * 0.02), a); this.camLook.lerp(fw(this.ph, 24, 0.4), al); }
    else if (pov === 'hood') { this.camPos.copy(fw(this.th, -0.1, 1.3)); this.camLook.copy(fw(this.th, 26, 0.15)); fov = 64 + this.v * 0.2; }
    else if (pov === 'bumper') { this.camPos.copy(fw(this.th, 2.25, 0.62)); this.camLook.copy(fw(this.th, 30, 0.6)); fov = 66 + this.v * 0.22; body = false; }
    else if (pov === 'top') { this.camPos.lerp(fw(this.ph, -7, 24), a); this.camLook.lerp(fw(this.ph, 9, 0), al); fov = 48; }
    else { this.camPos.lerp(fw(this.ph, -(7.4 + this.v * 0.04), 3.7 + this.v * 0.015), a); this.camLook.lerp(fw(this.ph, 18, 0.4), al); }
    if (!body) P.visible = false;
    const sh = fxOn ? this.fx.shakeM * 0.02 : 0; cam.position.set(this.camPos.x + (Math.random() - 0.5) * sh, this.camPos.y + (Math.random() - 0.5) * sh, this.camPos.z); cam.lookAt(this.camLook);
    cam.fov = lerp(cam.fov, fxOn ? fov : 62, af); cam.updateProjectionMatrix();
    this.sky.position.copy(cam.position); this.hills.position.set(cam.position.x, 18, cam.position.z); this.sun.position.set(cam.position.x + 150, 48, cam.position.z - 420);
    this.light.position.set(this.x + 30, 45, -D - 10); this.light.target.position.set(this.x, 0, -D - 12);
  }
  frame(dt) { this._dt = dt; super.frame(dt); }
  draw() {
    if (this.ready3) {
      const r = this.c.getBoundingClientRect(); if (r.width !== this._rw || r.height !== this._rh) { this._rw = r.width; this._rh = r.height; this.R3.setSize(r.width, r.height, false); this.cam.aspect = r.width / Math.max(1, r.height); }
      if (this.frameMsP95 > 26 && this.pr > 1 && this.t > 4) { this.pr = 1; this.R3.setPixelRatio(1); this._rw = 0; } // sustained slow frames: drop resolution, never gameplay
      this.sync3(this.state === 'paused' ? 0 : (this._dt || 0)); this.R3.render(this.scene, this.cam);
    }
    const ctx = this.ctx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.c.width, this.c.height);
    if (!this.ready3) { ctx.fillStyle = PAL.bg; ctx.fillRect(0, 0, this.c.width, this.c.height); }
    const sm = this.opt && this.opt.fx === 'off' ? 0 : this.fx.shakeM, sx = sm ? (Math.random() - 0.5) * sm * 0.4 : 0, sy = sm ? (Math.random() - 0.5) * sm * 0.4 : 0;
    ctx.setTransform(this.scale, 0, 0, this.scale, this.ox + sx * this.scale, this.oy + sy * this.scale);
    this.render(ctx); this.fx.draw(ctx);
    for (const p of this.pops) { ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2)); const k = 1 + Math.max(0, p.life - 0.7) * 1.5; this.text(ctx, p.text, p.x, p.y, { size: p.size * k, color: p.color, align: 'center', glow: p.color }); }
    ctx.globalAlpha = 1; if (this.fx.flashA > 0.01) { ctx.globalAlpha = this.fx.flashA; ctx.fillStyle = this.fx.flashC; ctx.fillRect(0, 0, this.W, this.H); ctx.globalAlpha = 1; }
    if (this.state === 'ready') this.center(ctx, this.title, this.hint, 'TAP TO START');
    if (this.state === 'paused') this.center(ctx, 'PAUSED', 'Tap Resume to keep playing');
  }

  // ---------- HUD (2D overlay) ----------
  panel(ctx, x, y, w, h, r = 14) { roundRect(ctx, x, y, w, h, r); ctx.fillStyle = 'rgba(8,10,24,.62)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1; ctx.stroke(); }
  render(ctx) {
    const W = this.W, H = this.H; if (this.state === 'ready') return;
    if (this.flash > 0) { ctx.fillStyle = `rgba(220,38,38,${this.flash * 0.8})`; ctx.fillRect(0, 0, W, H); }
    if (this.nitro > 0 && (!this.opt || this.opt.fx !== 'off')) { ctx.globalAlpha = 0.35; ctx.strokeStyle = '#a5f3fc'; ctx.lineWidth = 2; for (let i = 0; i < 14; i++) { const a = Math.random() * TAU, r0 = 170 + Math.random() * 60; ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * r0 * 1.4, H * 0.55 + Math.sin(a) * r0); ctx.lineTo(W / 2 + Math.cos(a) * (r0 + 90) * 1.4, H * 0.55 + Math.sin(a) * (r0 + 90)); ctx.stroke(); } ctx.globalAlpha = 1; }
    // score + best (left), hearts + multiplier (right)
    this.panel(ctx, 12, 12, 210, 62); this.text(ctx, 'SCORE', 26, 32, { size: 10, color: '#cbd5e1', font: 'Exo' }); this.text(ctx, fmt(this.dispScore), 26, 62, { size: 26, weight: 900, color: '#fff' });
    this.text(ctx, 'BEST ' + fmt(Math.max(this.best || 0, this.score || 0)), 208, 32, { size: 10, color: '#fcd34d', align: 'right', font: 'Exo' });
    this.panel(ctx, W - 152, 12, 140, 62); for (let i = 0; i < 3; i++) this.heart(ctx, W - 130 + i * 24, 34, 9, i < this.hearts);
    const m = this.mult(); roundRect(ctx, W - 140, 48, 116, 20, 10); ctx.fillStyle = m > 1 ? 'rgba(234,179,8,.85)' : 'rgba(100,116,139,.6)'; ctx.fill(); this.text(ctx, `MULTIPLIER x${m}`, W - 82, 63, { size: 11, weight: 900, color: m > 1 ? '#1a1205' : '#e2e8f0', align: 'center' });
    // drift / near-miss bank
    if (this.pending >= 1) { const y = 118; this.panel(ctx, W / 2 - 120, y - 30, 240, 46, 23); this.text(ctx, `${this.drifting ? 'DRIFT' : 'BANKING'}  +${fmt(Math.floor(this.pending))}`, W / 2, y, { size: 20, weight: 900, color: '#fde047', align: 'center', glow: '#f59e0b' });
      if (!this.drifting) { ctx.fillStyle = '#34d399'; ctx.fillRect(W / 2 - 100, y + 8, 200 * Math.min(1, this.calm / 0.35), 3); } }
    // speedometer (bottom)
    const kmh = Math.round(this.v * 3.6), gy = H - 70; this.panel(ctx, W / 2 - 96, gy - 44, 192, 74, 18);
    ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.beginPath(); ctx.arc(W / 2, gy + 14, 52, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    ctx.strokeStyle = this.nitro > 0 ? '#22d3ee' : '#fb923c'; ctx.beginPath(); ctx.arc(W / 2, gy + 14, 52, Math.PI * 1.15, Math.PI * (1.15 + 0.7 * Math.min(1, kmh / 230))); ctx.stroke();
    this.text(ctx, String(kmh), W / 2, gy + 6, { size: 28, weight: 900, color: '#fff', align: 'center' }); this.text(ctx, `KM/H  ·  ${fmt(this.meters)} m`, W / 2, gy + 24, { size: 10, color: '#cbd5e1', align: 'center', font: 'Exo' });
    if (this.state === 'play' && this.playT < 5) { ctx.globalAlpha = 0.5 * Math.min(1, 5 - this.playT); ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(0, H * 0.35, W / 2 - 2, H * 0.45); ctx.fillRect(W / 2 + 2, H * 0.35, W / 2 - 2, H * 0.45);
      this.text(ctx, '◀  HOLD', W * 0.25, H * 0.6, { size: 18, color: '#fff', align: 'center' }); this.text(ctx, 'HOLD  ▶', W * 0.75, H * 0.6, { size: 18, color: '#fff', align: 'center' }); ctx.globalAlpha = 1; }
  }
}
