// Glow Echo - original Simon-style memory game (Hub build, Puzzle & Brain). Watch the pads light up, then repeat the sequence.
// Each round adds one step and plays a bit faster; from round 8 a fifth pad joins in the centre, and from round 14 the pads swap
// places at the start of each round. Quick answers pay a speed bonus. One wrong pad ends the run.
(function () {
  const COLS = [['#22c55e', '#bbf7d0'], ['#ef4444', '#fecaca'], ['#facc15', '#fef9c3'], ['#3b82f6', '#bfdbfe'], ['#a855f7', '#e9d5ff']], NOTES = [64, 69, 73, 76, 81];
  let AC = null; function tone(m, d) { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const t = AC.currentTime, o = AC.createOscillator(), o2 = AC.createOscillator(), gn = AC.createGain(); o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = 440 * Math.pow(2, (m - 69) / 12); o2.frequency.value = o.frequency.value * 2; gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.2, t + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(gn); o2.connect(gn); gn.connect(AC.destination); o.start(t); o2.start(t); o.stop(t + d + 0.05); o2.stop(t + d + 0.05); } catch (e) {} }
  const CX = 200, CY = 380, RO = 165, RI = 62;
  function padAt(g, x, y) { const dx = x - CX, dy = y - CY, d = Math.hypot(dx, dy); if (g.n5 && d < RI - 4) return 4; if (d < RI || d > RO + 10) return -1; const a = (Math.atan2(dy, dx) + Math.PI * 2.75) % (Math.PI * 2); return g.map[Math.floor(a / (Math.PI / 2))]; }
  function drawPad(c, g, slot, col, lit) { const a0 = -Math.PI * 0.75 + slot * Math.PI / 2 + 0.06, a1 = a0 + Math.PI / 2 - 0.12; const [base, hi] = COLS[col]; c.save(); c.shadowColor = base; c.shadowBlur = lit ? 50 : 0;
    const gr = c.createRadialGradient(CX, CY, RI, CX, CY, RO); gr.addColorStop(0, lit ? hi : base); gr.addColorStop(1, lit ? base : shade(base)); c.fillStyle = gr; c.globalAlpha = lit ? 1 : 0.55; c.beginPath(); c.arc(CX, CY, RO, a0, a1); c.arc(CX, CY, RI + 8, a1, a0, true); c.closePath(); c.fill(); c.restore();
    c.strokeStyle = 'rgba(255,255,255,' + (lit ? 0.7 : 0.15) + ')'; c.lineWidth = 2; c.beginPath(); c.arc(CX, CY, RO - 8, a0 + 0.05, a1 - 0.05); c.stroke(); }
  function shade(h) { const n = parseInt(h.slice(1), 16); const f = (v) => Math.floor(v * 0.35); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
  function nextRound(g) { g.round++; g.mark('r', g.round); if (g.round >= 8) g.n5 = true; g.seq.push(g.RI(0, g.n5 ? 4 : 3)); if (g.round >= 14) { const m = g.map.slice(); for (let i = 3; i > 0; i--) { const j = g.RI(0, i); [m[i], m[j]] = [m[j], m[i]]; } g.map = m; g.swapT = 0.8; }
    g.phase = 'show'; g.si = 0; g.st = 0.7; g.step = Math.max(0.24, 0.62 - g.round * 0.018); g.inp = 0; }
  Kit.run({ id: 'gl-glow-echo', title: 'GLOW ECHO', help: 'Watch the pads light up, then tap them back in the same order (keys 1-5)\nEach round adds a step and speeds up. Pads move from round 14', bg: '#05060f',
    init(g) { g.round = 0; g.seq = []; g.map = [0, 1, 2, 3]; g.n5 = false; g.lit = -1; g.litT = 0; g.fx = []; g.hud = ''; nextRound(g); },
    update(g, dt) { g.litT -= dt; if (g.litT <= 0) g.lit = -1; if (g.swapT > 0) g.swapT -= dt;
      if (g.phase === 'show') { g.st -= dt; if (g.st <= 0) { if (g.si >= g.seq.length) { g.phase = 'input'; g.inT = 0; return; } const p = g.seq[g.si++]; g.lit = p; g.litT = g.step * 0.7; tone(NOTES[p], g.step * 0.7); g.st = g.step; } return; }
      if (g.phase === 'wait') { g.st -= dt; if (g.st <= 0) nextRound(g); return; }
      g.inT += dt; let pick = -1; if (g.ptr.pressed) pick = padAt(g, g.ptr.x, g.ptr.y); for (let i = 0; i < 5; i++) if (g.kd(String(i + 1)) && (i < 4 ? true : g.n5)) pick = i < 4 ? g.map[i] : 4;
      if (pick < 0) return; g.lit = pick; g.litT = 0.18; if (pick !== g.seq[g.inp]) { tone(40, 0.6); g.sfx('bad'); g.shake(8); g.wrong = { p: pick, want: g.seq[g.inp] }; return g.end('Wrong pad'); }
      tone(NOTES[pick], 0.25); g.inp++; const sp = Math.max(0, 1 - g.inT / 1.2); g.add(10 + Math.round(sp * 10), 'pad'); g.inT = 0;
      if (g.inp >= g.seq.length) { g.add(g.round * 25, 'round'); g.float(CX, CY - 4, 'ROUND ' + g.round + ' \u2713', '#9dff7a', 20); g.sfx('coin'); g.phase = 'wait'; g.st = 0.8; for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283; g.fx.push({ x: CX + Math.cos(a) * RO, y: CY + Math.sin(a) * RO, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, l: 0.6 }); } } },
    draw(g, c) { const bg = c.createRadialGradient(CX, CY, 40, CX, CY, 520); bg.addColorStop(0, '#1a1440'); bg.addColorStop(1, '#03030a'); c.fillStyle = bg; c.fillRect(0, 0, g.W, g.H);
      c.fillStyle = '#0b0b16'; c.beginPath(); c.arc(CX, CY, RO + 16, 0, 7); c.fill(); c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 3; c.stroke();
      const sw = g.swapT > 0 ? Math.sin(g.swapT / 0.8 * Math.PI) * 0.4 : 0; c.save(); c.translate(CX, CY); c.rotate(sw); c.translate(-CX, -CY); for (let s = 0; s < 4; s++) drawPad(c, g, s, g.map[s], g.lit === g.map[s]); c.restore();
      const lit5 = g.lit === 4; c.fillStyle = g.n5 ? (lit5 ? '#e9d5ff' : '#3b1d5a') : '#141428'; c.shadowColor = '#a855f7'; c.shadowBlur = lit5 ? 50 : 0; c.beginPath(); c.arc(CX, CY, RI - 2, 0, 7); c.fill(); c.shadowBlur = 0;
      c.fillStyle = g.n5 ? '#fff' : '#9dff7a'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.fillText(String(g.round), CX, CY + 4); c.font = 'bold 9px sans-serif'; c.fillStyle = 'rgba(255,255,255,.6)'; c.fillText(g.phase === 'show' ? 'WATCH' : g.phase === 'input' ? 'YOUR TURN ' + g.inp + '/' + g.seq.length : '\u2713', CX, CY + 22);
      for (const f of g.fx) { f.x += f.vx / 60; f.y += f.vy / 60; f.l -= 1 / 60; c.fillStyle = 'rgba(157,255,122,' + f.l * 1.5 + ')'; c.beginPath(); c.arc(f.x, f.y, 3, 0, 7); c.fill(); } g.fx = g.fx.filter(f => f.l > 0);
      c.fillStyle = 'rgba(157,255,122,.4)'; c.font = 'bold 9px sans-serif'; c.fillText('\u2618 GLOW LOUNGE ARCADE \u00b7 21+', CX, g.H - 10); },
    hudDraw(g, c) { c.textAlign = 'left'; c.font = 'bold 22px sans-serif'; c.fillStyle = '#fff'; c.fillText(Math.floor(g.score).toLocaleString('en-US'), 14, 32); c.font = 'bold 11px sans-serif'; c.fillStyle = '#c4b5fd'; c.fillText('ROUND ' + g.round + (g.n5 ? '  \u00b7  5 PADS' : '') + (g.round >= 14 ? '  \u00b7  SHUFFLE' : ''), 14, 48); } });
})();
