// Night Shift - original dark-field horde survival (Hub build, Survival; ref 20 Minutes Till Dawn). Shared arena.js rules.
// A lone gunner in a pitch-black field: only the flashlight cone and a small lantern radius show the ground; monsters are glowing
// eyes in the dark until they step into the light. Auto-aim gun, XP gems, level-up picks, waves every few seconds, endless.
(function () {
  const WW = 2600, WH = 2600; const fx = [], floats = []; let lastT = 0, GROUND = null, DARK = null;
  function ground() { if (GROUND) return GROUND; const cv = document.createElement('canvas'); cv.width = 520; cv.height = 520; const k = cv.getContext('2d'); k.fillStyle = '#1d2a22'; k.fillRect(0, 0, 520, 520); let s = 11; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 60; i++) { k.fillStyle = 'rgba(' + (R() < 0.5 ? '40,60,42' : '22,32,26') + ',.6)'; k.beginPath(); k.ellipse(R() * 520, R() * 520, 20 + R() * 50, 12 + R() * 30, R() * 3, 0, 7); k.fill(); }
    k.strokeStyle = '#3f6b45'; k.lineWidth = 1.5; for (let i = 0; i < 500; i++) { const x = R() * 520, y = R() * 520; k.beginPath(); k.moveTo(x, y); k.lineTo(x + R() * 4 - 2, y - 4 - R() * 6); k.stroke(); }
    for (let i = 0; i < 14; i++) { const x = R() * 520, y = R() * 520; k.fillStyle = '#4b5563'; k.beginPath(); k.ellipse(x, y, 8 + R() * 10, 5 + R() * 6, 0, 0, 7); k.fill(); k.fillStyle = '#6b7280'; k.beginPath(); k.ellipse(x - 2, y - 2, 5, 3, 0, 0, 7); k.fill(); }
    for (let i = 0; i < 6; i++) { const x = R() * 520, y = R() * 520; k.fillStyle = '#14532d'; for (let j = 0; j < 7; j++) { const a = j / 7 * 6.28; k.beginPath(); k.ellipse(x + Math.cos(a) * 6, y + Math.sin(a) * 6, 7, 2.5, a, 0, 7); k.fill(); } }
    return (GROUND = cv); }
  const SPEC = { eye: { hp: 1, sp: 80, r: 14, c: '#a855f7', v: 10, xp: 1 }, crawler: { hp: 2, sp: 110, r: 13, c: '#ef4444', v: 15, xp: 1, ai: 'dodge' }, brute: { hp: 14, sp: 55, r: 26, c: '#f97316', v: 60, xp: 3 }, spitter: { hp: 5, sp: 60, r: 17, c: '#22d3ee', v: 30, xp: 2, shoot: 2.6 }, wing: { hp: 2, sp: 140, r: 12, c: '#fde047', v: 20, xp: 1, ai: 'dash' }, elder: { hp: 90, sp: 45, r: 44, c: '#e879f9', v: 500, xp: 12, shoot: 1.2 } };
  function monster(c, e, S, g, lit) { const t = e.t, r = S.r; c.save(); c.translate(e.x, e.y);
    if (lit) { const body = { eye: '#3b0764', crawler: '#450a0a', brute: '#431407', spitter: '#083344', wing: '#422006', elder: '#2e1065' }[e.k]; c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(0, r * 0.8, r, r * 0.35, 0, 0, 7); c.fill();
      c.fillStyle = e.fl > 0 ? '#fff' : body; c.beginPath(); for (let i = 0; i <= 18; i++) { const a = i / 18 * 6.283, w = r * (1 + Math.sin(a * 5 + t * 6) * 0.12); i ? c.lineTo(Math.cos(a) * w, Math.sin(a) * w * 0.9) : c.moveTo(Math.cos(a) * w, Math.sin(a) * w * 0.9); } c.fill();
      if (e.k === 'wing') { c.fillStyle = body; for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * r * 0.5, 0); c.quadraticCurveTo(sd * r * 2.2, -r * (1 + Math.sin(t * 20) * 0.6), sd * r * 2, r * 0.4); c.fill(); } }
      if (e.k === 'brute' || e.k === 'elder') { c.strokeStyle = body; c.lineWidth = r * 0.22; c.lineCap = 'round'; for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28 + t; c.beginPath(); c.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); c.quadraticCurveTo(Math.cos(a + 0.4) * r * 1.5, Math.sin(a + 0.4) * r * 1.5, Math.cos(a + Math.sin(t * 3 + i)) * r * 1.8, Math.sin(a + Math.sin(t * 3 + i)) * r * 1.8); c.stroke(); } } }
    // glowing eyes always visible
    const n = e.k === 'elder' ? 5 : e.k === 'brute' ? 3 : e.k === 'eye' ? 1 : 2; c.fillStyle = S.c; c.shadowColor = S.c; c.shadowBlur = lit ? 6 : 12; for (let i = 0; i < n; i++) { const ex = n === 1 ? 0 : (i - (n - 1) / 2) * r * 0.45, er = n === 1 ? r * 0.45 : r * 0.17; c.beginPath(); c.ellipse(ex, -r * 0.15, er, er * (0.6 + 0.4 * Math.abs(Math.sin(t * 0.7 + i))), 0, 0, 7); c.fill(); } c.shadowBlur = 0;
    if (n === 1 && lit) { c.fillStyle = '#000'; c.beginPath(); c.arc(0, -r * 0.15, r * 0.18, 0, 7); c.fill(); }
    if (e.k === 'elder') { c.fillStyle = '#300'; c.fillRect(-40, -r - 16, 80, 6); c.fillStyle = '#e879f9'; c.fillRect(-40, -r - 16, 80 * Math.max(0, e.hp / (e.mhp || e.hp)), 6); }
    c.restore(); }
  function render(g, c) { const dt = Math.min(0.05, Math.max(0, g.t - lastT)); lastT = g.t; const ox = Math.round(g.ox || 0), oy = Math.round(g.oy || 0), p = g.p;
    const G = ground(); const sx = ((-ox % 520) + 520) % 520, sy = ((-oy % 520) + 520) % 520; for (let y = -sy; y < g.H; y += 520) for (let x = -sx; x < g.W; x += 520) c.drawImage(G, x, y);
    // aim (nearest enemy) for flashlight
    let aim = p.face || -1.57, bd = 1e9; for (const e of g.en) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd && d < 520) { bd = d; aim = Math.atan2(e.y - p.y, e.x - p.x); } } p.la = p.la === undefined ? aim : p.la + Math.atan2(Math.sin(aim - p.la), Math.cos(aim - p.la)) * Math.min(1, dt * 10);
    const lx = p.x + ox, ly = p.y + oy;
    c.save(); c.translate(ox, oy);
    for (const m of g.gems) { if (m.pu) continue; const col = m.v > 2 ? '#fde047' : m.v > 1 ? '#86efac' : '#7dd3fc'; c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 10; c.beginPath(); c.moveTo(m.x, m.y - 6); c.lineTo(m.x + 4, m.y); c.lineTo(m.x, m.y + 6); c.lineTo(m.x - 4, m.y); c.fill(); } c.shadowBlur = 0;
    const act = g.en.slice().sort((a, b) => a.y - b.y); const inLight = (e) => { const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy); if (d < 120) return true; const da = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - p.la), Math.cos(Math.atan2(dy, dx) - p.la))); return d < 420 && da < 0.42; };
    for (const e of act) { e.fl = (e.fl || 0) - dt; if (e.mhp === undefined) e.mhp = e.hp; monster(c, e, SPEC[e.k], g, inLight(e)); }
    // gunner
    if (!(p.inv > 0 && Math.sin(g.t * 30) > 0)) { c.save(); c.translate(p.x, p.y); c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.ellipse(0, 14, 13, 5, 0, 0, 7); c.fill(); const mv = Math.hypot(g.ax(), g.ay()), bob = Math.sin(g.t * 14) * 2 * Math.min(1, mv);
      c.fillStyle = '#1f2937'; c.fillRect(-7, 2 + bob * 0.5, 5, 11); c.fillRect(2, 2 - bob * 0.5, 5, 11); c.fillStyle = '#7c2d12'; c.beginPath(); c.roundRect(-10, -14, 20, 18, 5); c.fill(); c.fillStyle = '#16a34a'; c.fillRect(-10, -6, 20, 3);
      c.fillStyle = '#e0ac69'; c.beginPath(); c.arc(0, -20, 7, 0, 7); c.fill(); c.fillStyle = '#111827'; c.beginPath(); c.arc(0, -22, 7.5, Math.PI, 0); c.fill();
      c.rotate(p.la); c.fillStyle = '#374151'; c.fillRect(4, -4, 22, 5); c.fillStyle = '#111'; c.fillRect(8, -2, 6, 7); if (g.cd > g.rate - 0.05) { c.fillStyle = '#fde68a'; c.shadowColor = '#fbbf24'; c.shadowBlur = 16; c.beginPath(); c.moveTo(26, -6); c.lineTo(38, -1.5); c.lineTo(26, 3); c.fill(); c.shadowBlur = 0; } c.restore();
      const w = 40, hp = Math.max(0, g.hp / g.maxhp); c.fillStyle = '#200'; c.fillRect(p.x - w / 2, p.y + 22, w, 5); c.fillStyle = '#ef4444'; c.fillRect(p.x - w / 2 + 1, p.y + 23, (w - 2) * hp, 3); }
    c.strokeStyle = '#fde68a'; c.lineWidth = 2.5; for (const b of g.bl) { c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x - b.vx * 0.025, b.y - b.vy * 0.025); c.stroke(); }
    for (const b of g.eb) { c.fillStyle = '#22d3ee'; c.shadowColor = '#22d3ee'; c.shadowBlur = 12; c.beginPath(); c.arc(b.x, b.y, 6, 0, 7); c.fill(); } c.shadowBlur = 0;
    if (g.orbs) for (let i = 0; i < g.orbs; i++) { const a = g.t * 4 + i / g.orbs * 6.28; c.fillStyle = '#fef08a'; c.shadowColor = '#fde047'; c.shadowBlur = 14; c.beginPath(); c.arc(p.x + Math.cos(a) * 56, p.y + Math.sin(a) * 56, 7, 0, 7); c.fill(); c.shadowBlur = 0; }
    for (const f of fx) { f.l -= dt; f.r += dt * 140; c.strokeStyle = 'rgba(232,121,249,' + Math.max(0, f.l * 2) + ')'; c.lineWidth = 3; c.beginPath(); c.arc(f.x, f.y, f.r, 0, 7); c.stroke(); } for (let i = fx.length - 1; i >= 0; i--) if (fx[i].l <= 0) fx.splice(i, 1);
    c.restore();
    // darkness with flashlight cone + lantern radius (destination-out on an offscreen layer)
    if (!DARK || DARK.width !== g.W || DARK.height !== g.H) { DARK = document.createElement('canvas'); DARK.width = g.W; DARK.height = g.H; }
    const d = DARK.getContext('2d'); d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, g.W, g.H); d.fillStyle = 'rgba(2,4,12,.93)'; d.fillRect(0, 0, g.W, g.H); d.globalCompositeOperation = 'destination-out';
    let rg = d.createRadialGradient(lx, ly, 20, lx, ly, 130); rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = rg; d.fillRect(lx - 130, ly - 130, 260, 260);
    rg = d.createRadialGradient(lx, ly, 30, lx, ly, 430); rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(0.7, 'rgba(0,0,0,.8)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = rg; d.beginPath(); d.moveTo(lx, ly); d.arc(lx, ly, 430, p.la - 0.45, p.la + 0.45); d.closePath(); d.fill();
    c.drawImage(DARK, 0, 0);
    // eyes drawn over darkness so they glow
    c.save(); c.translate(ox, oy); for (const e of act) { const S = SPEC[e.k]; if (inLight(e)) continue; const n = e.k === 'elder' ? 5 : e.k === 'brute' ? 3 : e.k === 'eye' ? 1 : 2; c.fillStyle = S.c; for (let i = 0; i < n; i++) { const ex = n === 1 ? 0 : (i - (n - 1) / 2) * S.r * 0.45, er = n === 1 ? S.r * 0.4 : S.r * 0.16; c.globalAlpha = 0.9; c.beginPath(); c.arc(e.x + ex, e.y - S.r * 0.15, er, 0, 7); c.fill(); } } c.globalAlpha = 1;
    for (const f of floats) { f.l -= dt; f.y -= 30 * dt; c.globalAlpha = Math.min(1, f.l * 2); c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fde68a'; c.fillText(f.t, f.x, f.y); c.globalAlpha = 1; } for (let i = floats.length - 1; i >= 0; i--) if (floats[i].l <= 0) floats.splice(i, 1);
    c.restore();
    // HUD
    c.fillStyle = '#0b0f24'; c.fillRect(0, 0, g.W, 12); const xg = c.createLinearGradient(0, 0, g.W, 0); xg.addColorStop(0, '#7c3aed'); xg.addColorStop(1, '#22d3ee'); c.fillStyle = xg; c.fillRect(2, 2, (g.W - 4) * Math.min(1, g.xp / g.need), 8);
    const t = Math.floor(g.t), tm = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); c.textAlign = 'center'; c.font = 'bold 22px sans-serif'; c.fillStyle = '#e2e8f0'; c.fillText(tm, g.W / 2, 70);
    c.textAlign = 'left'; c.font = 'bold 11px sans-serif'; c.fillStyle = '#c4b5fd'; c.fillText('LV ' + g.lvl + '  \u00b7  \u2620 ' + g.kills, 14, 70);
    c.textAlign = 'right'; c.fillStyle = 'rgba(134,239,172,.55)'; c.font = 'bold 9px sans-serif'; c.fillText('\u2618 NIGHT OWL DISPENSARY 21+', g.W - 10, g.H - 10); }
  function drawChoose(g, c, names) { c.fillStyle = 'rgba(2,4,12,.82)'; c.fillRect(0, 0, g.W, g.H); c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#c4b5fd'; c.fillText('LEVEL UP', g.W / 2, g.H / 2 - 112);
    names.forEach((n, i) => { const y = g.H / 2 - 90 + i * 64, x = g.W / 2 - 150; const bg = c.createLinearGradient(0, y, 0, y + 54); bg.addColorStop(0, '#2e1065'); bg.addColorStop(1, '#0f0a2a'); c.fillStyle = bg; Kit.rr(c, x, y, 300, 54, 8); c.fill(); c.strokeStyle = '#a78bfa'; c.lineWidth = 2; c.stroke(); c.font = 'bold 16px sans-serif'; c.textAlign = 'left'; c.fillStyle = '#fff'; c.fillText((i + 1) + '   ' + n, x + 20, y + 33); }); }
  Arena({ id: 'gl-night-shift', title: 'NIGHT SHIFT', aim: 'auto', xp: true, lives: 6, fireRate: 0.2, bulletSpeed: 760, waveTime: 3.5, hpScale: 0.05, world: { w: WW, h: WH }, speed: 175,
    help: 'Move: WASD / drag. Your gun auto-aims at the nearest monster\nOnly your flashlight shows them - watch for glowing eyes\nGrab gems, level up, survive the night (endless)', theme: { bg: '#020409' }, types: SPEC,
    wave: (g) => { const m = g.wave, o = [['eye', 3 + Math.floor(m * 0.7)]]; if (m > 3) o.push(['crawler', 1 + Math.floor(m / 3)]); if (m > 7) o.push(['wing', Math.floor(m / 4)]); if (m > 10) o.push(['spitter', Math.floor(m / 6)]); if (m % 8 === 0) o.push(['brute', Math.floor(m / 8)]); if (m % 20 === 0) o.push(['elder', 1]); return o; },
    render, drawChoose, hud: false,
    onKill: (g, e, S) => { floats.push({ x: e.x, y: e.y - 18, t: String(S.v), l: 0.6 }); if (floats.length > 50) floats.shift(); if (S.r > 20) { fx.push({ x: e.x, y: e.y, r: 10, l: 0.5 }); g.shake(5, 0.15); } g.burst(e.x + g.ox, e.y + g.oy, [S.c, '#1e1b4b'], 10, 170, 0.45, 3); } });
})();
