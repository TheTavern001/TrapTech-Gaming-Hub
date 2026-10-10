// v7 game runner: loads a real game module in headless Chrome (phone viewport, DPR 2), plays it with a scripted bot for N
// simulated seconds (fixed 60 fps steps, rendering on), reports errors / score / run length, and can save canvas screenshots.
// Usage: node tools/v7/game-run.js <id> [secs=60] [--shot=path.png@t] [--seed=hex]
const { chromium } = require('playwright-core');
const cfg = require('../../src/config');
const BASE = process.env.BASE || 'http://localhost:8787';
const BOTS = {
  stack: `(g) => { if (g.cur && g.state === 'play') { const p = g.top(); const k = g.cur.axis === 'x' ? 'x' : 'z'; if (Math.abs(g.cur[k] - p[k]) < 0.02 + Math.random() * 0.06 && Math.random() < 0.5) g.drop(); } }`,
  'munchies-snake': `(g) => { const h = g.player.pts[0]; let best = null, bd = 1e9; for (const f of g.food) { const d = (f.x - h[0]) ** 2 + (f.y - h[1]) ** 2; if (d < bd) { bd = d; best = f; } }
    let a = best ? Math.atan2(best.y - h[1], best.x - h[0]) : 0; if (Math.hypot(h[0], h[1]) > 1350) a = Math.atan2(-h[1], -h[0]);
    for (const off of [0, 0.6, -0.6, 1.2, -1.2]) { const aa = g.player.a + off; if (!g.hitsBody(g.player, g.grid(), h[0] + Math.cos(aa) * 70, h[1] + Math.sin(aa) * 70, 14)) { if (off) a = aa; break; } }
    const sx = g.W / 2 + Math.cos(a) * 120, sy = g.H / 2 + Math.sin(a) * 120; g.ptr = [sx, sy]; }`,
  'void-swarm': `(g) => { let tx = g.W / 2; const e = g.enemies.filter(e => e.mode !== 'enter').sort((a, b) => Math.abs(a.x - g.px) - Math.abs(b.x - g.px))[0]; if (e) tx = e.x; if (g.boss) tx = g.boss.x;
    for (const b of g.bolts) if (Math.abs(b.x - g.px) < 30 && b.y < g.py && b.y > g.py - 160) tx = g.px + (b.x < g.px ? 70 : -70); for (const p of g.pus) if (p.y > g.H * 0.5) tx = p.x;
    g.px += Math.max(-6, Math.min(6, tx - g.px)); }`,
  'brick-breaker': `(g) => { const b = g.balls.filter(b => !b.stuck).sort((a, c) => c.y - a.y)[0]; if (g.balls.some(b => b.stuck)) g.launch(); const tx = b ? b.x + (Math.random() - 0.5) * 30 : g.W / 2; g.px += Math.max(-9, Math.min(9, tx - g.px)); }`,
  'blazed-roulette': `(g) => { if (!g.ball && !g.over) { if (g.total() < g.tmin()) { g.chip = 25; g.placeBet(Math.random() < 0.5 ? 'red' : 'black'); g.placeBet('d2'); } else if (Math.random() < 0.02) g.drop(); } }`,
  'grow-guard': `(g) => { for (const d of g.drops) if (!d.got && Math.random() < 0.05) g.onDown(d.x, d.y); if (Math.random() < 0.03) { const order = ['solar', 'launcher', 'launcher', 'trap', 'zapper', 'mister']; const k = order[Math.floor(Math.random() * order.length)]; if (g.light >= ({ solar: 50, launcher: 100, trap: 50, zapper: 175, mister: 125 })[k]) { const r = Math.floor(Math.random() * 5), c = k === 'solar' ? 0 : k === 'trap' ? 5 : 1 + Math.floor(Math.random() * 3); g.sel = k; g.onDown(g.cx(c), g.cy(r)); g.sel = null; } } }`,
  'sling-smash': `(g) => { if (!g.ball && !g.aim && g.next <= 0 && g.balls > 0 && g.settle <= 0 && !g.over) { const o = g.bots.find(o => o.alive); if (!o) return; g.onDown(g.sx, g.sy); const best = []; let bd = 1e9, bp = null; for (let a = 0.3; a < 1.3; a += 0.04) for (let m = 60; m <= 110; m += 10) { const dx = -Math.cos(a) * m, dy = Math.sin(a) * m; let x = g.sx, y = g.sy, vx = -dx * 7.2, vy = -dy * 7.2; for (let i = 0; i < 300; i++) { vy += 900 / 240; vx += g.wind / 240; x += vx / 240; y += vy / 240; const d = Math.hypot(x - o.x, y - o.y); if (d < bd) { bd = d; bp = [dx, dy]; } if (y > g.ground) break; } } const e = (Math.random() - 0.5) * 14; g.aim = [g.sx + bp[0] + e, g.sy + bp[1] + e]; g.onUp(); } }`,
  'haze-defense': `(g) => { if (Math.random() < 0.02) { const free = g.pads.filter(p => !p.t); const built = g.pads.filter(p => p.t && p.t.lv < 3); const ks = ['dart', 'dart', 'fan', 'prism', 'frost']; const k = ks[Math.floor(Math.random() * ks.length)];
    if (free.length && g.cash >= ({ dart: 100, fan: 160, prism: 260, frost: 120 })[k]) { g.sel = k; const p = free[Math.floor(Math.random() * free.length)]; g.onDown(p.x, p.y); g.sel = null; } else if (built.length && g.cash > 300) { const p = built[0]; g.onDown(p.x, p.y); } } }`,
  'drift-rush': `(g) => { const la = g.dist + g.v * 6; const tx = g.cx(la); const d = Math.atan2(tx - g.x, 300) - g.th; g.touch = d > 0.07 ? { 1: 1 } : d < -0.07 ? { 1: -1 } : {}; }`,
  plinko: `(g) => { if (!g.chip && g.left > 0 && Math.random() < 0.05) { g.onDown(g.g.bx + Math.random() * g.g.bw, g.g.top || 120); g.onUp(); } }`,
  'spin-to-win': `(g) => { if (!g.spin && g.resultT <= 0 && !g.charging && Math.random() < 0.05) g.onDown(); else if (g.charging && Math.random() < 0.04) g.onUp(); }`,
  'memory-match': `(g) => { if (g.peek > 0 || g.lock > 0 || g.clearT > 0 || Math.random() > 0.035) return; const open = g.cards.filter(c => !c.done && !c.open); if (!open.length) return; const s = g.sel[0];
    let c = open[Math.floor(Math.random() * open.length)]; if (s && Math.random() < 0.8) c = open.find(o => o.g === s.g) || c; else if (!s && Math.random() < 0.3) c = open[0]; const [x, y, w, h] = g.rect(c.k); g.onDown(x + w / 2, y + h / 2); }`,
  'high-score': `(g) => { for (const t of g.targets) if (t.type !== 'bomb' && t.age > 0.35 + Math.random() * 0.25 && Math.random() < 0.25) { g.onDown(t.x + (Math.random() - 0.5) * 10, t.y + (Math.random() - 0.5) * 10); break; } if (Math.random() < 0.0015) g.onDown(g.W / 2, g.H / 2); }`,
  'terp-tapper': `(g) => { for (const n of g.notes) if (!n.done && Math.abs(g.playT - n.t) < 0.03 + Math.random() * 0.08 && Math.random() < 0.5) { if (Math.random() < 0.985) g.hit(n.lane); n._b = 1; } }`,
  'sky-hopper': `(g) => { const p = g.pipes.find(p => p.x - g.x + 74 > g.hx - 22); const ty = p ? p.top + p.g * 0.64 + (Math.random() - 0.5) * 16 : g.H * 0.5; if ((g.y > ty && g.vy > 0) || (g.y > ty + 40 && g.vy > -400)) g.flap(); }`,
};
(async () => {
  const [id, secsArg] = process.argv.slice(2); const secs = +(secsArg || 60); const opt = Object.fromEntries(process.argv.slice(4).map(a => a.replace(/^--/, '').split('=')));
  const g = cfg.GAME_MAP[id]; if (!g) throw new Error('unknown game ' + id);
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] }); const p = await br.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = []; p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(BASE + '/'); await p.addStyleTag({ content: 'body>*{display:none!important} #gc{display:block!important;position:fixed;inset:0;width:390px;height:844px;z-index:99}' });
  const shots = (opt.shot || '').split(',').filter(Boolean).map(s => { const [f, t] = s.split('@'); return { f, t: +t }; }).sort((a, b) => a.t - b.t);
  await p.evaluate(async ({ mod, cls, seed }) => { const c = document.createElement('canvas'); c.id = 'gc'; document.body.appendChild(c); const M = await import('/js/' + mod); window.G = new M[cls](c, { seed }); await window.G.ready; window.G.sfx.muted = true; window.G.begin(); }, { mod: g.module, cls: g.cls, seed: opt.seed || '' });
  const bot = BOTS[id] || '() => {}'; let t = 0; const step = 5; const res = { id, secs, errors };
  while (t < secs) {
    const next = Math.min(secs, t + step, shots.length ? Math.max(t + 1 / 60, shots[0].t) : secs);
    const r = await p.evaluate(({ dur, bot }) => { const g = window.G; const b = eval(bot); let n = Math.round(dur * 60); let fps = 0; const t0 = performance.now();
      for (let i = 0; i < n && g.state === 'play'; i++) { try { b(g); } catch (e) { return { err: String(e && e.stack || e) }; } g.frame(1 / 60); }
      return { state: g.state, score: Math.floor(g.score || 0), playT: g.playT, wave: g.wave, lives: g.lives, kills: g.kills, msPerFrame: (performance.now() - t0) / Math.max(1, n) }; }, { dur: next - t, bot });
    if (r.err) { errors.push(r.err); break; } Object.assign(res, r); t = next; if (opt.trace) console.error(JSON.stringify({ t: Math.round(t), score: r.score, wave: r.wave, lives: r.lives }));
    while (shots.length && shots[0].t <= t + 1e-6) { const s = shots.shift(); await p.evaluate(() => window.G.draw()); await p.locator('#gc').screenshot({ path: s.f }); }
    if (r.state !== 'play') break;
  }
  // v7 anti-cheat: check this run's L3 event log / L4 replay with the real server rules
  const L = require('../../src/ac-levels'); await L.stackReady;
  const fin = await p.evaluate(() => ({ ev: window.G.evOut(), log: window.G.log, score: Math.floor(window.G.score || 0), playT: window.G.playT }));
  if ((cfg.GAME_MAP[id].acLevel || 2) >= 3) { const c = L.checkEvents(id, fin.ev, fin.score, fin.playT + 1); res.l3 = c.missing ? (fin.score ? 'missing' : 'empty') : c.ok ? `ok (${c.n} events)` : 'FAIL: ' + c.why; if (fin.score && !c.ok) errors.push('L3 ' + res.l3); }
  if (id === 'stack') { const r = L.replayStack(fin.log, fin.score, fin.playT + 1); res.l4 = r.ok ? `ok (${r.slabs} slabs)` : 'FAIL: ' + r.why; if (!r.ok) errors.push('L4 ' + res.l4); }
  res.evBytes = JSON.stringify(fin.ev || {}).length;
  console.log(JSON.stringify(res)); await br.close(); process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
