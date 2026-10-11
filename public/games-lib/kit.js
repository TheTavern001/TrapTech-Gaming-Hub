// The Gaming Hub - Games Library mini engine "Kit" (original code, MIT, Trap Tech Solutions).
// Canvas + letterboxing + DPR, fixed-step loop, keyboard/mouse/touch input with an optional virtual stick and buttons,
// particles, floating text, screen shake, WebAudio synth SFX, seeded RNG, title/game-over screens and the Hub adapter.
(function () {
  const TAU = Math.PI * 2;
  const K = window.Kit = { TAU };
  K.clamp = (v, a, b) => v < a ? a : v > b ? b : v; K.lerp = (a, b, t) => a + (b - a) * t;
  K.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  K.rr = function (c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  K.circ = (c, x, y, r, col) => { c.save(); const grad = c.createRadialGradient(x - r * .34, y - r * .38, Math.max(.5, r * .03), x, y, r); grad.addColorStop(0, 'rgba(255,255,255,.92)'); grad.addColorStop(.2, col); grad.addColorStop(.76, col); grad.addColorStop(1, 'rgba(3,6,18,.94)'); c.fillStyle = grad; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); if (r > 8) { c.globalAlpha *= .34; c.strokeStyle = '#fff'; c.lineWidth = Math.max(1, r * .045); c.beginPath(); c.arc(x - r * .1, y - r * .1, r * .72, Math.PI * 1.08, Math.PI * 1.68); c.stroke(); } c.restore(); };
  K.hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  K.cr = (cx, cy, r, b) => { const x = K.clamp(cx, b.x, b.x + b.w), y = K.clamp(cy, b.y, b.y + b.h); return (cx - x) ** 2 + (cy - y) ** 2 < r * r; };
  function mulberry(seedHex) { let a = (parseInt(String(seedHex || '').slice(0, 8), 16) || (Math.random() * 4e9)) >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // ---- WebAudio synth ----
  let AC = null, muted = localStorage.getItem('gl_mute') === '1';
  function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
  function tone(f, d, type, vol, slide, delay) { const a = ac(); if (!a || muted) return; const t = a.currentTime + (delay || 0); const o = a.createOscillator(), g = a.createGain(); o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + d); g.gain.setValueAtTime(vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + 0.02); }
  function noise(d, vol, hp) { const a = ac(); if (!a || muted) return; const n = Math.floor(a.sampleRate * d), b = a.createBuffer(1, n, a.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = a.createBufferSource(); s.buffer = b; const g = a.createGain(); g.gain.value = vol || 0.15; const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = hp || 1200; s.connect(f); f.connect(g); g.connect(a.destination); s.start(); }
  const SFX = {
    jump: () => tone(320, 0.14, 'square', 0.06, 2.2), flap: () => tone(500, 0.08, 'triangle', 0.08, 1.6), coin: () => { tone(988, 0.06, 'square', 0.05); tone(1319, 0.12, 'square', 0.05, 1, 0.06); },
    hit: () => { tone(180, 0.12, 'sawtooth', 0.07, 0.5); noise(0.08, 0.08, 900); }, boom: () => { noise(0.45, 0.25, 700); tone(90, 0.4, 'sine', 0.15, 0.3); },
    die: () => { tone(440, 0.5, 'sawtooth', 0.07, 0.15); noise(0.3, 0.1, 500); }, shoot: () => tone(880, 0.07, 'square', 0.035, 0.4), power: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.09, 'triangle', 0.06, 1, i * 0.06)); },
    click: () => tone(660, 0.04, 'square', 0.04), pop: () => tone(700 + Math.random() * 300, 0.07, 'sine', 0.08, 0.5), thud: () => { tone(110, 0.12, 'sine', 0.12, 0.6); noise(0.06, 0.06, 400); },
    good: () => { tone(660, 0.07, 'triangle', 0.06); tone(990, 0.12, 'triangle', 0.06, 1, 0.07); }, bad: () => tone(150, 0.25, 'square', 0.06, 0.7), line: () => { [440, 554, 659, 880].forEach((f, i) => tone(f, 0.08, 'square', 0.04, 1, i * 0.04)); },
    engine: (p) => tone(60 + 80 * (p || 0), 0.05, 'sawtooth', 0.02), whoosh: () => noise(0.18, 0.07, 2500),
  };
  K.sfx = (n, p) => { try { SFX[n] && SFX[n](p); } catch (e) {} };
  K.tone = tone; K.noise = noise;
  // ---- run a game ----
  K.run = function (def) {
    const L = def.orient === 'l' ? [800, 450] : [400, 700]; const W = def.w || L[0], Hh = def.h || L[1];
    const cv = document.createElement('canvas'); cv.id = 'gl'; document.body.appendChild(cv); const c = cv.getContext('2d');
    let scale = 1, ox = 0, oy = 0;
    function resize() { const vw = innerWidth, vh = innerHeight, d = Math.min(2, devicePixelRatio || 1); scale = Math.min(vw / W, vh / Hh); const cw = Math.floor(W * scale), ch = Math.floor(Hh * scale); ox = (vw - cw) / 2; oy = (vh - ch) / 2; cv.style.cssText = `position:absolute;left:${ox}px;top:${oy}px;width:${cw}px;height:${ch}px;touch-action:none`; cv.width = Math.floor(cw * d); cv.height = Math.floor(ch * d); c.setTransform(cv.width / W, 0, 0, cv.height / Hh, 0, 0); }
    addEventListener('resize', resize); resize();
    const g = { W, H: Hh, c, t: 0, score: 0, best: +(localStorage.getItem('gl_best_' + def.id) || 0), state: 'title', rnd: Math.random, keys: {}, hud: '', parts: [], texts: [], shakeT: 0, shakeM: 0, flashT: 0, flashC: '#fff', frames: 0, fps: 60, inputs: 0,
      ptr: { x: W / 2, y: Hh / 2, down: false, pressed: false, released: false, sx: 0, sy: 0 }, stick: { x: 0, y: 0, on: false, cx: 0, cy: 0 }, btn: {}, def, sub: null };
    g.R = (a, b) => a + g.rnd() * (b - a); g.RI = (a, b) => Math.floor(g.R(a, b + 1)); g.pick = (arr) => arr[Math.floor(g.rnd() * arr.length)];
    g.add = (v, k) => { v = Math.round(v); if (!v || g.state !== 'play') return; g.score += v; window.Hub && Hub.event(k || 'p', v); };
    g.mark = (k, v) => { window.Hub && Hub.event('#' + k, v); }; // '#' = progress marker, not points (ignored by score sums)
    g.burst = (x, y, col, n, sp, life, sz) => { n = n || 12; for (let i = 0; i < n && g.parts.length < 600; i++) { const a = Math.random() * TAU, s = (sp || 160) * (0.3 + Math.random()); g.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: (life || 0.6) * (0.5 + Math.random() * 0.7), m: 0, c: Array.isArray(col) ? col[i % col.length] : col, s: (sz || 3) * (0.6 + Math.random() * 0.8), gr: def.partGrav || 0 }); } };
    g.float = (x, y, s, col, size) => g.texts.push({ x, y, s: String(s), c: col || '#fff', l: 0.9, size: size || 18 });
    g.shake = (m, t) => { g.shakeM = Math.max(g.shakeM, m); g.shakeT = Math.max(g.shakeT, t || 0.25); };
    g.flash = (col, t) => { g.flashC = col || '#fff'; g.flashT = t || 0.12; };
    g.sfx = K.sfx;
    g.end = (why) => { if (g.state !== 'play') return; g.state = 'over'; g.overT = 0; g.why = why || ''; K.sfx('die'); g.shake(8, 0.4); if (g.score > g.best) { g.best = g.score; localStorage.setItem('gl_best_' + def.id, g.best); g.newBest = true; } else g.newBest = false;
      g.sub = { pending: true }; const p = window.Hub ? Hub.submit(g.score) : Promise.resolve({ ok: false, error: 'offline' }); p.then(r => { g.sub = r; window.__GL.lastSubmit = r; }); };
    g.held = () => g.ptr.down || g.keys[' '] || g.keys.ArrowUp || g.keys.w || g.keys.W;
    g.tap = () => g.ptr.pressed || g._kp;
    g.ax = () => (g.keys.ArrowRight || g.keys.d || g.keys.D ? 1 : 0) - (g.keys.ArrowLeft || g.keys.a || g.keys.A ? 1 : 0) + g.stick.x;
    g.ay = () => (g.keys.ArrowDown || g.keys.s || g.keys.S ? 1 : 0) - (g.keys.ArrowUp || g.keys.w || g.keys.W ? 1 : 0) + g.stick.y;
    window.__GL = { g, get state() { return g.state; }, get score() { return g.score; }, get fps() { return g.fps; }, get jsMs() { return Math.round((g.jsMs || 0) * 100) / 100; }, lastSubmit: null, errors: [] };
    // buttons: def.buttons = [{id:'A', key:' ', label:'JUMP'}]
    const btns = (def.buttons || []).map((b, i, arr) => ({ ...b, r: 34, x: W - 50 - (arr.length - 1 - i) * 82, y: Hh - 56 }));
    const toL = (e) => [((e.clientX - ox) / scale), ((e.clientY - oy) / scale)];
    const touches = new Map();
    function onDown(e) { e.preventDefault(); ac(); const [x, y] = toL(e); g.inputs++; window.Hub && Hub.input();
      if (g.state !== 'play') { g.ptr.pressed = true; g.ptr.x = x; g.ptr.y = y; touches.set(e.pointerId, { k: 'ptr' }); return; }
      for (const b of btns) if (Math.hypot(x - b.x, y - b.y) < b.r + 10) { g.btn[b.id] = true; g.btnP = g.btnP || {}; g.btnP[b.id] = true; if (b.key) g.keys[b.key] = true; touches.set(e.pointerId, { k: 'btn', b }); return; }
      if (def.stick && (e.pointerType === 'touch' || def.stick === 'always') && (!def.stickZone || def.stickZone(x, y))) { g.stick.on = true; g.stick.cx = x; g.stick.cy = y; g.stick.x = g.stick.y = 0; touches.set(e.pointerId, { k: 'stick' }); if (!def.stickAlsoPtr) return; }
      touches.set(e.pointerId, { k: 'ptr' }); g.ptr.down = true; g.ptr.pressed = true; g.ptr.x = g.ptr.sx = x; g.ptr.y = g.ptr.sy = y; }
    function onMove(e) { const [x, y] = toL(e); const t = touches.get(e.pointerId); if (t && t.k === 'stick') { const dx = x - g.stick.cx, dy = y - g.stick.cy, m = Math.hypot(dx, dy), R = 50; g.stick.x = K.clamp(dx / R, -1, 1); g.stick.y = K.clamp(dy / R, -1, 1); if (m > R) { g.stick.cx = x - dx / m * R; g.stick.cy = y - dy / m * R; } if (!def.stickAlsoPtr) return; } if (!t || t.k === 'ptr' || e.pointerType === 'mouse') { g.ptr.x = x; g.ptr.y = y; } }
    function onUp(e) { const t = touches.get(e.pointerId); touches.delete(e.pointerId); if (t && t.k === 'btn') { g.btn[t.b.id] = false; if (t.b.key) g.keys[t.b.key] = false; return; } if (t && t.k === 'stick') { g.stick.on = false; g.stick.x = g.stick.y = 0; if (!def.stickAlsoPtr) return; } g.ptr.down = false; g.ptr.released = true; }
    cv.addEventListener('pointerdown', onDown); addEventListener('pointermove', onMove); addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp);
    cv.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('keydown', e => { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault(); if (e.key === 'm' || e.key === 'M') { muted = !muted; localStorage.setItem('gl_mute', muted ? '1' : '0'); }
      if (!g.keys[e.key]) { g._kp = true; g.kp = g.kp || {}; g.kp[e.key] = true; g.inputs++; window.Hub && Hub.input(); ac(); } g.keys[e.key] = true; if (e.key === 'p' || e.key === 'Escape') g.paused = !g.paused && g.state === 'play'; });
    addEventListener('keyup', e => { g.keys[e.key] = false; });
    document.addEventListener('visibilitychange', () => { if (document.hidden && g.state === 'play') g.paused = true; });
    g.kd = (k) => !!(g.kp && g.kp[k]);
    async function begin() { g.state = 'starting'; const seed = window.Hub ? await Hub.start(def.id) : null; g.rnd = mulberry(seed); g.score = 0; g.t = 0; g.parts = []; g.texts = []; g.hud = ''; g.paused = false; def.init(g); g.state = 'play'; K.sfx('power'); }
    g.rnd = mulberry(); def.init(g);
    let last = performance.now(), acc = 0, fpsT = 0, fpsN = 0;
    function frame(now) {
      requestAnimationFrame(frame); const js0 = performance.now(); let dt = Math.min(0.05, (now - last) / 1000); last = now; fpsT += dt; fpsN++; if (fpsT >= 1) { g.fps = Math.round(fpsN / fpsT); fpsT = 0; fpsN = 0; }
      if (g.state === 'title' || (g.state === 'over' && g.overT > 0.8)) { if (g.tap()) begin(); }
      if (g.state === 'over') g.overT += dt;
      if (g.state === 'play' && !g.paused) { g.t += dt; def.update(g, dt); }
      else if (g.state === 'title' && def.attract) { g.t += dt; def.attract(g, dt); }
      for (let i = g.parts.length - 1; i >= 0; i--) { const p = g.parts[i]; p.m += dt; if (p.m >= p.l) { g.parts.splice(i, 1); continue; } p.vy += p.gr * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; p.vy *= 0.98; }
      for (let i = g.texts.length - 1; i >= 0; i--) { const t = g.texts[i]; t.l -= dt; t.y -= 40 * dt; if (t.l <= 0) g.texts.splice(i, 1); }
      g.shakeT -= dt; g.flashT -= dt;
      c.save(); c.fillStyle = def.bg || '#050714'; c.fillRect(0, 0, W, Hh);
      if (g.shakeT > 0) c.translate((Math.random() - 0.5) * g.shakeM, (Math.random() - 0.5) * g.shakeM);
      def.draw(g, c);
      c.globalCompositeOperation = 'lighter';
      for (const p of g.parts) { c.globalAlpha = Math.max(0, 1 - p.m / p.l); c.fillStyle = p.c; c.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      for (const t of g.texts) { c.globalAlpha = Math.min(1, t.l * 2); c.font = `bold ${t.size}px system-ui,sans-serif`; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.6)'; c.strokeText(t.s, t.x, t.y); c.fillStyle = t.c; c.fillText(t.s, t.x, t.y); }
      c.globalAlpha = 1; c.restore();
      if (g.flashT > 0) { c.globalAlpha = Math.min(0.5, g.flashT * 4); c.fillStyle = g.flashC; c.fillRect(0, 0, W, Hh); c.globalAlpha = 1; }
      drawHud(); g.frames++; g.jsMs = (g.jsMs || 0) * 0.9 + (performance.now() - js0) * 0.1; // JS frame time (update + draw + WebGL submit), EMA
      g.ptr.pressed = false; g.ptr.released = false; g._kp = false; g.kp = {}; g.btnP = {};
    }
    function txt(s, x, y, size, col, al) { c.font = `bold ${size}px system-ui,sans-serif`; c.textAlign = al || 'center'; c.textBaseline = 'middle'; c.lineWidth = 4; c.strokeStyle = 'rgba(5,7,20,.75)'; c.strokeText(s, x, y); c.fillStyle = col || '#eef0ff'; c.fillText(s, x, y); }
    g.txt = txt;
    function drawHud() {
      if (g.state === 'play' || g.state === 'over') {
        const bar = c.createLinearGradient(0, 5, 0, 42); bar.addColorStop(0, 'rgba(19,27,58,.96)'); bar.addColorStop(1, 'rgba(5,8,23,.84)');
        K.rr(c, 8, 6, W - 16, 34, 11); c.fillStyle = bar; c.fill(); c.strokeStyle = 'rgba(151,168,255,.25)'; c.lineWidth = 1; c.stroke();
        c.fillStyle = '#4de5f7'; c.fillRect(18, 13, 2, 20); c.fillStyle = '#a78bfa'; c.fillRect(W - 20, 13, 2, 20);
        if (def.hudDraw) def.hudDraw(g, c);
        else {
          txt(Math.floor(g.score).toLocaleString('en-US'), 29, 23, 20, '#ffffff', 'left');
          txt('BEST ' + Math.floor(g.best).toLocaleString('en-US'), W - 30, 23, 11, '#b9c6e8', 'right');
          if (g.hud) txt(g.hud, W / 2, 23, 12, '#71edff');
        }
      }
      if (g.state === 'play') {
        for (const b of btns) { c.globalAlpha = g.btn[b.id] ? .68 : .38; K.circ(c, b.x, b.y, b.r, '#6366f1'); c.globalAlpha = .96; txt(b.label || b.id, b.x, b.y, 12, '#fff'); c.globalAlpha = 1; }
        if (g.stick.on) { c.globalAlpha = .28; K.circ(c, g.stick.cx, g.stick.cy, 50, '#22d3ee'); c.globalAlpha = .75; K.circ(c, g.stick.cx + g.stick.x * 50, g.stick.cy + g.stick.y * 50, 22, '#a855f7'); c.globalAlpha = 1; }
        if (g.paused) { c.fillStyle = 'rgba(5,7,20,.7)'; c.fillRect(0, 0, W, Hh); const pg = c.createLinearGradient(0,Hh*.4,W,Hh*.6); pg.addColorStop(0,'#111936'); pg.addColorStop(.5,'#1b2050'); pg.addColorStop(1,'#111936'); K.rr(c,W*.13,Hh*.39,W*.74,Hh*.22,18); c.fillStyle=pg; c.fill(); c.strokeStyle='rgba(77,229,247,.5)'; c.stroke(); txt('PAUSED', W / 2, Hh / 2 - 8, 34, '#ffffff'); txt('TAP OR PRESS P TO RESUME', W / 2, Hh / 2 + 30, 12, '#9defff'); if (g.ptr.pressed) g.paused = false; }
      }
      if (g.state === 'title' || g.state === 'starting') {
        c.fillStyle = 'rgba(3,5,15,.66)'; c.fillRect(0, 0, W, Hh);
        const glow = c.createRadialGradient(W/2,Hh*.45,4,W/2,Hh*.45,Math.max(W,Hh)*.7); glow.addColorStop(0,'rgba(124,58,237,.26)'); glow.addColorStop(.5,'rgba(34,211,238,.08)'); glow.addColorStop(1,'rgba(3,5,15,0)'); c.fillStyle=glow;c.fillRect(0,0,W,Hh);
        const px=W*.055, py=Hh*.235, pw=W*.89, ph=Hh*.55, card=c.createLinearGradient(px,py,px+pw,py+ph);card.addColorStop(0,'rgba(25,34,72,.97)');card.addColorStop(.55,'rgba(10,15,38,.96)');card.addColorStop(1,'rgba(6,9,24,.98)');
        K.rr(c,px,py,pw,ph,22);c.fillStyle=card;c.fill();c.strokeStyle='rgba(151,168,255,.36)';c.lineWidth=1.25;c.stroke();
        c.fillStyle='#4de5f7';c.fillRect(px+18,py+18,36,3);c.fillStyle='#a78bfa';c.fillRect(px+59,py+18,16,3);
        const gr = c.createLinearGradient(W / 2 - 150, 0, W / 2 + 150, 0); gr.addColorStop(0, '#c4a3ff'); gr.addColorStop(.48, '#6d8bff'); gr.addColorStop(1, '#55f0ff');
        c.save();c.shadowColor='#4de5f7';c.shadowBlur=20;c.font=`900 ${Math.min(40, W / (def.title.length * .62))}px system-ui,sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillStyle=gr;c.fillText(def.title,W/2,Hh*.36);c.restore();
        const lines=(def.help||'').split('\n');lines.forEach((l,i)=>txt(l,W/2,Hh*.36+43+i*22,13,'#c0cbed'));
        const pillY=Hh*.72+Math.sin(performance.now()/300)*3;const pill=c.createLinearGradient(W/2-112,0,W/2+112,0);pill.addColorStop(0,'#5b32ce');pill.addColorStop(.55,'#415be0');pill.addColorStop(1,'#0891b2');K.rr(c,W/2-112,pillY-19,224,38,13);c.fillStyle=pill;c.fill();c.strokeStyle='rgba(255,255,255,.28)';c.stroke();txt(g.state==='starting'?'STARTING…':'TAP / SPACE TO PLAY',W/2,pillY,14,'#ffffff');
        if(g.best)txt('PERSONAL BEST  '+g.best.toLocaleString('en-US'),W/2,Hh*.72+43,11,'#ffdf83');
      }
      if (g.state === 'over') {
        c.fillStyle=`rgba(3,5,15,${Math.min(.78,g.overT*1.6)})`;c.fillRect(0,0,W,Hh);
        const glow=c.createRadialGradient(W/2,Hh*.44,5,W/2,Hh*.44,Math.max(W,Hh)*.62);glow.addColorStop(0,g.newBest?'rgba(255,209,102,.2)':'rgba(124,58,237,.2)');glow.addColorStop(1,'rgba(3,5,15,0)');c.fillStyle=glow;c.fillRect(0,0,W,Hh);
        const px=W*.08,py=Hh*.22,pw=W*.84,ph=Hh*.56,panel=c.createLinearGradient(px,py,px+pw,py+ph);panel.addColorStop(0,'rgba(25,34,72,.98)');panel.addColorStop(1,'rgba(6,9,24,.98)');K.rr(c,px,py,pw,ph,22);c.fillStyle=panel;c.fill();c.strokeStyle=g.newBest?'rgba(255,209,102,.6)':'rgba(151,168,255,.35)';c.lineWidth=1.3;c.stroke();
        txt(def.overText||(g.newBest?'NEW PERSONAL BEST':'RUN COMPLETE'),W/2,Hh*.31,Math.min(29,W*.085),g.newBest?'#ffdf83':'#e7ecff');if(g.why)txt(g.why,W/2,Hh*.31+29,12,'#aab7d8');
        txt(Math.floor(g.score).toLocaleString('en-US')+(def.unit?' '+def.unit:''),W/2,Hh*.445,37,'#ffffff');if(g.newBest)txt('✦ NEW BEST ✦',W/2,Hh*.49,13,'#ffdf83');
        const sub=g.sub,m=!sub||sub.pending?'SAVING SCORE…':sub.ok?`SAVED TO LEADERBOARD${sub.rank?' • RANK #'+sub.rank:''}`:(sub.error||'SCORE NOT SAVED');txt(m,W/2,Hh*.59,11,sub&&sub.ok?'#6ee7b7':'#a9b7da');
        if(g.overT>.8){const again=c.createLinearGradient(W/2-100,0,W/2+100,0);again.addColorStop(0,'#5b32ce');again.addColorStop(1,'#0891b2');K.rr(c,W/2-100,Hh*.69,200,36,12);c.fillStyle=again;c.fill();c.strokeStyle='rgba(255,255,255,.25)';c.stroke();txt('TAP TO PLAY AGAIN',W/2,Hh*.69+18,13,'#fff');}
      }
    }
    requestAnimationFrame(frame);
    addEventListener('error', e => window.__GL.errors.push(String(e.message)));
    return g;
  };
  // tiny helpers shared by many games
  K.bgGrid = function (c, W, H, off, col) { c.strokeStyle = col || 'rgba(99,102,241,.12)'; c.lineWidth = 1; c.beginPath(); const s = 40, o = ((off || 0) % s + s) % s; for (let x = -o; x < W; x += s) { c.moveTo(x, 0); c.lineTo(x, H); } for (let y = 0; y < H; y += s) { c.moveTo(0, y); c.lineTo(W, y); } c.stroke(); };
  K.stars = function (c, W, H, t, sp, n) { n = n || 60; c.fillStyle = '#fff'; for (let i = 0; i < n; i++) { const x = (i * 97.3) % W, y = ((i * 53.7) + t * (sp || 40) * (1 + i % 3)) % H; c.globalAlpha = 0.25 + (i % 4) * 0.18; c.fillRect(x, y, 1 + i % 2, 1 + i % 2); } c.globalAlpha = 1; };
  K.glow = function (c, col, blur) { c.shadowColor = col; c.shadowBlur = blur || 12; };
  K.noGlow = function (c) { c.shadowBlur = 0; };
})();
