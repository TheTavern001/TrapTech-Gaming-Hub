// usage: node svg2png.js <out.png> <size> <in.svg>
const { chromium } = require('../node_modules/playwright-core'); const fs = require('fs');
(async () => { const [out, size, src] = process.argv.slice(2); const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage(); const svg = fs.readFileSync(src, 'utf8');
  await p.setContent(`<html><body style="margin:0;background:transparent"><img id=i style="max-width:${size}px;max-height:${size}px" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body></html>`);
  await p.waitForFunction(() => document.getElementById('i').complete); const el = await p.$('#i'); await el.screenshot({ path: out, omitBackground: true }); await b.close(); })();
