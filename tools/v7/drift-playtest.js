// Drift Rush playtest: runs the REAL game module in headless Chromium (fixed 60 fps steps, rendering off) driven by a
// simulated player with human-like limits (reaction delay, perception noise, missed obstacles, imperfect steering).
// Usage: node tools/v7/drift-playtest.js [runs=40] [--assist=0|1] [--skill=avg|good|all]   (dev server must be up on :8787)
const { chromium } = require('playwright-core');
const BASE = process.env.BASE || 'http://localhost:8787';
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? '1']));
const RUNS = +(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 40);
(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] }); const p = await br.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(BASE + '/'); const out = [];
  for (const assist of (args.assist ? [args.assist === '1'] : [true, false])) {
    for (const prof of (args.skill === 'good' ? ['good'] : args.skill === 'avg' ? ['avg'] : ['avg', 'good'])) {
      const res = await p.evaluate(async ({ RUNS, assist, prof }) => {
        const { DriftRush } = await import('/js/games/drift-rush.js'); const PX = 10;
        const c = document.createElement('canvas'); c.style.cssText = 'width:390px;height:844px;position:fixed;left:0;top:0'; document.body.appendChild(c);
        const beta = () => { const g = (k) => { let s = 0; for (let i = 0; i < k * 4; i++) s -= Math.log(Math.random()); return s / 4; }; const a = g(2), b = g(3.2); return a / (a + b); };
        const gauss = () => Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(2 * Math.PI * Math.random());
        const runs = [];
        for (let r = 0; r < RUNS; r++) {
          try { localStorage.setItem('jd_drift_assist', assist ? '1' : '0'); } catch {}
          const g = new DriftRush(c, {}); g.draw = () => {}; await g.ready; g.sfx.muted = true; g.begin(); g.usedTouch = true;
          // average player = skill around the population mean (Beta(2,3.2) mean ~0.38); "good" = 0.7-0.85
          const s = prof === 'avg' ? Math.min(0.55, Math.max(0.2, 0.38 + gauss() * 0.08)) : 0.7 + Math.random() * 0.15;
          const rt = 0.42 - 0.22 * s, noise = 34 - 24 * s, miss = 0.2 - 0.17 * s, look = 0.65 + 0.6 * s, wob = 0.35 - 0.3 * s;
          const hist = []; const seen = new Map(); let hold = 0, holdT = 0, t = 0; const dt = 1 / 60; let hits = 0; const oc = g.crash.bind(g); g.crash = (m) => { if (g.hearts === undefined ? g.hit <= 0 : (g.inv <= 0 && g.boost <= 0 && !g.dying)) hits++; oc(m); };
          while (g.state === 'play' && t < 600) {
            hist.push({ x: g.x, th: g.th, v: g.v, dist: g.dist, items: g.items.map(i => ({ d: i.d, x: i.x, t: i.t, gone: i.gone, id: i })) });
            const k = Math.max(0, hist.length - 1 - Math.round(rt / dt)); const S = hist[k]; if (hist.length > 120) hist.shift();
            holdT -= dt;
            if (holdT <= 0) {
              holdT = 0.05 + Math.random() * 0.05; // decisions every 50-100 ms
              const la = S.v * PX * look; let tx = g.cx(S.dist + la) + gauss() * noise; const hw = g.hw(S.dist + la);
              for (const it of S.items) { if (it.t !== 'cone') continue; const dy = it.d - S.dist; if (dy < 0 || dy > la * 1.3) continue;
                if (!seen.has(it.id)) seen.set(it.id, Math.random() < miss ? 'miss' : 'ok');
                if (seen.get(it.id) === 'miss' && dy > S.v * PX * 0.35) continue; // noticed late
                if (Math.abs(it.x - tx) < 48) { const c0 = g.cx(it.d); const side = it.x > c0 ? -1 : 1; tx = Math.max(c0 - hw + 30, Math.min(c0 + hw - 30, it.x + side * 60)); } }
              const desired = Math.atan2(tx - S.x, Math.max(80, S.v * PX * 0.6)) + gauss() * wob * 0.3; const e = desired - S.th;
              hold = e > 0.07 ? 1 : e < -0.07 ? -1 : 0;
            }
            g.touch = hold ? { 1: hold } : {};
            g.frame(dt); t += dt;
          }
          runs.push({ skill: +s.toFixed(2), secs: +g.playT.toFixed(1), score: Math.floor(g.score), meters: Math.floor(g.meters), hits, endedBy: g.state === 'over' ? 'hearts' : 'cap' });
          g.destroy();
        }
        return runs;
      }, { RUNS, assist, prof });
      const secs = res.map(r => r.secs).sort((a, b) => a - b); const q = (f) => secs[Math.min(secs.length - 1, Math.floor(f * (secs.length - 1) + 0.5))];
      const sc = res.map(r => r.score).sort((a, b) => a - b); const qs = (f) => sc[Math.min(sc.length - 1, Math.floor(f * (sc.length - 1) + 0.5))];
      const row = { assist, player: prof, runs: res.length, medianSecs: q(0.5), p25Secs: q(0.25), p75Secs: q(0.75), meanSecs: +(secs.reduce((a, b) => a + b, 0) / secs.length).toFixed(1), pctAtLeast45s: Math.round(100 * secs.filter(x => x >= 45).length / secs.length), medianScore: qs(0.5), bestScore: qs(1), crashesPerMin: +(res.reduce((a, r) => a + r.hits, 0) / (res.reduce((a, r) => a + r.secs, 0) / 60)).toFixed(2), maxRate: Math.max(...res.map(r => r.score / Math.max(5, r.secs))).toFixed(1) };
      console.log(JSON.stringify(row)); out.push({ ...row, sample: res.slice(0, 5) });
    }
  }
  if (args.out) require('fs').writeFileSync(args.out, JSON.stringify(out, null, 2));
  await br.close();
})().catch(e => { console.error(e); process.exit(1); });
