// usage: node impostors2.js <outdir> spec...   spec = id:part:yawDeg  (part '-' = whole model)
const { chromium } = require('../node_modules/playwright-core'); const fs = require('fs');
(async () => {
  const [out, ...specs] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage(); await p.goto('http://127.0.0.1:8792/index.html'); await p.waitForFunction(() => window.ready, null, { timeout: 30000 });
  const meta = fs.existsSync(out + '/meta2.json') ? JSON.parse(fs.readFileSync(out + '/meta2.json')) : {};
  for (const sp of specs) { const [id, part, yaw] = sp.split(':'); const r = await p.evaluate(([id, part, yaw]) => window.renderImpostor(`/ph/${id}/${id}_1k.gltf`, yaw * Math.PI / 180, 1024, part === '-' ? null : +part), [id, part, +yaw]);
    const name = `${id}-${part === '-' ? 'all' : part}-${yaw}`; fs.writeFileSync(`${out}/${name}.png`, Buffer.from(r.png.split(',')[1], 'base64')); meta[name] = { w: +r.w.toFixed(2), h: +r.h.toFixed(2), groups: r.groups }; console.log(name, JSON.stringify(meta[name])); }
  fs.writeFileSync(out + '/meta2.json', JSON.stringify(meta, null, 1)); await b.close();
})();
