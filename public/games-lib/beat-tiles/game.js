// Beat Tiles - original Piano Tiles-style tap rhythm game (Hub build). Four lanes of tiles scroll down; tap each dark tile in order
// before it leaves the bottom. Long tiles must be held to the end. Tapping an empty lane or letting a tile pass ends the run.
// Endless: scroll speed ramps every 25 tiles. Each tap plays the next note of a looping original melody (WebAudio synth).
(function () {
  const L = 4, TH = 168, MEL = [64, 67, 71, 72, 71, 67, 64, 62, 60, 64, 67, 69, 67, 64, 62, 60, 57, 60, 64, 65, 64, 60, 59, 55, 57, 60, 62, 64, 62, 59, 57, 55];
  let AC = null; function note(m, dur) { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const t = AC.currentTime, f = 440 * Math.pow(2, (m - 69) / 12); const gn = AC.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.22, t + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.6)); gn.connect(AC.destination);
    for (const [k, ty, a] of [[1, 'triangle', 1], [2, 'sine', 0.35], [3, 'sine', 0.12]]) { const o = AC.createOscillator(), g2 = AC.createGain(); o.type = ty; o.frequency.value = f * k; g2.gain.value = a; o.connect(g2); g2.connect(gn); o.start(t); o.stop(t + (dur || 0.6) + 0.05); } } catch (e) {} }
  let BG = null;
  function bg(W, H) { if (BG) return BG; const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'); const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f5f3ff'); g.addColorStop(1, '#dde3f5'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let i = 1; i < L; i++) { c.fillStyle = 'rgba(80,90,140,.18)'; c.fillRect(i * W / L - 1, 0, 2, H); }
    const hl = c.createLinearGradient(0, H - 150, 0, H); hl.addColorStop(0, 'rgba(124,92,255,0)'); hl.addColorStop(1, 'rgba(124,92,255,.12)'); c.fillStyle = hl; c.fillRect(0, H - 150, W, 150);
    c.fillStyle = 'rgba(60,70,120,.25)'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.fillText('BEAT TILES \u00b7 \u2618 GREEN ROOM SESSIONS 21+', W / 2, H - 6); return (BG = cv); }
  function addRow(g) { const last = g.tiles[g.tiles.length - 1]; let ln; do ln = g.RI(0, L - 1); while (last && ln === last.ln && g.rnd() < 0.7); const long = g.made > 12 && g.rnd() < 0.14; const h = long ? TH * g.RI(2, 3) : TH; const y = (last ? last.y - h : -h); g.tiles.push({ ln, y, h, long, hit: false, held: 0, n: g.ni++ }); }
  Kit.run({ id: 'gl-beat-tiles', title: 'BEAT TILES', help: 'Tap the dark tiles in order, bottom to top (or D F J K)\nHold long tiles to the end. Never tap white space', bg: '#f5f3ff',
    init(g) { g.tiles = []; g.ni = 0; g.made = 0; g.sp = 420; g.fx = []; g.hold = null; g.ring = []; for (let i = 0; i < 6; i++) addRow(g); for (const t of g.tiles) t.y += g.H - 110; g.go = false; g.hud = ''; },
    update(g, dt) { const W = g.W, H = g.H, lw = W / L;
      const taps = []; if (g.ptr.pressed) taps.push([Math.floor(g.ptr.x / lw), g.ptr.y]); ['d', 'f', 'j', 'k'].forEach((k, i) => { if (g.kd(k)) taps.push([i, null]); });
      const next = g.tiles.find(t => !t.hit);
      for (const [ln, y] of taps) { if (!g.go) g.go = true; if (!next) break;
        const inTile = y == null ? next.y + next.h > 40 : (y >= next.y - 30 && y <= next.y + next.h + 30);
        if (ln === next.ln && inTile) { next.hit = true; g.made++; g.mark('t', g.made); note(MEL[next.n % MEL.length], next.long ? 1.2 : 0.6); const off = (next.y + next.h) / H; const acc = Math.max(0, 1 - Math.abs(off - 0.78) * 2.2); g.add(1 + Math.round(acc * 2), 'tile'); g.ring.push({ x: ln * lw + lw / 2, y: Math.min(H - 60, next.y + next.h - 40), l: 0.35 }); if (next.long) g.hold = { t: next, k: y == null ? ['d', 'f', 'j', 'k'][ln] : null };
          if (g.made % 25 === 0) { g.sp *= 1.08; g.float(W / 2, 200, 'TEMPO UP', '#7c5cff', 26); } }
        else { g.miss = { ln, y: y == null ? H - 120 : y, t: 0 }; g.sfx('bad'); g.shake(8); return g.end('Wrong note'); } }
      if (g.hold) { const t = g.hold.t, down = g.hold.k ? g.keys[g.hold.k] : g.ptr.down; if (down) { const prog = Math.max(0, Math.min(1, ((t.y + t.h) - (H - 140)) / t.h)); if (prog > (t.p || 0)) { const dd = prog - (t.p || 0); t.p = prog; g.acc2 = (g.acc2 || 0) + dd * t.h; while (g.acc2 > 40) { g.acc2 -= 40; g.add(1, 'hold'); } } if (prog >= 0.98) { g.hold = null; g.add(3, 'long'); g.float(t.ln * lw + lw / 2, H - 200, 'PERFECT HOLD', '#7c5cff', 16); } } else { g.hold = null; } }
      if (g.go) { for (const t of g.tiles) t.y += g.sp * dt; } while (g.tiles.length < 9 || g.tiles[g.tiles.length - 1].y > -TH * 2) addRow(g);
      for (const t of g.tiles) if (!t.hit && t.y > H) { g.miss = { ln: t.ln, y: H - 80, t: 0 }; for (const u of g.tiles) u.y -= TH * 0.8; g.sfx('bad'); g.shake(8); return g.end('Missed a tile'); }
      g.tiles = g.tiles.filter(t => t.y < H + 20); for (const r of g.ring) r.l -= dt; g.ring = g.ring.filter(r => r.l > 0); },
    draw(g, c) { const W = g.W, H = g.H, lw = W / L; c.drawImage(bg(W, H), 0, 0);
      for (const t of g.tiles) { const x = t.ln * lw + 2; if (t.hit && !t.long) { c.fillStyle = 'rgba(124,92,255,.14)'; Kit.rr(c, x, t.y + 2, lw - 4, t.h - 4, 8); c.fill(); continue; }
        const gr = c.createLinearGradient(0, t.y, 0, t.y + t.h); gr.addColorStop(0, t.long ? '#3b2a7a' : '#20242f'); gr.addColorStop(1, t.long ? '#1a1240' : '#0a0c12'); c.fillStyle = 'rgba(0,0,0,.18)'; Kit.rr(c, x + 3, t.y + 6, lw - 4, t.h - 4, 8); c.fill(); c.fillStyle = gr; Kit.rr(c, x, t.y + 2, lw - 4, t.h - 4, 8); c.fill(); c.fillStyle = 'rgba(255,255,255,.08)'; Kit.rr(c, x + 6, t.y + 8, lw - 16, 10, 5); c.fill();
        if (t.long) { const p = t.p || 0; if (p > 0) { const fg = c.createLinearGradient(0, t.y + t.h, 0, t.y); fg.addColorStop(0, '#7c5cff'); fg.addColorStop(1, '#22d3ee'); c.fillStyle = fg; Kit.rr(c, x + lw / 2 - 12, t.y + t.h * (1 - p), 20, t.h * p - 6, 10); c.fill(); } c.fillStyle = '#c4b5fd'; c.beginPath(); c.arc(x + lw / 2 - 2, t.y + t.h - 30, 7, 0, 7); c.fill(); }
        if (t === g.tiles.find(u => !u.hit) && !g.go) { c.fillStyle = '#fff'; c.font = 'bold 16px sans-serif'; c.textAlign = 'center'; c.fillText('START', x + lw / 2 - 2, t.y + t.h / 2 + 6); } }
      for (const r of g.ring) { c.strokeStyle = 'rgba(124,92,255,' + r.l * 2.6 + ')'; c.lineWidth = 4; c.beginPath(); c.arc(r.x, r.y, (0.35 - r.l) * 160 + 10, 0, 7); c.stroke(); }
      if (g.miss) { c.fillStyle = 'rgba(239,68,68,' + (0.5 + Math.sin(g.t * 20) * 0.3) + ')'; c.fillRect(g.miss.ln * lw, g.miss.y - TH / 2, lw, TH); } },
    hudDraw(g, c) { c.textAlign = 'center'; c.font = 'bold 40px sans-serif'; c.fillStyle = '#ef4444'; c.shadowColor = 'rgba(0,0,0,.2)'; c.shadowBlur = 6; c.fillText(String(Math.floor(g.score)), g.W / 2, 56); c.shadowBlur = 0; c.font = 'bold 11px sans-serif'; c.fillStyle = '#6b5ab8'; c.fillText(g.made + ' TILES  \u00b7  ' + (g.sp / 420).toFixed(2) + 'x TEMPO', g.W / 2, 74); } });
})();
