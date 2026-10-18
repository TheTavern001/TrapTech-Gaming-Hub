// The Gaming Hub - Games Library mini engine "Kit" (original code, MIT, Trap Tech Solutions).
// Canvas + letterboxing + DPR, fixed-step loop, keyboard/mouse/touch input with an optional virtual stick and buttons,
// particles, floating text, screen shake, WebAudio synth SFX, seeded RNG, title/game-over screens and the Hub adapter.
(function () {
  const TAU = Math.PI * 2;
  // Safari/embedded WebViews may deny storage access entirely; gameplay must still boot.
  const safeStore = {
    get(key) { try { return window.localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { window.localStorage.setItem(key, String(value)); } catch {} }
  };
  // Do not disable browser zoom: game canvases own their gestures via touch-action, while players retain page zoom.
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    const parts = viewport.content.split(',').map(x => x.trim()).filter(x => !/^(?:maximum-scale|user-scalable)\s*=/i.test(x));
    if (!parts.some(x => /^viewport-fit\s*=/i.test(x))) parts.push('viewport-fit=cover');
    viewport.content = parts.join(', ');
  }
  const K = window.Kit = { TAU };
  K.clamp = (v, a, b) => v < a ? a : v > b ? b : v; K.lerp = (a, b, t) => a + (b - a) * t;
  K.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  K.rr = function (c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  K.circ = (c, x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
  K.hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  K.cr = (cx, cy, r, b) => { const x = K.clamp(cx, b.x, b.x + b.w), y = K.clamp(cy, b.y, b.y + b.h); return (cx - x) ** 2 + (cy - y) ** 2 < r * r; };
  function mulberry(seedHex) { let a = (parseInt(String(seedHex || '').slice(0, 8), 16) || (Math.random() * 4e9)) >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // ---- WebAudio synth ----
  let AC = null, muted = safeStore.get('gl_mute') === '1';
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
    const L = def.orient === 'l' ? [800, 450] : [400, 700]; const W = def.w || L[0]; let Hh = def.h || L[1]; let g = null;
    const cv = document.createElement('canvas'); cv.id = 'gl'; document.body.appendChild(cv); const c = cv.getContext('2d');
    let scale = 1, ox = 0, oy = 0;
    // Start crisp on high-DPR phones, then dynamically lower only backing-store pixels
    // if rendering stays slow. World coordinates, input accuracy and gameplay are unchanged.
    const initialDpr = Math.min(2, devicePixelRatio || 1);
    let renderDpr = initialDpr, slowFrames = 0, p95Ms = 0; let cameraShakeAllowed=true;let gamePrefs=null;
    const frameSamples = [];
    // v8: portrait fix. Landscape-designed games (orient 'l') rotate 90deg on a portrait phone so they fill the tall screen
    // instead of floating in a thin band; pointer input is mapped back. Portrait games with def.fill grow their logical
    // height to the real aspect ratio (g.W/g.H update, def.onResize fires). Remaining bands take the game's own bg colour.
    let rot = false, hintEl = null;
    function rotateHint(on) { if (!on) { if (hintEl) hintEl.style.display = 'none'; return; } if (!hintEl) { hintEl = document.createElement('div'); hintEl.textContent = 'Turn your phone sideways for a bigger view'; hintEl.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);padding:7px 12px;border-radius:12px;background:rgba(12,14,38,.85);border:1px solid rgba(154,126,255,.45);color:#cfd2ff;font:600 12px system-ui,sans-serif;z-index:50;pointer-events:none;white-space:nowrap'; document.body.appendChild(hintEl); } hintEl.style.display = 'block'; }
    document.documentElement.style.background = def.bg || '#050714'; document.body.style.background = def.bg || '#050714';
    function resize() { const vw = innerWidth, vh = innerHeight, d = renderDpr;
      rot = !!def.rotate && (def.orient === 'l' || W > Hh) && vh > vw * 1.15;
      const land = (def.orient === 'l' || W > Hh) && !rot; rotateHint(land && vh > vw * 1.15);
      if (def.fill && !rot && g) { const minH = def.minH || Math.round(W * 1.3), maxH = def.maxH || Math.round(W * 2.3); const nh = Math.round(K.clamp(W * vh / vw, minH, maxH)); if (nh !== g.H) { g.H = nh; Hh = nh; if (typeof btns !== "undefined" && btns) btns.forEach(b => { b.y = Hh - 56; }); if (def.onResize) def.onResize(g); } }
      const lw = rot ? Hh : W, lh = rot ? W : Hh; scale = Math.min(vw / lw, vh / lh); const cw = Math.floor(W * scale), ch = Math.floor(Hh * scale); ox = (vw - (rot ? ch : cw)) / 2; oy = (vh - (rot ? cw : ch)) / 2;
      cv.style.cssText = rot ? `position:absolute;left:${vw / 2 - cw / 2}px;top:${vh / 2 - ch / 2}px;width:${cw}px;height:${ch}px;transform:rotate(90deg);touch-action:none` : `position:absolute;left:${ox}px;top:${oy}px;width:${cw}px;height:${ch}px;touch-action:none`;
      cv.width = Math.max(1,Math.floor(cw * d)); cv.height = Math.max(1,Math.floor(ch * d)); c.setTransform(cv.width / W, 0, 0, cv.height / Hh, 0, 0); }
    addEventListener('resize', resize); resize();
    g = { W, H: Hh, c, t: 0, score: 0, best: +(safeStore.get('gl_best_' + def.id) || 0), state: 'title', rnd: Math.random, keys: {}, hud: '', parts: [], texts: [], shakeT: 0, shakeM: 0, flashT: 0, flashC: '#fff', frames: 0, fps: 60, inputs: 0,
      ptr: { x: W / 2, y: Hh / 2, down: false, pressed: false, released: false, sx: 0, sy: 0 }, stick: { x: 0, y: 0, on: false, cx: 0, cy: 0 }, btn: {}, def, sub: null };
    g.R = (a, b) => a + g.rnd() * (b - a); g.RI = (a, b) => Math.floor(g.R(a, b + 1)); g.pick = (arr) => arr[Math.floor(g.rnd() * arr.length)];
    g.add = (v, k) => { v = Math.round(v); if (!v || g.state !== 'play') return; g.score += v; window.Hub && Hub.event(k || 'p', v); };
    g.mark = (k, v) => { window.Hub && Hub.event('#' + k, v); }; // '#' = progress marker, not points (ignored by score sums)
    g.burst = (x, y, col, n, sp, life, sz) => { n = n || 12; for (let i = 0; i < n && g.parts.length < 600; i++) { const a = Math.random() * TAU, s = (sp || 160) * (0.3 + Math.random()); g.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: (life || 0.6) * (0.5 + Math.random() * 0.7), m: 0, c: Array.isArray(col) ? col[i % col.length] : col, s: (sz || 3) * (0.6 + Math.random() * 0.8), gr: def.partGrav || 0 }); } };
    g.float = (x, y, s, col, size) => g.texts.push({ x, y, s: String(s), c: col || '#fff', l: 0.9, size: size || 18 });
    g.shake = (m, t) => { if(!cameraShakeAllowed)return; g.shakeM = Math.max(g.shakeM, m); g.shakeT = Math.max(g.shakeT, t || 0.25); };
    g.flash = (col, t) => { g.flashC = col || '#fff'; g.flashT = t || 0.12; };
    g.sfx = K.sfx;
    g.end = (why) => { if (g.state !== 'play') return; g.state = 'over'; g.overT = 0; g.why = why || ''; K.sfx('die'); g.shake(8, 0.4); if (g.score > g.best) { g.best = g.score; safeStore.set('gl_best_' + def.id, g.best); g.newBest = true; } else g.newBest = false;
      g.sub = { pending: true }; const finishedRun = g.runSerial;
      const finalScore = g.score;
      const p = window.Hub ? Promise.resolve().then(() => Hub.submit(finalScore)) : Promise.resolve({ ok: false, error: 'offline' });
      p.then(r => { if (g.runSerial !== finishedRun) return; g.sub = r; window.__GL.lastSubmit = r; }).catch(() => {
        if (g.runSerial !== finishedRun) return;
        // Network errors must not leave the results screen permanently pending.
        g.sub = { ok: false, error: 'Score submission failed. Try again when online.' };
        window.__GL.lastSubmit = g.sub;
      }); };
    g.held = () => g.ptr.down || g.keys[' '] || g.keys.ArrowUp || g.keys.w || g.keys.W;
    g.tap = () => g.ptr.pressed || g._kp;
    g.ax = () => (g.keys.ArrowRight || g.keys.d || g.keys.D ? 1 : 0) - (g.keys.ArrowLeft || g.keys.a || g.keys.A ? 1 : 0) + g.stick.x;
    g.ay = () => (g.keys.ArrowDown || g.keys.s || g.keys.S ? 1 : 0) - (g.keys.ArrowUp || g.keys.w || g.keys.W ? 1 : 0) + g.stick.y;
    window.__GL = { g, get state() { return g.state; }, get score() { return g.score; }, get fps() { return g.fps; }, get jsMs() { return Math.round((g.jsMs || 0) * 100) / 100; }, get frameMsP95() { return p95Ms; }, get renderDpr() { return renderDpr; }, lastSubmit: null, errors: [] };
    // Shared device-only settings: pause game physics without scoring any menu taps.
    let gameSettingsOpen=false;
    import('/js/player-prefs.js').then(P=>{
      gamePrefs=P;
      let wasPaused=false;
      P.openGameSettings({id:def.id,title:def.title,host:document.body,
        onOpen:()=>{wasPaused=g.paused;gameSettingsOpen=true;g.paused=true;clearInputs();},
        onClose:()=>{clearInputs();g.paused=wasPaused;gameSettingsOpen=false;},
        onChange:pref=>{
          muted=!pref.sound;cameraShakeAllowed=!pref.reducedMotion;
          const cap=P.qualityCap(pref.quality,devicePixelRatio||1);
          if(renderDpr!==cap){renderDpr=cap;resize();}
          if(!cameraShakeAllowed)g.shakeT=0;
        },fps:()=>g.fps});
    }).catch(e=>console.error('Game settings failed to load',e));
    // buttons: def.buttons = [{id:'A', key:' ', label:'JUMP'}]
    var btns = (def.buttons || []).map((b, i, arr) => ({ ...b, r: 34, x: W - 50 - (arr.length - 1 - i) * 82, y: Hh - 56 }));
    const toL = (e) => rot ? [W / 2 + (e.clientY - innerHeight / 2) / scale, Hh / 2 - (e.clientX - innerWidth / 2) / scale] : [((e.clientX - ox) / scale), ((e.clientY - oy) / scale)];
    const touches = new Map();
    // Revoke all held pointers and keys together. A tab switch, focus loss or
    // settings overlay must not leave a steering stick or firing key active.
    function clearInputs() {
      touches.clear();
      g.ptr.down=false;g.ptr.pressed=false;g.ptr.released=false;g.ptr.pointerId=null;
      g._kp=false;g.kp={};g.keys={};g.btn={};g.btnP={};
      g.stick.on=false;g.stick.x=0;g.stick.y=0;
    }
    function onDown(e) { e.preventDefault(); if(gameSettingsOpen)return; ac(); const [x, y] = toL(e); g.inputs++; window.Hub && Hub.input();
      if (g.state !== 'play') { g.ptr.pressed = true; g.ptr.x = x; g.ptr.y = y; g.ptr.pointerId=e.pointerId; touches.set(e.pointerId, { k: 'ptr' }); return; }
      for (const b of btns) if (Math.hypot(x - b.x, y - b.y) < b.r + 10) { g.btn[b.id] = true; g.btnP = g.btnP || {}; g.btnP[b.id] = true; if (b.key) g.keys[b.key] = true; touches.set(e.pointerId, { k: 'btn', b }); return; }
      const isStick=def.stick && (e.pointerType === 'touch' || def.stick === 'always') &&
        (!def.stickZone || def.stickZone(x, y)) && !g.stick.on;
      if(isStick) { g.stick.on=true;g.stick.cx=x;g.stick.cy=y;g.stick.x=g.stick.y=0;
        if(!def.stickAlsoPtr){touches.set(e.pointerId,{k:'stick'});return;} }
      // Never let a second finger overwrite the active aim/swipe pointer.
      if(g.ptr.down){touches.set(e.pointerId,{k:isStick?'stick':'ignored'});return;}
      touches.set(e.pointerId,{k:isStick?'stick-ptr':'ptr'});
      g.ptr.pointerId=e.pointerId;g.ptr.down=true;g.ptr.pressed=true;g.ptr.x=g.ptr.sx=x;g.ptr.y=g.ptr.sy=y; }
    function onMove(e) { if(gameSettingsOpen)return; const t=touches.get(e.pointerId);
      if(!t)return; const [x,y]=toL(e);
      if(t.k==='stick'||t.k==='stick-ptr') {
        const dx=x-g.stick.cx,dy=y-g.stick.cy,m=Math.hypot(dx,dy),R=50;
        g.stick.x=K.clamp(dx/R,-1,1);g.stick.y=K.clamp(dy/R,-1,1);
        if(m>R){g.stick.cx=x-dx/m*R;g.stick.cy=y-dy/m*R;}
        if(t.k==='stick')return;
      }
      if((t.k==='ptr'||t.k==='stick-ptr')&&g.ptr.pointerId===e.pointerId){g.ptr.x=x;g.ptr.y=y;}
    }
    function onUp(e) {
      const t=touches.get(e.pointerId);
      if(!t)return; // Stray global pointerup must never shoot, drop or restart.
      touches.delete(e.pointerId);
      if(gameSettingsOpen)return;
      if(t.k==='btn'){g.btn[t.b.id]=false;if(t.b.key)g.keys[t.b.key]=false;return;}
      if(t.k==='stick'||t.k==='stick-ptr'){
        g.stick.on=false;g.stick.x=g.stick.y=0;
        if(t.k==='stick')return;
      }
      if(t.k!=='ptr'&&t.k!=='stick-ptr')return;
      if(g.ptr.pointerId!==e.pointerId)return;
      g.ptr.down=false;g.ptr.pointerId=null;
      if(e.type==='pointercancel'){g.ptr.pressed=false;return;}
      g.ptr.released=true;
    }
    cv.addEventListener('pointerdown', onDown); addEventListener('pointermove', onMove); addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp);
    cv.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('keydown', e => { if(gameSettingsOpen)return; if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault(); if (e.key === 'm' || e.key === 'M') { if(e.repeat)return; muted=!muted; if(gamePrefs)gamePrefs.saveGame(def.id,{sound:!muted}); else safeStore.set('gl_mute',muted?'1':'0'); return; }
      const fresh=!g.keys[e.key];
      if (fresh) { g._kp=true;g.kp=g.kp||{};g.kp[e.key]=true;g.inputs++;window.Hub&&Hub.input();ac(); }
      g.keys[e.key]=true;
      // Auto-repeat of P/Escape must never rapidly unpause and repause the game.
      if(fresh&&(e.key==='p'||e.key==='Escape'))g.paused=!g.paused&&g.state==='play';
    });
    addEventListener('keyup', e => { if(!gameSettingsOpen)g.keys[e.key] = false; });
    addEventListener('blur',()=>{clearInputs();if(g.state==='play')g.paused=true;});
    addEventListener('pagehide',()=>{clearInputs();if(g.state==='play')g.paused=true;});
    addEventListener('freeze',()=>{clearInputs();if(g.state==='play')g.paused=true;});
    document.addEventListener('visibilitychange', () => { if(document.hidden){clearInputs();if(g.state==='play')g.paused=true;} });
    g.kd = (k) => !!(g.kp && g.kp[k]);
    async function begin() { g.state = 'starting'; g.startError = ''; g.runSerial = (g.runSerial || 0) + 1; let seed;
      try { seed = window.Hub ? await Hub.start(def.id) : null; }
      catch (_) { g.state = 'title'; g.startError = 'Could not start game. Check connection and retry.'; return; }
      g.rnd = mulberry(seed); g.score = 0; g.t = 0; g.parts = []; g.texts = []; g.hud = ''; g.paused = document.hidden || gameSettingsOpen; def.init(g); g.state = 'play'; if (!g.paused) K.sfx('power'); }
    resize(); g.rnd = mulberry(); def.init(g);
    let last = performance.now(), acc = 0, fpsT = 0, fpsN = 0;
    function frame(now) {
      requestAnimationFrame(frame); const js0 = performance.now();
      const realDt = Math.max(0, (now - last) / 1000); let dt = Math.min(0.05, realDt); last = now;
      if (document.hidden) { fpsT=0; fpsN=0; slowFrames=0; return; }
      // Frame statistics use real wall-clock duration, not the clamped physics delta.
      if (realDt > 0 && realDt < 1) {
        frameSamples.push(realDt * 1000); if (frameSamples.length > 120) frameSamples.shift();
        const frameSlow = realDt > 0.025 && (g.state === 'play' || g.state === 'title');
        slowFrames = frameSlow ? slowFrames + 1 : 0;
        if (slowFrames >= 45 && renderDpr > 1) {
          renderDpr = Math.max(1,Math.round((renderDpr-0.25)*100)/100);
          resize(); slowFrames = 0;
        }
      }
      fpsT += realDt; fpsN++;
      if (fpsT >= 1) {
        g.fps = Math.round(fpsN / fpsT);
        if (frameSamples.length) { const sorted=[...frameSamples].sort((a,b)=>a-b); p95Ms=Math.round(sorted[Math.min(sorted.length-1,Math.floor(sorted.length*0.95))]*10)/10; }
        fpsT = 0; fpsN = 0;
      }
      if (!gameSettingsOpen && (g.state === 'title' || (g.state === 'over' && g.overT > 0.8))) { if (g.tap()) begin(); }
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
      // Shared presentation pass: premium HUD and launch/result screens for all Kit-powered titles.
      const panel = (x,y,w,h,r,fill,stroke) => {
        c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r);
        c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath();
        if(fill){c.fillStyle=fill;c.fill();} if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}
      };
      const label = (s,x,y,size,color,align) => {
        c.font='800 '+size+'px system-ui,sans-serif'; c.textAlign=align||'center'; c.textBaseline='middle';
        c.lineWidth=3; c.strokeStyle='rgba(3,5,18,.88)'; c.strokeText(s,x,y); c.fillStyle=color||'#f7f7ff'; c.fillText(s,x,y);
      };
      const edge=c.createRadialGradient(W/2,Hh/2,Math.min(W,Hh)*.18,W/2,Hh/2,Math.max(W,Hh)*.72);
      edge.addColorStop(0,'rgba(4,7,22,0)'); edge.addColorStop(1,'rgba(3,5,17,.32)');
      c.fillStyle=edge;c.fillRect(0,0,W,Hh);c.strokeStyle='rgba(137,104,255,.20)';c.lineWidth=1.5;c.strokeRect(5,5,W-10,Hh-10);

      if(g.state==='play'||g.state==='over'){
        if(def.hudDraw) def.hudDraw(g,c);
        else {
          const score=Math.floor(g.score).toLocaleString('en-US'), sw=Math.max(96,score.length*13+30);
          panel(12,12,sw,38,13,'rgba(8,11,30,.86)','rgba(118,119,255,.55)');
          c.fillStyle='#9a7cff';c.fillRect(22,22,3,18);label(score,34,31,19,'#fff','left');
          const best='BEST '+Math.floor(g.best).toLocaleString('en-US');c.font='800 12px system-ui,sans-serif';
          const bw=c.measureText(best).width+28;panel(W-bw-12,12,bw,38,13,'rgba(8,11,30,.82)','rgba(112,232,255,.40)');
          label(best,W-bw/2-12,31,11,'#aeefff');
          if(g.hud){c.font='800 12px system-ui,sans-serif';const hw=Math.min(W-36,c.measureText(g.hud).width+26);panel((W-hw)/2,58,hw,27,10,'rgba(8,11,30,.78)','rgba(255,255,255,.12)');label(g.hud,W/2,71,11,'#d9d4ff');}
        }
        if(g.state==='play'){
          for(const b of btns){const active=!!g.btn[b.id],r=b.r+3;c.save();c.shadowColor=active?'#8e75ff':'#36d9f5';c.shadowBlur=active?18:7;
            K.circ(c,b.x,b.y,r,active?'rgba(143,105,255,.86)':'rgba(12,20,49,.78)');c.restore();
            K.circ(c,b.x,b.y,r-3,active?'rgba(232,222,255,.20)':'rgba(100,220,255,.12)');
            c.strokeStyle=active?'rgba(226,213,255,.95)':'rgba(139,223,255,.68)';c.lineWidth=1.5;c.beginPath();c.arc(b.x,b.y,r-3,0,TAU);c.stroke();label(b.label||b.id,b.x,b.y,11,'#fff');
          }
          if(g.stick.on){c.save();c.shadowColor='#5c8cff';c.shadowBlur=12;K.circ(c,g.stick.cx,g.stick.cy,49,'rgba(9,19,45,.48)');
            c.strokeStyle='rgba(110,214,255,.62)';c.lineWidth=2;c.beginPath();c.arc(g.stick.cx,g.stick.cy,49,0,TAU);c.stroke();
            K.circ(c,g.stick.cx+g.stick.x*34,g.stick.cy+g.stick.y*34,19,'rgba(151,111,255,.82)');c.restore();}
          if(g.paused){c.fillStyle='rgba(3,5,18,.72)';c.fillRect(0,0,W,Hh);panel(W*.16,Hh*.39,W*.68,Hh*.22,20,'rgba(18,20,48,.97)','rgba(144,111,255,.8)');
            label('PAUSED',W/2,Hh*.46,30,'#fff');label('TAP TO RESUME  ·  P / ESC',W/2,Hh*.53,11,'#9cecff');if(g.ptr.pressed)g.paused=false;}
        }
      }
      if(g.state==='title'||g.state==='starting'){
        c.fillStyle='rgba(3,5,19,.79)';c.fillRect(0,0,W,Hh);
        const cx=W/2,cy=Hh*.34,pulse=1+Math.sin(performance.now()/520)*.035;
        c.save();c.translate(cx,cy);c.rotate(performance.now()/8000);
        for(let i=0;i<3;i++){c.beginPath();c.ellipse(0,0,(82+i*23)*pulse,(25+i*9)*pulse,i*.35,0,TAU);c.strokeStyle=i===1?'rgba(107,226,255,.25)':'rgba(162,116,255,.27)';c.lineWidth=1.4;c.stroke();}
        for(let i=0;i<18;i++){const a=i*TAU/18,rr=94+(i%3)*13;K.circ(c,Math.cos(a)*rr,Math.sin(a)*rr*.42,i%4===0?2.2:1.2,i%2?'#78e8ff':'#b69aff');}c.restore();
        const pw=Math.min(W-28,352),ph=Math.min(Hh*.53,300),px=(W-pw)/2,py=Hh*.22;
        const pg=c.createLinearGradient(px,py,px+pw,py+ph);pg.addColorStop(0,'rgba(28,20,62,.96)');pg.addColorStop(1,'rgba(7,20,43,.96)');
        panel(px,py,pw,ph,23,pg,'rgba(154,126,255,.58)');c.strokeStyle='rgba(107,226,255,.28)';c.beginPath();c.moveTo(px+22,py+15);c.lineTo(px+pw-22,py+15);c.stroke();
        c.save();c.shadowColor='#9d73ff';c.shadowBlur=22;c.font='900 '+Math.min(32,W/Math.max(8,def.title.length*.58))+'px system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';
        const tg=c.createLinearGradient(cx-140,0,cx+140,0);tg.addColorStop(0,'#c7a7ff');tg.addColorStop(.5,'#fff');tg.addColorStop(1,'#82eaff');c.fillStyle=tg;c.fillText(def.title,cx,py+55,pw-28);c.restore();
        panel(cx-53,py+78,106,22,11,'rgba(130,104,255,.19)','rgba(155,132,255,.4)');label('TRAP TECH / ARCADE',cx,py+89,8,'#c7bbff');
        (def.help||'').split('\n').filter(Boolean).slice(0,4).forEach((line,idx)=>label(line,cx,py+124+idx*22,Math.min(13,W/28),'#c3c9e9'));
        const ay=Math.min(Hh-54,py+ph-22),bg=c.createLinearGradient(cx-115,ay-20,cx+115,ay+20);bg.addColorStop(0,'#855dff');bg.addColorStop(.55,'#636eff');bg.addColorStop(1,'#28c9e9');
        c.save();c.shadowColor='#7e7aff';c.shadowBlur=16;panel(cx-Math.min(128,pw*.39),ay-20,Math.min(256,pw*.78),40,14,bg,'rgba(255,255,255,.4)');c.restore();
        label(g.state==='starting'?'LOADING YOUR RUN…':'TAP / SPACE TO PLAY',cx,ay,12,'#fff');
        label(g.startError || (g.best?'PERSONAL BEST · '+g.best.toLocaleString('en-US'):'CHASE THE HIGH SCORE'),cx,py+ph+22,10,g.startError?'#ffb4b4':(g.best?'#ffd479':'#8feaff'));
      }
      if(g.state==='over'){
        c.fillStyle='rgba(3,5,19,'+Math.min(.82,g.overT*1.7)+')';c.fillRect(0,0,W,Hh);
        const pw=Math.min(W-30,330),ph=Math.min(300,Hh*.44),px=(W-pw)/2,py=(Hh-ph)/2;
        const pg=c.createLinearGradient(px,py,px+pw,py+ph);pg.addColorStop(0,'rgba(31,21,63,.99)');pg.addColorStop(1,'rgba(8,20,42,.99)');
        panel(px,py,pw,ph,24,pg,'rgba(154,126,255,.68)');
        label(g.newBest?'NEW PERSONAL BEST':(def.overText||'RUN COMPLETE'),W/2,py+37,Math.min(23,W/16),g.newBest?'#ffd479':'#c9bcff');
        if(g.why)label(g.why,W/2,py+65,11,'#aeb9df');label('SCORE',W/2,py+87,9,'#8feaff');
        label(Math.floor(g.score).toLocaleString('en-US')+(def.unit?' '+def.unit:''),W/2,py+112,Math.min(38,W/10),'#fff');
        panel(px+18,py+143,pw-36,36,12,'rgba(6,11,29,.76)','rgba(255,255,255,.12)');
        const status=!g.sub||g.sub.pending?'SAVING SCORE…':g.sub.ok?'LEADERBOARD SAVED'+(g.sub.rank?' · RANK #'+g.sub.rank:''):g.sub.practice?'PRACTICE RUN · SIGN IN TO SAVE':(g.sub.error||'SCORE NOT SAVED');
        label(status.toUpperCase(),W/2,py+161,9,g.sub&&g.sub.ok?'#7bf0bf':'#b6c2e8');
        panel(px+25,py+ph-40,pw-50,34,12,'rgba(117,91,255,.27)','rgba(145,130,255,.68)');label('TAP TO PLAY AGAIN',W/2,py+ph-23,11,'#b8f4ff');
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
// ---- juice layer (opt-in allowlist; see juice.js notes) ----
// The Gaming Hub - Games Library "juice" layer (original code, MIT). Opt-in with "// @uses juice.js" before the game script.
// Wraps Kit.run to add, with no change to game rules or scoring: additive spark streaks + shockwave rings on every burst,
// hit-stop on heavy hits, a screen-edge vignette + colour grade, a fade-in, and an original procedural music bed
// (bass + arpeggio, themed per game, tempo creeps up with run time) played through Kit.tone so the Hub mute switch applies.
(function () {
  if (!window.Kit || Kit.__juice) return; Kit.__juice = 1;
  const ON = new Set(['gl-arrow-hero', 'gl-bubble-pop', 'gl-bud-bar', 'gl-bud-sort', 'gl-bullseye', 'gl-cloud-hopper', 'gl-color-hop', 'gl-cue-club', 'gl-cup-toss', 'gl-drift-king', 'gl-helix-drop', 'gl-hex-spin', 'gl-hoop-streak', 'gl-ice-snipe', 'gl-kickflip-city', 'gl-knife-toss', 'gl-knockout', 'gl-light-cycle', 'gl-long-ball', 'gl-maze-muncher', 'gl-missile-guard', 'gl-mole-whack', 'gl-moon-lander', 'gl-neon-flipper', 'gl-no-brakes', 'gl-orb-coil', 'gl-paper-toss', 'gl-pest-patrol', 'gl-pin-strike', 'gl-putt-party', 'gl-rally-court', 'gl-reel-deal', 'gl-roll-up', 'gl-skee-roll', 'gl-spot-kick', 'gl-strain-crush', 'gl-tile-twin', 'gl-tunnel-hop', 'gl-zig-path', 'gl-smoke-rings', 'gl-rock-buster', 'gl-star-swarm', 'gl-block-drop', 'gl-dune-glide', 'gl-egg-roll', 'gl-monster-crush', 'gl-hill-hauler', 'gl-wreck-ride', 'gl-rig-rally', 'gl-neon-circuit', 'gl-grid-wars', 'gl-moon-swarm', 'gl-arrow-hero', 'gl-rail-rush', 'gl-throttle-rider', 'gl-wanted-run', 'gl-road-hopper', 'gl-green-dash', 'gl-road-brawl', 'gl-cab-rush', 'gl-derby-smash', 'gl-cube-horde', 'gl-goo-tower', 'gl-pop-defense']);
  const run = Kit.run;
  // [root midi, scale steps, bpm, bass wave, arp wave, grade colour]
  const MUS = [
    [45, [0, 3, 5, 7, 10], 112, 'triangle', 'square', '20,10,60'],     // dark pentatonic minor
    [48, [0, 2, 4, 7, 9], 124, 'triangle', 'triangle', '10,40,60'],    // bright major pentatonic
    [43, [0, 2, 3, 7, 8], 104, 'sine', 'sawtooth', '50,10,30'],        // moody
    [50, [0, 2, 4, 5, 7], 132, 'triangle', 'square', '10,50,30'],      // upbeat
    [41, [0, 3, 5, 6, 7], 98, 'sine', 'triangle', '30,20,60'],         // bluesy
    [47, [0, 2, 5, 7, 9], 118, 'triangle', 'sawtooth', '60,30,10'],    // warm
  ];
  function hash(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const VIG = {};
  function vignette(W, H, str) {
    const k = W + 'x' + H + ':' + str; if (VIG[k]) return VIG[k];
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + str + ')'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    return (VIG[k] = cv);
  }
  Kit.run = function (def) {
    const J0 = def.juice || {}; if (J0.off || !(J0.on || ON.has(def.id))) return run.call(this, def);
    const oi = def.init, ou = def.update, od = def.draw, id = def.id || 'x';
    const M = MUS[J0.music != null ? J0.music : hash(id) % MUS.length];
    const vig = J0.vig != null ? J0.vig : 0.38;
    def.init = function (g) {
      if (!g.__jw) {
        g.__jw = 1;
        const b0 = g.burst, s0 = g.shake;
        g.burst = function (x, y, col, n, sp, life, sz) {
          b0(x, y, col, n, sp, life, sz); const J = g.jx; if (!J || J.sparks.length > 140) return;
          const cc = Array.isArray(col) ? col[0] : col, big = (n || 12) >= 18;
          const k = Math.min(10, 4 + Math.floor((n || 12) / 5));
          for (let i = 0; i < k; i++) { const a = Math.random() * 6.283, s = (sp || 160) * (0.5 + Math.random() * 0.9); J.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: 0.35 + Math.random() * 0.3, m: 0, c: cc }); }
          if (J.rings.length < 8) J.rings.push({ x, y, r: 4, l: big ? 0.4 : 0.28, m: 0, c: cc, w: big ? 3 : 2, R: big ? 54 : 30 });
        };
        g.shake = function (m, t) { s0(m, t); if (g.jx && m >= 7) g.jx.freeze = Math.min(0.065, m * 0.005); };
      }
      g.jx = { sparks: [], rings: [], freeze: 0, mt: 0, step: 0, hat: 0 };
      oi.call(def, g);
    };
    def.update = function (g, dt) {
      const J = g.jx; if (!J) return ou.call(def, g, dt);
      for (let i = J.sparks.length - 1; i >= 0; i--) { const p = J.sparks[i]; p.m += dt; if (p.m >= p.l) { J.sparks.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; }
      for (let i = J.rings.length - 1; i >= 0; i--) { const r = J.rings[i]; r.m += dt; if (r.m >= r.l) J.rings.splice(i, 1); }
      // music bed
      J.mt -= dt; if (J.mt <= 0 && !J0.nomusic) {
        const bpm = M[2] * (1 + Math.min(0.25, g.t / 480)), sd = 60 / bpm / 2, root = M[0], sc = M[1];
        for (let i = 0; i < 4; i++) {
          const st = J.step++, d = i * sd;
          if (st % 2 === 0) Kit.tone(mf(root + (st % 16 < 8 ? 0 : st % 16 < 12 ? sc[2] : sc[1])), sd * 1.8, M[3], 0.032, 1, d);
          const deg = sc[(st * 3 + (st >> 2)) % sc.length] + ((st >> 3) % 2 ? 12 : 24);
          if (st % 4 !== 3) Kit.tone(mf(root + deg), sd * 0.8, M[4], 0.011, 1, d);
          if (st % 2 === 1) setTimeout(() => Kit.noise && Kit.noise(0.03, 0.012, 6000), d * 1000);
        }
        J.mt += sd * 4;
      }
      if (J.freeze > 0) { J.freeze -= dt; return; }
      return ou.call(def, g, dt);
    };
    def.draw = function (g, c) {
      od.call(def, g, c); const J = g.jx; const W = g.W, H = g.H;
      if (J) {
        c.save(); c.globalCompositeOperation = 'lighter';
        for (const p of J.sparks) { const a = 1 - p.m / p.l; c.globalAlpha = a; c.strokeStyle = p.c; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); c.stroke(); }
        for (const r of J.rings) { const k = r.m / r.l; c.globalAlpha = (1 - k) * 0.8; c.strokeStyle = r.c; c.lineWidth = r.w * (1 - k) + 0.5; c.beginPath(); c.arc(r.x, r.y, 4 + r.R * Math.sqrt(k), 0, 6.283); c.stroke(); }
        c.restore();
      }
      c.drawImage(vignette(W, H, vig), 0, 0, W, H);
      if (g.state === 'play' && g.t < 0.7) { c.globalAlpha = 1 - g.t / 0.7; c.fillStyle = '#000'; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
    };
    return run.call(this, def);
  };
})();
