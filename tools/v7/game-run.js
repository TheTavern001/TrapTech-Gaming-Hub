// v7 game runner: loads a real game module in headless Chrome (phone viewport, DPR 2), plays it with a scripted bot for N
// simulated seconds (fixed 60 fps steps, rendering on), reports errors / score / run length, and can save canvas screenshots.
// Usage: node tools/v7/game-run.js <id> [secs=60] [--shot=path.png@t] [--seed=hex]
const { chromium } = require('playwright-core');
const cfg = require('../../src/config');
const BASE = process.env.BASE || 'http://localhost:8787';
const BOTS = require('./bots');
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
