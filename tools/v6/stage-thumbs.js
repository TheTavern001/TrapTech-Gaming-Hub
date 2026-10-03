// v6 thumbnails: a few games need a fuller board than a 3-second capture gives. This sets a representative mid-game
// state and lets the REAL game renderer (with the v6 art) draw it, then saves the canvas for tools/build-thumbs.py.
const { chromium } = require('playwright-core'); const fs = require('fs'); const BASE = process.env.BASE || 'http://localhost:8787'; const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const STAGE = {
  'plinko': () => { const G = window.__game; const g = G.g; const x = G.W * 0.52, y = g.pegTop + (G.H - g.pegTop) * 0.42; G.chip = { x, y, vx: 0, vy: 0, mult: 1, nudges: 2, trail: Array.from({ length: 14 }, (_, i) => [x - 30 + i * 2, y - 140 + i * 10]) }; G.pegs.forEach((p, i) => { if (Math.hypot(p.x - x, p.y - y) < 90) p.flash = 1; }); G.score = 2600; },
  'terp-tapper': () => { const G = window.__game; const now = G.playT; G.notes = [[0, 0.3], [1, 0.75], [2, 1.2], [3, 0.5], [1, 1.6], [0, 1.9], [3, 1.4], [2, 0.05]].map(([lane, d]) => ({ lane, t: now + d })); G.score = 4200; G.combo = 18; },
  'stack-2048': () => { const G = window.__game; G.g = [2048, 1024, 512, 256, 4, 128, 64, 32, 2, 8, 16, 4, 0, 2, 8, 2]; G.top = 2048; G.score = 20480; G.fx = {}; },
  'munchies-snake': () => { const G = window.__game; const b = []; const cx = Math.floor(G.cols / 2), cy = Math.floor(G.rows * 0.45);
    for (let i = 0; i < 6; i++) b.push([cx + 3 - i, cy]); for (let j = 1; j <= 3; j++) b.push([cx - 2, cy + j]); for (let i = 1; i <= 5; i++) b.push([cx - 2 + i, cy + 3]); for (let j = 1; j <= 3; j++) b.push([cx + 3, cy + 3 + j]);
    G.body = b; G.dir = 0; G.food = [cx + 6, cy, 1]; G.gold = [cx - 4, cy - 3, 5]; G.score = 230; },
  'high-score': () => { const G = window.__game; G.targets = [{ x: G.W * 0.3, y: G.H * 0.36, R: 50, life: 99, age: 10, type: 'norm', hue: 0.2 }, { x: G.W * 0.7, y: G.H * 0.5, R: 46, life: 99, age: 20, type: 'gold', hue: 0.7 }, { x: G.W * 0.36, y: G.H * 0.66, R: 44, life: 99, age: 30, type: 'bomb', hue: 0.6 }, { x: G.W * 0.72, y: G.H * 0.28, R: 36, life: 99, age: 40, type: 'norm', hue: 0.8 }, { x: G.W * 0.62, y: G.H * 0.78, R: 40, life: 99, age: 10, type: 'norm', hue: 0.1 }]; G.score = 1240; G.combo = 7; },
};
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  for (const [vw, vh, dir] of [[390, 844, '/tmp/frames'], [1280, 720, '/tmp/frames-wide']]) {
    fs.mkdirSync(dir, { recursive: true });
    const ctx = await b.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: vw > 700 ? 1.5 : 2, isMobile: true, hasTouch: true }); const p = await ctx.newPage();
    await p.goto(BASE + '/'); if (await p.$('#gate')) { await p.fill('#gate-m', '05'); await p.fill('#gate-d', '05'); await p.fill('#gate-y', '1990'); await p.click('#gate button[type=submit]'); await p.waitForSelector('.splash, .home, main', { state: 'attached' }); }
    for (const [g, fn] of Object.entries(STAGE)) {
      await p.goto(BASE + '/play/' + g); await p.waitForFunction(() => window.__game && window.__game.running, null, { timeout: 15000 });
      await p.evaluate(() => { const G = window.__game; G.begin(); G.frame = function () { this.draw(); }; }); await p.evaluate(fn); await sleep(1500);
      const data = await p.evaluate(() => document.querySelector('#game').toDataURL('image/png')); fs.writeFileSync(`${dir}/${g}.png`, Buffer.from(data.split(',')[1], 'base64')); console.log('staged', g, dir);
    }
    await ctx.close();
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
