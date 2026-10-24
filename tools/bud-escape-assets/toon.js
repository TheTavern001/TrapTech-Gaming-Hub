// usage: node toon.js <specs.json> <out dir>   (toon.html served at http://127.0.0.1:8794/ with /vendor and the model folders)
// Renders every spec in specs.json ({ name: { parts: [...], yaw, pitch, roll, size } }) to <out dir>/<name>.png.
const { chromium } = require('../node_modules/playwright-core'); const fs = require('fs');
(async () => { const [specFile, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true }); const specs = JSON.parse(fs.readFileSync(specFile, 'utf8'));
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8794/toon.html'); await p.waitForFunction(() => window.ready, null, { timeout: 30000 });
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  for (const [name, spec] of Object.entries(specs)) { if (only && !only.includes(name)) continue; const r = await p.evaluate((s) => window.render(s), spec); fs.writeFileSync(`${out}/${name}.png`, Buffer.from(r.png.split(',')[1], 'base64')); console.log(name, r.w.toFixed(2), r.h.toFixed(2)); }
  if (errs.length) console.log(errs.slice(0, 5).join('\n')); await b.close(); })();
