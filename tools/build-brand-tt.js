// Rasterize the vector Trap Tech logo (tools/build-brand-tt.py -> public/assets/brand/tt-*.svg) to the PNG/WebP sizes the site uses.
// cd tools && node build-brand-tt.js   (needs Chrome + python3 PIL for WebP)
const { chromium } = require('playwright-core'); const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const B = path.join(__dirname, '..', 'public', 'assets', 'brand');
const JOBS = { mono: { h: [40, 80, 192, 512] }, horizontal: { w: [180, 360, 920] }, lockup: { w: [300, 600] }, chrome: { w: [280, 560] }, badge: { w: [128, 256] } };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] }); const p = await b.newPage();
  const shoot = async (svgFile, w, h, out) => { const s = fs.readFileSync(path.join(B, svgFile), 'utf8'); await p.setViewportSize({ width: w, height: h });
    await p.setContent(`<html><body style="margin:0;background:transparent"><img style="display:block;width:${w}px;height:${h}px" src="data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}"></body></html>`);
    await p.waitForTimeout(80); await p.screenshot({ path: out, omitBackground: true }); };
  for (const [k, j] of Object.entries(JOBS)) { const vb = fs.readFileSync(path.join(B, `tt-${k}.svg`), 'utf8').match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/); const ar = vb[1] / vb[2];
    for (const n of j.h || j.w) { const w = j.h ? Math.round(n * ar) : n, h = j.h ? n : Math.round(n / ar); const png = path.join(B, `tt-${k}-${n}.png`); await shoot(`tt-${k}.svg`, w, h, png);
      execFileSync('python3', ['-c', `from PIL import Image; im=Image.open('${png}'); im.save('${png.replace('.png', '.webp')}', 'WEBP', quality=92, method=6)`]); }
    console.log(k, 'aspect', ar.toFixed(4)); }
  for (const n of [32, 192, 512]) await shoot('tt-favicon.svg', n, n, path.join(B, `tt-favicon-${n}.png`));
  await b.close();
})();
