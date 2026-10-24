// Jetpack Dash v9 - 3D side-scrolling jetpack runner (original code, MIT). Reference gameplay: Jetpack Joyride.
// Hold anywhere to fire the jetpack and rise, let go to fall. Fly through a research lab, dodge zappers (some rotate), homing
// missiles (watch the ! warning) and charging lasers, grab coin trails and shields. Portrait-first: an angled side camera shows
// the corridor far ahead. Render: three.js behind a transparent 2D HUD canvas (same pattern as Drift Rush v9).
// Assets: Quaternius Universal Base Character (CC0, hero.glb); everything else is built in code.
// SCORING (points, v9): every 25 m pays 625 x multiplier ('m'), coin trails pay 25 per coin x multiplier ('c'), a zapper near
// miss pays 250 x multiplier ('n'). The multiplier rises by 1 (to x10) after every 10 distance payouts (250 m) without a hit and
// drops by 3 when a shield breaks ('x' marks). src/ac-levels.js checks every event against these rules.
// Fairness: all gameplay randomness comes from the run seed (this.r) in distance order; visuals use their own RNG.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { Game8, PAL, TAU, clamp, lerp, fmt, roundRect } from './games/kit.js';

const A3 = '/games-lib/assets3d/';
const CH = 9;                 // corridor height (m)
const HERO_H = 1.8;           // hero height (m)
const SEG = 30, NSEG = 7;     // corridor segment length / count (recycled)
const VMAX = 22;              // top speed (m/s); server bound is 25
const MSTEP = 25;             // metres per distance payout
const PAY_M = 625, PAY_C = 25, PAY_N = 250;
function vrng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function tex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
// shortest distance from point (px,py) to segment (ax,ay)-(bx,by)
function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-6; const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1); return Math.hypot(px - ax - t * dx, py - ay - t * dy); }

export class JetpackDash extends Game8 {
  get title() { return 'JETPACK DASH'; }
  get hint() { return 'Hold anywhere to fire your jetpack and rise; let go to fall. Dodge zappers, missiles (watch the ! warning) and lasers. Fly 250 m without a hit to raise your multiplier (up to x10). Coins and close calls score big. A shield saves you once.'; }
  get accent() { return '#22d3ee'; }
  get musicOpts() { return { root: 50, bpm: 128, mode: 'minor', seed: 71, vol: 0.26 }; }
  get settingsSchema() { return [
    { key: 'cam', label: 'Camera view', def: 'angled', options: [['angled', 'Angled (see further ahead)'], ['wide', 'Angled, wide'], ['side', 'Side (classic)']] },
    { key: 'detail', label: 'Graphics detail', def: 'balanced', options: [['high', 'High'], ['balanced', 'Balanced'], ['performance', 'Performance (battery saver)']] },
    { key: 'fx', label: 'Camera shake & speed effects', def: 'on', options: [['on', 'On'], ['off', 'Off']] }]; }
  applySettings(x) { this.opt = { cam: 'angled', detail: 'balanced', fx: 'on', ...x }; this._camInit = false; if (this.ready3) this.applyDetail(); }
  applyDetail() { const d = (this.opt || {}).detail || 'balanced', R = this.R3; const sh = d !== 'performance'; if (R.shadowMap.enabled !== sh) { R.shadowMap.enabled = sh; this.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); }); }
    this.pr = d === 'high' ? Math.min(devicePixelRatio || 1, 2) : d === 'balanced' ? Math.min(devicePixelRatio || 1, 1.4) : 1; R.setPixelRatio(this.pr); this._rw = 0; }
  constructor(c, o) { super(c, o); const r = document.getElementById('rot'); if (r) r.style.display = 'none'; } // portrait-native

  // ---------- 3D setup ----------
  async load() {
    const parent = this.c.parentElement; const cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;z-index:-1;pointer-events:none;display:block'; parent.insertBefore(cv, this.c); this.gl = cv;
    const R = this.R3 = new THREE.WebGLRenderer({ canvas: cv, antialias: (devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
    this.pr = Math.min(devicePixelRatio || 1, 1.4); R.setPixelRatio(this.pr); R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
    R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.3; R.outputColorSpace = THREE.SRGBColorSpace;
    const S = this.scene = new THREE.Scene(); S.background = new THREE.Color('#05070f'); S.fog = new THREE.Fog('#070a18', 38, 95);
    const pm = new THREE.PMREMGenerator(R); { const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(20, 16, 8), new THREE.MeshBasicMaterial({ color: '#141b33', side: THREE.BackSide })));
      for (const [x, c] of [[-8, '#7dd3fc'], [6, '#c4b5fd'], [0, '#fef3c7']]) { const l = new THREE.Mesh(new THREE.BoxGeometry(14, 0.4, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(4) })); l.position.set(x, 9, -3); es.add(l); }
      S.environment = pm.fromScene(es, 0.02).texture; }
    S.add(new THREE.HemisphereLight('#c3d6ff', '#3a3046', 1.5));
    this.key = new THREE.PointLight('#dbeafe', 40, 22, 1.6); S.add(this.key); this.fill = new THREE.PointLight('#e879f9', 14, 18, 1.8); S.add(this.fill);
    const L = this.light = new THREE.DirectionalLight('#e8f1ff', 2.6); L.castShadow = true; L.shadow.mapSize.set(1024, 1024); Object.assign(L.shadow.camera, { left: -20, right: 30, top: 14, bottom: -4, near: 1, far: 60 }); L.shadow.bias = -0.0005; S.add(L, L.target);
    this.cam = new THREE.PerspectiveCamera(50, 1, 0.2, 200);
    const glowT = tex(64, 64, (x, w) => { const g = x.createRadialGradient(32, 32, 1, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
    this.glowT = glowT; const glow = (c, s, o = 0.9) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: o })); sp.scale.set(s, s, 1); return sp; };
    this.glow = glow;
    // ---- corridor segment (floor, back wall with grow-room windows, ceiling lights + pipes, pillars) ----
    const vr = vrng(0x1ab5);
    const floorT = tex(256, 256, (x, w, h) => { x.fillStyle = '#20252f'; x.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#262c38' : '#1c212a'; x.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); } x.strokeStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 40; i++) { x.beginPath(); x.moveTo(vr() * w, vr() * h); x.lineTo(vr() * w, vr() * h); x.stroke(); } }, true);
    floorT.repeat.set(SEG / 4, 2);
    const stripeT = tex(128, 32, (x, w, h) => { x.fillStyle = '#facc15'; x.fillRect(0, 0, w, h); x.fillStyle = '#111'; for (let i = -2; i < 10; i++) { x.beginPath(); x.moveTo(i * 24, h); x.lineTo(i * 24 + 12, h); x.lineTo(i * 24 + 28, 0); x.lineTo(i * 24 + 16, 0); x.fill(); } }, true); stripeT.repeat.set(SEG / 2, 1);
    const wallT = tex(512, 256, (x, w, h) => { x.fillStyle = '#2b3242'; x.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) { x.fillStyle = '#323a4d'; x.fillRect(i * 128 + 4, 8, 120, h - 16); x.strokeStyle = '#1b202b'; x.lineWidth = 3; x.strokeRect(i * 128 + 4, 8, 120, h - 16); x.fillStyle = '#596381'; for (const [cx, cy] of [[12, 16], [116, 16], [12, h - 16], [116, h - 16]]) { x.beginPath(); x.arc(i * 128 + cx, cy, 2.5, 0, TAU); x.fill(); } }
      x.fillStyle = '#151a24'; for (let i = 0; i < 4; i++) for (let k = 0; k < 6; k++) x.fillRect(i * 128 + 30 + k * 12, h - 60, 7, 34); x.fillStyle = '#0ea5e9'; x.fillRect(150, 40, 48, 26); x.fillStyle = '#22c55e'; x.fillRect(408, 52, 30, 16); }, true); wallT.repeat.set(SEG / 8, 1);
    const growT = tex(512, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#3b0d5c'); g.addColorStop(1, '#14051f'); x.fillStyle = g; x.fillRect(0, 0, w, h); for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(232,121,249,.85)'; x.fillRect(20 + i * 82, 14, 60, 6); }
      const leaf = (cx, cy, r, col) => { x.save(); x.translate(cx, cy); x.fillStyle = col; for (const [a, l] of [[0, 1], [-0.45, 0.85], [0.45, 0.85], [-0.9, 0.6], [0.9, 0.6], [-1.3, 0.36], [1.3, 0.36]]) { x.save(); x.rotate(a); x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(r * 0.16 * l, -r * 0.55 * l, 0, -r * l); x.quadraticCurveTo(-r * 0.16 * l, -r * 0.55 * l, 0, 0); x.fill(); x.restore(); } x.restore(); };
      for (let i = 0; i < 9; i++) { const cx = 30 + i * 56; x.fillStyle = '#2a1036'; x.fillRect(cx - 16, 200, 32, 40); for (let k = 0; k < 7; k++) leaf(cx + (k % 2 ? 9 : -9), 196 - k * 21, 34 - k * 3, ['#3f6e2a', '#4d8a31', '#5aa035'][k % 3]); }
      x.fillStyle = 'rgba(244,114,182,.12)'; x.fillRect(0, 0, w, h); });
    const M = { floor: new THREE.MeshStandardMaterial({ map: floorT, color: '#c8cfdc', metalness: 0.45, roughness: 0.36 }), stripe: new THREE.MeshStandardMaterial({ map: stripeT, roughness: 0.6 }), wall: new THREE.MeshStandardMaterial({ map: wallT, color: '#c9d2e6', metalness: 0.25, roughness: 0.55 }),
      ceil: new THREE.MeshStandardMaterial({ color: '#1a1f2b', metalness: 0.4, roughness: 0.6 }), light: new THREE.MeshStandardMaterial({ color: '#e0f2fe', emissive: '#bfe8ff', emissiveIntensity: 2.2 }), pipe: new THREE.MeshStandardMaterial({ color: '#8b95a7', metalness: 0.85, roughness: 0.32 }),
      pipe2: new THREE.MeshStandardMaterial({ color: '#b45309', metalness: 0.7, roughness: 0.4 }), pillar: new THREE.MeshStandardMaterial({ color: '#3a4256', metalness: 0.6, roughness: 0.45 }), grow: new THREE.MeshStandardMaterial({ map: growT, emissive: '#ffffff', emissiveMap: growT, emissiveIntensity: 0.9 }),
      glass: new THREE.MeshPhysicalMaterial({ color: '#c4b5fd', transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0, clearcoat: 1 }), frame: new THREE.MeshStandardMaterial({ color: '#5b6478', metalness: 0.8, roughness: 0.3 }) };
    const mkSeg = (k) => { const g = new THREE.Group();
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(SEG, 8).rotateX(-Math.PI / 2), M.floor); fl.position.set(SEG / 2, 0, 0); fl.receiveShadow = true;
      const st = new THREE.Mesh(new THREE.PlaneGeometry(SEG, 0.5).rotateX(-Math.PI / 2), M.stripe); st.position.set(SEG / 2, 0.01, 2.4); st.receiveShadow = true;
      const wl = new THREE.Mesh(new THREE.PlaneGeometry(SEG, CH + 1), M.wall); wl.position.set(SEG / 2, (CH + 1) / 2 - 0.5, -3); wl.receiveShadow = true;
      const ce = new THREE.Mesh(new THREE.PlaneGeometry(SEG, 8).rotateX(Math.PI / 2), M.ceil); ce.position.set(SEG / 2, CH, 0);
      g.add(fl, st, wl, ce);
      for (let i = 0; i < 3; i++) { const lt = new THREE.Mesh(new THREE.BoxGeometry(6, 0.12, 0.6), M.light); lt.position.set(5 + i * 10, CH - 0.07, -0.6); g.add(lt); }
      for (const [y, z, r, m] of [[CH - 0.5, -2.5, 0.22, M.pipe], [CH - 0.95, -2.6, 0.14, M.pipe2], [0.35, -2.7, 0.18, M.pipe]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, SEG, 10).rotateZ(Math.PI / 2), m); p.position.set(SEG / 2, y, z); p.castShadow = true; g.add(p); }
      for (const px of [0.5, 15.5]) { const pl = new THREE.Mesh(new THREE.BoxGeometry(0.8, CH, 0.8), M.pillar); pl.position.set(px, CH / 2, -2.6); pl.castShadow = true; pl.receiveShadow = true; g.add(pl); }
      if (k % 2 === 0) { const win = new THREE.Mesh(new THREE.PlaneGeometry(10, 4.6), M.grow); win.position.set(8, 4.4, -2.98); const gl = new THREE.Mesh(new THREE.PlaneGeometry(10, 4.6), M.glass); gl.position.set(8, 4.4, -2.9);
        const fr = new THREE.Mesh(new THREE.BoxGeometry(10.4, 5, 0.2), M.frame); fr.position.set(8, 4.4, -3.05); const pg = glow('#e879f9', 7, 0.35); pg.position.set(8, 5.5, -2.5); g.add(fr, win, gl, pg); }
      else { for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.2 + vr() * 1.4, 1.1), M.pillar); b.position.set(4 + i * 3.5, b.geometry.parameters.height / 2, -2.2); b.castShadow = true; g.add(b); } const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.6, 16), new THREE.MeshPhysicalMaterial({ color: '#4ade80', emissive: '#16a34a', emissiveIntensity: 0.6, transparent: true, opacity: 0.75, roughness: 0.1 })); tank.position.set(20, 1.3, -2.2); g.add(tank, glow('#4ade80', 3, 0.4)); g.children[g.children.length - 1].position.set(20, 1.5, -1.9); }
      return g; };
    this.segs = []; for (let k = 0; k < NSEG; k++) { const g = mkSeg(k); g.position.x = (k - 1) * SEG; S.add(g); this.segs.push(g); }
    // ---- hero (animated CC0 character) + jetpack ----
    const gl = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder); let heroG = null; try { heroG = await gl.loadAsync(A3 + 'hero.glb'); } catch (e) { heroG = null; }
    this.hero = new THREE.Group(); S.add(this.hero); this.body = new THREE.Group(); this.hero.add(this.body);
    if (heroG) { const h = cloneSkinned(heroG.scene); const b = new THREE.Box3().setFromObject(h), s = new THREE.Vector3(); b.getSize(s); const k = HERO_H / s.y; h.scale.setScalar(k); h.position.y = -b.min.y * k; h.rotation.y = Math.PI / 2;
      h.traverse(m => { if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; } }); this.body.add(h); this.dressPilot(h); this.mixer = new THREE.AnimationMixer(h); const clip = (n) => heroG.animations.find(a => a.name === n);
      this.acts = {}; for (const [k2, n] of [['run', 'Sprint_Loop'], ['fly', 'Jump_Loop'], ['die', 'Death01'], ['idle', 'Idle_Loop']]) { const c = clip(n); if (c) this.acts[k2] = this.mixer.clipAction(c); }
      if (this.acts.die) { this.acts.die.setLoop(THREE.LoopOnce); this.acts.die.clampWhenFinished = true; } }
    else { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.1, 6, 12), new THREE.MeshStandardMaterial({ color: '#f59e0b' })); b.position.y = 0.9; this.body.add(b); }
    const jpMat = new THREE.MeshStandardMaterial({ color: '#c0c6d0', metalness: 0.85, roughness: 0.28 }), jpRed = new THREE.MeshStandardMaterial({ color: '#dc2626', metalness: 0.4, roughness: 0.35 });
    const jp = new THREE.Group(); const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.62, 0.5), jpRed); pack.position.set(-0.27, 1.22, 0); jp.add(pack);
    for (const z of [-0.16, 0.16]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.75, 14), jpMat); t.position.set(-0.36, 1.2, z); const nz = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.16, 14), jpMat); nz.position.set(-0.36, 0.76, z); jp.add(t, nz); }
    jp.traverse(m => { if (m.isMesh) m.castShadow = true; }); this.body.add(jp);
    this.flames = new THREE.Group(); const fm = new THREE.MeshBasicMaterial({ color: '#fdba74', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), fm2 = new THREE.MeshBasicMaterial({ color: '#fef3c7', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const z of [-0.16, 0.16]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.9, 12).rotateX(Math.PI), fm); f.position.set(-0.36, 0.25, z); const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.5, 10).rotateX(Math.PI), fm2); f2.position.set(-0.36, 0.45, z); this.flames.add(f, f2); }
    const fg = glow('#fb923c', 1.6, 0.8); fg.position.set(-0.36, 0.4, 0); this.flames.add(fg); this.body.add(this.flames);
    this.shieldM = new THREE.Mesh(new THREE.SphereGeometry(1.25, 24, 16), new THREE.MeshPhysicalMaterial({ color: '#67e8f9', emissive: '#22d3ee', emissiveIntensity: 0.35, transparent: true, opacity: 0.22, roughness: 0.1, depthWrite: false })); this.shieldM.position.y = 0.95; this.hero.add(this.shieldM);
    // ---- particles: exhaust sparks + smoke (sprites), shells (small boxes) ----
    this.p3 = []; for (let i = 0; i < 90; i++) { const s = glow('#fb923c', 0.3, 0); s.visible = false; S.add(s); this.p3.push({ s, life: 0, vx: 0, vy: 0, max: 1 }); } this.pi = 0;
    const smokeT = tex(64, 64, (x, w) => { const g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(210,214,224,.7)'); g.addColorStop(1, 'rgba(210,214,224,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
    this.smoke = []; for (let i = 0; i < 50; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeT, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; S.add(s); this.smoke.push({ s, life: 0 }); } this.si = 0;
    // ---- hazard prototypes ----
    const boltT = tex(256, 64, (x, w, h) => { x.clearRect(0, 0, w, h); for (let p = 0; p < 3; p++) { x.strokeStyle = p ? 'rgba(165,243,252,.75)' : '#ffffff'; x.lineWidth = p ? 3 : 5; x.beginPath(); let y = h / 2; x.moveTo(0, y); for (let i = 1; i <= 16; i++) { y = h / 2 + (vr() - 0.5) * h * 0.7; x.lineTo(i * w / 16, y); } x.stroke(); } }, true);
    this.boltT = boltT; this.boltM = new THREE.MeshBasicMaterial({ map: boltT, color: '#fde68a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.nodeM = new THREE.MeshStandardMaterial({ color: '#374151', metalness: 0.8, roughness: 0.3 }); this.capM = new THREE.MeshStandardMaterial({ color: '#fde047', emissive: '#facc15', emissiveIntensity: 1.6 });
    this.coinGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.06, 18).rotateX(Math.PI / 2); this.coinMat = new THREE.MeshStandardMaterial({ color: '#fcd34d', metalness: 0.6, roughness: 0.3, emissive: '#f59e0b', emissiveIntensity: 0.55 });
    this.coinI = new THREE.InstancedMesh(this.coinGeo, this.coinMat, 260); this.coinI.frustumCulled = false; this.coinI.count = 0; S.add(this.coinI);
    this.haz3 = new THREE.Group(); S.add(this.haz3);
    this.tmpM = new THREE.Matrix4(); this.tmpQ = new THREE.Quaternion(); this.tmpV = new THREE.Vector3(); this.tmpE = new THREE.Euler();
    this.camPos = new THREE.Vector3(); this.camLook = new THREE.Vector3(); this.ready3 = true; if (!this.opt) this.opt = { cam: 'angled', detail: 'balanced', fx: 'on' }; this.applyDetail(); this.sync3(0);
  }
  // The CC0 base character is an unclothed body: dress it as a jetpack pilot (flight suit by rest-pose region + helmet on the head bone).
  dressPilot(h) {
    h.updateMatrixWorld(true); let eyes = null, head = null;
    h.traverse(o => { if (o.isMesh && /Hair|Eyebrow|Eyes/.test(o.name)) { if (/Eyes/.test(o.name)) eyes = o; o.visible = false; } if (o.isBone && !head && /head/i.test(o.name)) head = o; });
    const suit = new THREE.MeshStandardMaterial({ color: '#2a3a5c', roughness: 0.55, metalness: 0.12 });
    suit.onBeforeCompile = (sh) => { sh.vertexShader = 'varying vec3 vRest;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vRest = position;');
      sh.fragmentShader = 'varying vec3 vRest;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float y = vRest.y, ax = abs(vRest.x);
        if (y < 0.13) diffuseColor.rgb = vec3(0.05, 0.05, 0.06);                         // boots
        else if (ax > 0.66) diffuseColor.rgb = vec3(0.06, 0.06, 0.07);                    // gloves
        else if (y > 0.93 && y < 0.99) diffuseColor.rgb = vec3(0.08, 0.08, 0.09);         // belt
        else if (y > 1.27 && y < 1.33 && ax < 0.3) diffuseColor.rgb = vec3(0.98, 0.45, 0.09); // chest band
        else if (y > 1.36 && ax > 0.18 && ax < 0.3) diffuseColor.rgb = vec3(0.98, 0.45, 0.09); // shoulder flashes`); };
    h.traverse(o => { if (o.isMesh && /SuperHero|Male|Body/i.test(o.name)) o.material = suit; });
    if (!head) return; const c = new THREE.Vector3(); if (eyes) new THREE.Box3().setFromObject(eyes).getCenter(c); else c.set(0, HERO_H * 0.92, 0); c.y += 0.02;
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.165, 24, 16), new THREE.MeshPhysicalMaterial({ color: '#f1f5f9', roughness: 0.25, clearcoat: 1, metalness: 0.1 }));
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.135, 24, 16), new THREE.MeshPhysicalMaterial({ color: '#0b1220', roughness: 0.05, metalness: 0.6, clearcoat: 1, envMapIntensity: 1.5 })); visor.scale.set(0.75, 0.72, 1); visor.position.set(0.07, 0.0, 0);
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.012, 6, 32), new THREE.MeshStandardMaterial({ color: '#f97316' })); stripe.rotation.y = Math.PI / 2;
    const helmet = new THREE.Group(); helmet.add(shell, visor, stripe); helmet.traverse(m => { if (m.isMesh) m.castShadow = true; });
    // place in world (hero still at the origin, facing +x), then re-parent to the head bone keeping that world transform
    helmet.position.copy(c); helmet.updateMatrixWorld(true); head.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(head.matrixWorld).invert();
    helmet.applyMatrix4(inv); head.add(helmet);
  }
  destroy() { super.destroy(); try { this.R3 && this.R3.dispose(); this.R3 && this.R3.forceContextLoss(); } catch {} if (this.gl) this.gl.remove(); this.ready3 = false; }

  // ---------- game state ----------
  layout() {}
  reset() {
    super.reset(); this.score = 0; this.coins = 0; this.dist = 0; this.v = 9; this.y = 0; this.vy = 0; this.hold = false; this.kh = 0; this.mult = 1; this.mSince = 0; this.paid = 0;
    this.shield = false; this.inv = 0; this.zaps = []; this.missiles = []; this.lasers = []; this.trails = []; this.pickups = []; this.nextHaz = 40; this.nextCoin = 22; this.nextMis = 160; this.nextLaser = 900; this.nextShield = 380; this.dead = 0; this.near = 0;
    if (this.haz3) { this.haz3.clear(); this.coinI.count = 0; } this._died = false;
  }
  onDown() { this.hold = true; } onUp() { this.hold = false; }
  onKey(c, d) { if (c === 'Space' || c === 'ArrowUp' || c === 'KeyW') this.kh = d ? 1 : 0; }
  diff() { return clamp(this.dist / 3000, 0, 1); }
  rr(a, b) { return a + this.r() * (b - a); }
  // ---- seeded world generation (in distance order) ----
  spawnHaz() {
    const d = this.nextHaz, df = this.diff();
    const n = df > 0.35 && this.r() < 0.35 + df * 0.25 ? 2 : 1;
    for (let i = 0; i < n; i++) { const L = this.rr(2.4, 3.2 + df * 2.4), kind = this.r(), ang = kind < 0.32 ? 0 : kind < 0.62 ? Math.PI / 2 : kind < 0.81 ? Math.PI / 4 : -Math.PI / 4;
      const rot = this.dist > 500 && this.r() < 0.18 + df * 0.25 ? (this.r() < 0.5 ? -1 : 1) * this.rr(0.8, 1.6) : 0; const half = Math.abs(Math.sin(ang)) * L / 2 + 0.3;
      const cy = rot ? this.rr(L / 2 + 0.4, CH - L / 2 - 0.4) : this.rr(half + 0.2, CH - half - 0.2); this.zaps.push({ x: d + i * this.rr(7, 11), cy, L, ang, rot, near: false, hit: false, o: null }); }
    this.nextHaz = d + Math.max(11, 24 - df * 11) + this.r() * 10;
  }
  spawnCoins() { const d = this.nextCoin, kind = Math.floor(this.r() * 4), cy = this.rr(1.2, CH - 2.2), n = 8 + Math.floor(this.r() * 8), pts = [];
    for (let i = 0; i < n; i++) { const x = d + i * 0.75; let y = cy; if (kind === 1) y = cy + Math.sin(i / (n - 1) * Math.PI) * 1.8; else if (kind === 2) y = cy + Math.sin(i * 0.7) * 1.1; else if (kind === 3) y = cy + (i % 2) * 0.7; pts.push({ x, y: clamp(y, 0.5, CH - 0.6), got: false }); }
    this.trails.push({ pts, end: pts[pts.length - 1].x, n: 0, paid: false }); this.nextCoin = d + n * 0.75 + this.rr(14, 34); }
  spawnMissile() { const n = this.dist > 900 && this.r() < 0.3 + this.diff() * 0.3 ? 2 : 1; for (let i = 0; i < n; i++) this.missiles.push({ ph: 'warn', t: 1.3 + i * 0.55, y: clamp(this.y + 0.9 + (i ? this.rr(-2, 2) : 0), 0.6, CH - 0.6), x: 0, o: null }); this.nextMis = this.nextMis + Math.max(70, 190 - this.diff() * 110) + this.r() * 90; }
  spawnLaser() { const rows = this.r() < 0.5 ? [this.rr(1, CH - 1)] : [this.rr(1, CH / 2 - 0.5), this.rr(CH / 2 + 0.5, CH - 1)]; for (const y of rows) this.lasers.push({ y, ph: 'warn', t: 1.5, o: null }); this.nextLaser += Math.max(220, 520 - this.diff() * 250) + this.r() * 200; }
  hit(why) {
    if (this.inv > 0 || this._died) return;
    if (this.shield) { this.shield = false; this.inv = 1.4; const m0 = this.mult; this.mult = Math.max(1, this.mult - 3); if (this.mult !== m0) this.mark('x', this.mult); this.mSince = 0; /* only log real changes: the server rejects repeated marks */ this.fx.shake(12); this.hitstop(0.06); this.sfx.noise(0.25, { vol: 0.4, freq: 600 }); const [sx, sy] = this.screen(this.dist, this.y + 1); this.pop(sx, sy - 70, 'SHIELD BROKEN', '#67e8f9', 22); return; }
    this._died = true; this.fx.shake(16); this.hitstop(0.08); this.sfx.noise(0.4, { vol: 0.5, freq: 400 }); const [sx, sy] = this.screen(this.dist, this.y + 1); this.fx.burst(sx, sy, ['#fff', '#fde047', '#fb923c'], 26, 420, 0.7, 12); this.pop(sx, sy - 80, why, '#f87171', 26);
    if (this.acts && this.acts.die) { for (const a of Object.values(this.acts)) a.stop(); this.acts.die.reset().play(); } this.kill(1.4, '#fca5a5');
  }
  heroHits(px, py, r) { for (const k of [0.45, 0.95, 1.45]) if (Math.hypot(px - this.dist, py - (this.y + k)) < r + 0.36) return true; return false; }
  update(dt) {
    if (this._died) return;
    const T = this.playT, df = this.diff(), hold = this.hold || this.kh;
    this.v = Math.min(VMAX, 9 + T * 0.11); const dx = this.v * dt; this.dist += dx;
    this.vy += (hold ? 36 : 0) * dt - 27 * dt; this.vy = clamp(this.vy, -15, 11); this.y += this.vy * dt;
    if (this.y <= 0) { this.y = 0; if (this.vy < 0) this.vy = 0; } if (this.y >= CH - HERO_H - 0.05) { this.y = CH - HERO_H - 0.05; if (this.vy > 0) this.vy = 0; }
    this.thrust = hold; if (this.inv > 0) this.inv -= dt;
    // distance payouts + multiplier
    while (this.dist >= (this.paid + 1) * MSTEP) { this.paid++; this.award(PAY_M * this.mult, 'm'); this.mSince++; if (this.mSince >= 10 && this.mult < 10) { this.mult++; this.mSince = 0; this.mark('x', this.mult); const [sx, sy] = this.screen(this.dist, this.y + 1.5); this.pop(sx, sy - 90, `MULTIPLIER x${this.mult}`, '#facc15', 24); this.sfx.chord([523, 659, 784, 1047], 0.14, { type: 'triangle', vol: 0.14 }); } }
    // world spawning
    const ahead = this.dist + 60; while (this.nextHaz < ahead) this.spawnHaz(); while (this.nextCoin < ahead) this.spawnCoins();
    while (this.nextMis < this.dist && this.dist > 150) this.spawnMissile(); while (this.nextLaser < this.dist) this.spawnLaser();
    while (this.nextShield < ahead) { this.pickups.push({ x: this.nextShield, y: this.rr(2, CH - 2.5), got: false, o: null }); this.nextShield += this.rr(600, 1100); }
    // zappers
    for (const z of this.zaps) { if (z.rot) z.ang += z.rot * dt; if (z.hit || z.x < this.dist - 12) continue; const hx = Math.cos(z.ang) * z.L / 2, hy = Math.sin(z.ang) * z.L / 2;
      const ax = z.x - hx, ay = z.cy - hy, bx = z.x + hx, by = z.cy + hy; let md = Infinity; for (const k of [0.45, 0.95, 1.45]) md = Math.min(md, segDist(this.dist, this.y + k, ax, ay, bx, by));
      if (md < 0.36 + 0.2) { z.hit = true; this.hit('ZAPPED'); }
      else if (!z.near && md < 1.15 && Math.abs(this.dist - z.x) < Math.abs(hx) + 0.6) z.close = true;
      if (!z.near && z.close && this.dist > Math.max(ax, bx) + 0.5 && this.inv <= 0) { z.near = true; this.award(PAY_N * this.mult, 'n'); const [sx, sy] = this.screen(this.dist, this.y + 1.2); this.pop(sx, sy - 110, `CLOSE CALL +${fmt(PAY_N * this.mult)}`, '#a5f3fc', 18); this.sfx.tone(1250, 0.07, { type: 'square', vol: 0.07, slide: 1.4 }); } }
    this.zaps = this.zaps.filter(z => z.x > this.dist - 14);
    // coins (trail payout once the trail is passed)
    for (const t of this.trails) { if (t.paid) continue; for (const p of t.pts) if (!p.got && Math.abs(p.x - this.dist) < 0.7 && Math.abs(p.y - (this.y + 0.95)) < 1.05) { p.got = true; t.n++; this.coins++; this.sfx.tone(988 + t.n * 30, 0.05, { type: 'square', vol: 0.05 }); }
      if (this.dist > t.end + 0.8) { t.paid = true; if (t.n) { this.award(PAY_C * t.n * this.mult, 'c'); const [sx, sy] = this.screen(this.dist, this.y + 1.2); this.pop(sx, sy - 60, `+${fmt(PAY_C * t.n * this.mult)}`, '#fde047', 17); } } }
    this.trails = this.trails.filter(t => !t.paid || t.end > this.dist - 10);
    // missiles: warn (tracks your height) then fly in from the right
    for (const m of this.missiles) { if (m.ph === 'warn') { m.t -= dt; if (m.t > 0.45) m.y = lerp(m.y, clamp(this.y + 0.95, 0.6, CH - 0.6), Math.min(1, dt * 4)); if (m.t <= 0) { m.ph = 'fly'; m.x = this.dist + 34; this.sfx.noise(0.3, { vol: 0.2, freq: 1800 }); } }
      else if (m.ph === 'fly') { m.x -= (18) * dt; if (this.heroHits(m.x, m.y, 0.4)) { m.ph = 'done'; this.hit('MISSILE'); } if (m.x < this.dist - 12) m.ph = 'done'; } }
    this.missiles = this.missiles.filter(m => m.ph !== 'done');
    // lasers: charge, fire, fade
    for (const l of this.lasers) { l.t -= dt; if (l.ph === 'warn' && l.t <= 0) { l.ph = 'fire'; l.t = 1.1; this.sfx.noise(0.5, { vol: 0.25, freq: 900 }); } else if (l.ph === 'fire') { if (Math.abs(this.y + 0.95 - l.y) < 1.0) this.hit('LASER'); if (l.t <= 0) l.ph = 'done'; } }
    this.lasers = this.lasers.filter(l => l.ph !== 'done');
    // shield pickups
    for (const p of this.pickups) if (!p.got && Math.abs(p.x - this.dist) < 0.9 && Math.abs(p.y - (this.y + 0.95)) < 1.2) { p.got = true; this.shield = true; const [sx, sy] = this.screen(this.dist, this.y + 1.2); this.pop(sx, sy - 90, 'SHIELD', '#67e8f9', 22); this.sfx.chord([660, 990], 0.12, { type: 'square', vol: 0.1 }); }
    this.pickups = this.pickups.filter(p => p.x > this.dist - 10 && !p.got);
    this.setLevel(0.4 + Math.min(0.6, this.mult / 12));
  }
  dyingUpdate(dt) { this.vy -= 27 * dt; this.y = Math.max(0, this.y + this.vy * dt); this.dist += this.v * 0.3 * dt; }

  // ---------- 3D sync + render ----------
  screen(x, y) { if (!this.cam) return [this.W / 2, this.H / 2]; const v = this.tmpV.set(x, y, 0).project(this.cam); const r = this.c.getBoundingClientRect(), k = this.c.width / Math.max(1, r.width);
    return [(((v.x + 1) / 2) * r.width * k - this.ox) / this.scale, (((1 - v.y) / 2) * r.height * k - this.oy) / this.scale]; }
  emit(x, y, vx, vy, col, life, size) { const p = this.p3[this.pi++ % this.p3.length]; p.life = p.max = life; p.vx = vx; p.vy = vy; p.s.visible = true; p.s.position.set(x, y, 0.15); p.s.material.color.set(col); p.s.scale.setScalar(size); p.size = size; }
  sync3(dt) {
    const X = this.dist, S = this.scene, ready = this.state === 'ready';
    // corridor recycling
    const base = Math.floor(X / SEG) - 1; for (let k = 0; k < NSEG; k++) this.segs[k].position.x = (base + ((k - base) % NSEG + NSEG) % NSEG) * SEG; // each segment keeps a unique slot in [base, base+NSEG)
    // hero
    this.hero.position.set(X, this.y, 0); this.body.rotation.z = clamp(this.vy * 0.025, -0.25, 0.2) * (this._died ? 0 : 1);
    this.hero.visible = !(this.inv > 0 && ((this.t * 14) | 0) % 2) || this._died; this.shieldM.visible = this.shield; if (this.shield) this.shieldM.material.opacity = 0.18 + Math.sin(this.t * 6) * 0.06;
    this.flames.visible = !!this.thrust && !this._died && this.state === 'play'; if (this.flames.visible) this.flames.children.forEach(f => { if (f.isMesh) f.scale.y = 0.75 + Math.random() * 0.5; });
    if (this.mixer) { const want = this._died ? 'die' : ready ? 'idle' : this.y <= 0.02 ? 'run' : 'fly'; if (want !== this._act && this.acts[want]) { const a = this.acts[want]; if (this._act && this.acts[this._act] && want !== 'die') this.acts[this._act].fadeOut(0.15); a.reset().fadeIn(want === 'die' ? 0 : 0.15).play(); this._act = want; } this.mixer.update(dt * (this._act === 'run' ? 0.8 + this.v / 30 : 1)); }
    // exhaust sparks + shells + smoke
    if (this.flames.visible && dt > 0) { for (let i = 0; i < 2; i++) this.emit(X - 0.36 + (Math.random() - 0.5) * 0.2, this.y + 0.25, -this.v * 0.2 + (Math.random() - 0.5) * 2, -8 - Math.random() * 6, Math.random() < 0.5 ? '#fdba74' : '#fde68a', 0.35, 0.28);
      if (Math.random() < 0.5) { const s = this.smoke[this.si++ % this.smoke.length]; s.life = 0.8; s.s.visible = true; s.s.position.set(X - 0.4, this.y + 0.1, 0.1); s.s.scale.setScalar(0.5); } }
    for (const p of this.p3) { if (p.life <= 0) continue; p.life -= dt; p.vy -= 12 * dt; p.s.position.x += p.vx * dt; p.s.position.y = Math.max(0.05, p.s.position.y + p.vy * dt); p.s.material.opacity = Math.max(0, p.life / p.max); if (p.life <= 0) p.s.visible = false; }
    for (const s of this.smoke) { if (s.life <= 0) continue; s.life -= dt; s.s.position.y -= dt * 1.2; const k = 1 - s.life / 0.8; s.s.scale.setScalar(0.5 + k * 2.2); s.s.material.opacity = Math.max(0, 0.35 * (1 - k)); if (s.life <= 0) s.s.visible = false; }
    // hazards (meshes created once, removed when passed)
    const live = new Set();
    for (const z of this.zaps) { if (!z.o) { const g = new THREE.Group(); const beam = new THREE.Mesh(new THREE.PlaneGeometry(z.L, 0.55), this.boltM.clone()); beam.material.map = this.boltT.clone(); beam.material.map.needsUpdate = true; beam.material.map.repeat.set(z.L / 3, 1); g.add(beam);
        for (const s of [-1, 1]) { const n = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.55, 14).rotateZ(Math.PI / 2), this.nodeM); const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), this.capM); cap.position.x = -s * 0.3; const gw = this.glow('#fde047', 1.4, 0.7); n.add(body, cap, gw); n.position.x = s * (z.L / 2 + 0.25); n.traverse(m => { if (m.isMesh) m.castShadow = true; }); g.add(n); }
        z.o = g; this.haz3.add(g); }
      z.o.position.set(z.x, z.cy, 0); z.o.rotation.z = z.ang; z.o.children[0].material.map.offset.x = (this.t * 7) % 1; z.o.children[0].material.opacity = 0.75 + Math.random() * 0.25; z.o.visible = !z.hit; live.add(z.o); }
    for (const m of this.missiles) { if (m.ph !== 'fly') continue; if (!m.o) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.3, 14).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#d1d5db', metalness: 0.7, roughness: 0.3 })); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 14).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.4 })); tip.position.x = -0.87;
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.55, 0.04), new THREE.MeshStandardMaterial({ color: '#dc2626' })); fin.position.x = 0.55; const fin2 = fin.clone(); fin2.rotation.x = Math.PI / 2; const fl = this.glow('#fb923c', 1.6, 0.95); fl.position.x = 0.95; g.add(b, tip, fin, fin2, fl); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); m.o = g; this.haz3.add(g); }
      m.o.position.set(m.x, m.y, 0); m.o.rotation.x += dt * 6; live.add(m.o); if (dt > 0 && Math.random() < 0.7) { const s = this.smoke[this.si++ % this.smoke.length]; s.life = 0.8; s.s.visible = true; s.s.position.set(m.x + 1.1, m.y, 0); s.s.scale.setScalar(0.4); } }
    for (const l of this.lasers) { if (!l.o) { const g = new THREE.Group(); const beam = new THREE.Mesh(new THREE.BoxGeometry(70, 0.32, 0.32), new THREE.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); const core = new THREE.Mesh(new THREE.BoxGeometry(70, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: '#fff1f1' }));
        for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.8), this.nodeM); e.position.x = s * 12; const eg = this.glow('#ff4d4d', 1.8, 0.8); eg.position.x = s * 12; g.add(e, eg); } g.add(beam, core); l.o = g; this.haz3.add(g); }
      l.o.position.set(X + 6, l.y, 0); const fire = l.ph === 'fire'; l.o.children[l.o.children.length - 2].material.opacity = fire ? 0.9 : 0.12 + 0.12 * Math.sin(this.t * 30); l.o.children[l.o.children.length - 1].visible = fire; l.o.children[l.o.children.length - 2].scale.y = fire ? 1 + Math.random() * 0.3 : 0.4; live.add(l.o); }
    for (const p of this.pickups) { if (!p.o) { const g = new THREE.Group(); const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), new THREE.MeshPhysicalMaterial({ color: '#67e8f9', emissive: '#06b6d4', emissiveIntensity: 1, metalness: 0.2, roughness: 0.15, clearcoat: 1 })); const r = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 8, 32), this.capM); g.add(s, r, this.glow('#22d3ee', 2.4, 0.7)); p.o = g; this.haz3.add(g); }
      p.o.position.set(p.x, p.y, 0); p.o.rotation.y = this.t * 2; p.o.children[1].rotation.x = this.t * 3; live.add(p.o); }
    for (const o of [...this.haz3.children]) if (!live.has(o)) this.haz3.remove(o);
    // coins (instanced)
    let n = 0; const Mx = this.tmpM, Q = this.tmpQ; for (const t of this.trails) for (const p of t.pts) { if (p.got || p.x > X + 70 || p.x < X - 12 || n >= 260) continue; Q.setFromEuler(this.tmpE.set(0, this.t * 3 + p.x, 0)); Mx.compose(this.tmpV.set(p.x, p.y, 0), Q, new THREE.Vector3(1, 1, 1)); this.coinI.setMatrixAt(n++, Mx); }
    this.coinI.count = n; this.coinI.instanceMatrix.needsUpdate = true;
    // camera: angled side view (default) looks down the corridor so hazards are visible far ahead on a tall phone screen
    const mode = (this.opt && this.opt.cam) || 'angled', fxOn = !this.opt || this.opt.fx !== 'off';
    const a = this._camInit ? Math.min(1, dt * 5) : 1; this._camInit = true;
    let pos, look, fov;
    if (mode === 'side') { pos = [X + 5, CH / 2, 19]; look = [X + 5, CH / 2, 0]; fov = 50; }
    else if (mode === 'wide') { pos = [X - 5, CH / 2 + 1.8, 15]; look = [X + 11, CH / 2 - 0.6, -1.5]; fov = 58; }
    else { pos = [X - 2.2, CH / 2 + 1.0, 11]; look = [X + 7, CH / 2 - 1.0, -1.5]; fov = 54; }
    this.camPos.lerp(this.tmpV.set(...pos), a); this.camLook.lerp(new THREE.Vector3(...look), a);
    const sh = fxOn ? this.fx.shakeM * 0.02 : 0; this.cam.position.set(this.camPos.x + (Math.random() - 0.5) * sh, this.camPos.y + (Math.random() - 0.5) * sh, this.camPos.z); this.cam.lookAt(this.camLook);
    this.cam.fov = lerp(this.cam.fov, fov + (fxOn ? this.v * 0.15 : 0), a); this.cam.updateProjectionMatrix();
    this.light.position.set(X + 6, CH + 6, 10); this.light.target.position.set(X + 6, 0, 0); this.key.position.set(X + 3, CH - 1.2, 4); this.fill.position.set(X + 12, 4, -1.5);
  }
  frame(dt) { this._dt = dt; super.frame(dt); }
  draw() {
    if (this.ready3) { const r = this.c.getBoundingClientRect(); if (r.width !== this._rw || r.height !== this._rh) { this._rw = r.width; this._rh = r.height; this.R3.setSize(r.width, r.height, false); this.cam.aspect = r.width / Math.max(1, r.height); }
      if (this.frameMsP95 > 26 && this.pr > 1 && this.t > 4) { this.pr = 1; this.R3.setPixelRatio(1); this._rw = 0; }
      this.sync3(this.state === 'paused' ? 0 : (this._dt || 0)); this.R3.render(this.scene, this.cam); }
    const ctx = this.ctx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.c.width, this.c.height); if (!this.ready3) { ctx.fillStyle = PAL.bg; ctx.fillRect(0, 0, this.c.width, this.c.height); }
    const sm = this.opt && this.opt.fx === 'off' ? 0 : this.fx.shakeM, sx = sm ? (Math.random() - 0.5) * sm * 0.4 : 0, sy = sm ? (Math.random() - 0.5) * sm * 0.4 : 0;
    ctx.setTransform(this.scale, 0, 0, this.scale, this.ox + sx * this.scale, this.oy + sy * this.scale); this.render(ctx); this.fx.draw(ctx);
    for (const p of this.pops) { ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2)); const k = 1 + Math.max(0, p.life - 0.7) * 1.5; this.text(ctx, p.text, p.x, p.y, { size: p.size * k, color: p.color, align: 'center', glow: p.color }); }
    ctx.globalAlpha = 1; if (this.fx.flashA > 0.01) { ctx.globalAlpha = this.fx.flashA; ctx.fillStyle = this.fx.flashC; ctx.fillRect(0, 0, this.W, this.H); ctx.globalAlpha = 1; }
    if (this.state === 'ready') this.center(ctx, this.title, this.hint, 'TAP TO START'); if (this.state === 'paused') this.center(ctx, 'PAUSED', 'Tap Resume to keep playing');
  }
  // ---------- HUD ----------
  panel(ctx, x, y, w, h, r = 14) { roundRect(ctx, x, y, w, h, r); ctx.fillStyle = 'rgba(6,9,22,.66)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1; ctx.stroke(); }
  render(ctx) {
    const W = this.W, H = this.H; if (this.state === 'ready') return;
    this.panel(ctx, 12, 12, 236, 64); this.text(ctx, 'SCORE', 26, 32, { size: 10, color: '#cbd5e1', font: 'Exo' }); this.text(ctx, fmt(this.dispScore), 26, 64, { size: 28, weight: 900, color: '#fff' });
    this.text(ctx, 'BEST ' + fmt(Math.max(this.best || 0, this.score || 0)), 234, 32, { size: 10, color: '#fcd34d', align: 'right', font: 'Exo' });
    // multiplier badge with progress ring to the next step
    const cx = W - 52, cy = 46; this.panel(ctx, W - 96, 12, 84, 70, 18); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.arc(cx, cy, 25, 0, TAU); ctx.stroke();
    if (this.mult < 10) { ctx.strokeStyle = '#facc15'; ctx.beginPath(); ctx.arc(cx, cy, 25, -Math.PI / 2, -Math.PI / 2 + TAU * (this.mSince / 10)); ctx.stroke(); }
    this.text(ctx, 'x' + this.mult, cx, cy + 8, { size: 22, weight: 900, color: this.mult >= 10 ? '#facc15' : '#fff', align: 'center' });
    this.panel(ctx, 12, 84, 236, 30, 12); this.text(ctx, `${fmt(Math.floor(this.dist))} m   ·   ${fmt(this.coins)} coins${this.shield ? '   ·   SHIELD' : ''}`, 26, 104, { size: 12, color: '#e2e8f0', font: 'Exo' });
    // missile / laser warnings at the right edge, at the threat's height
    for (const m of this.missiles) if (m.ph === 'warn') { const [, y] = this.screen(this.dist + 20, m.y); const blink = ((this.t * 8) | 0) % 2; ctx.fillStyle = blink ? '#ef4444' : '#fca5a5'; ctx.beginPath(); ctx.arc(W - 30, clamp(y, 130, H - 40), 18, 0, TAU); ctx.fill(); this.text(ctx, '!', W - 30, clamp(y, 130, H - 40) + 8, { size: 22, weight: 900, color: '#fff', align: 'center' }); }
    if (this.state === 'play' && this.playT < 4) { ctx.globalAlpha = 0.55 * Math.min(1, 4 - this.playT); this.text(ctx, 'HOLD TO FLY', W / 2, H * 0.62, { size: 24, color: '#fff', align: 'center', glow: '#22d3ee' }); this.text(ctx, 'let go to fall', W / 2, H * 0.62 + 30, { size: 14, color: '#cbd5e1', align: 'center', font: 'Exo' }); ctx.globalAlpha = 1; }
  }
}
