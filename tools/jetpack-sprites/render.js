// usage: node render.js <outdir>  (render.html served on 127.0.0.1:8793). Renders the pilot frames: run (Sprint_Loop x8), fly (Jump_Loop x4, leaning forward), die (Death01 x6) -> PNGs
const { chromium } = require('../node_modules/playwright-core'); const fs = require('fs');
(async () => { const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8793/render.html'); await p.waitForFunction(() => window.ready, null, { timeout: 30000 });
  console.log('anims', await p.evaluate(() => window.setup()));
  const plan = [['run', 'Sprint_Loop', 8, 0, 0.667, 0], ['fly', 'Jump_Loop', 4, 0.6, 1.9, -0.32], ['die', 'Death01', 6, 0, 2.2, 0]];
  const frames = [];
  for (const [name, clip, n, t0, t1, tilt] of plan) for (let i = 0; i < n; i++) { const t = t0 + (t1 - t0) * (n === 1 ? 0 : i / (name === 'run' ? n : n - 1)); const png = await p.evaluate(([c, t, tilt]) => window.frame(c, t, tilt), [clip, t, tilt]); const f = `${out}/${name}-${i}.png`; fs.writeFileSync(f, Buffer.from(png.split(',')[1], 'base64')); frames.push(f); }
  console.log(frames.length, 'frames', errs.slice(0, 3).join(' | ')); await b.close(); })();
