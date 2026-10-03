// Renders the original Jetpack Dash cover art (Kenney CC0 sprites + CSS) to PNG/WebP.
const { chromium } = require('playwright-core');
const path = require('path');
const { execSync } = require('child_process');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const out = path.join(__dirname, '..', 'public', 'assets', 'cards');
  for (const [name, w, h] of [['jetpack-dash-tall', 600, 620], ['jetpack-dash', 800, 450]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto('file://' + path.join(__dirname, 'jetpack-cover.html') + `?w=${w}&h=${h}`);
    await p.waitForTimeout(600);
    await p.screenshot({ path: path.join(out, name + '.png') });
    execSync(`python3 -c "from PIL import Image; Image.open('${out}/${name}.png').save('${out}/${name}.webp','WEBP',quality=88,method=6)"`);
    console.log('rendered', name);
  }
  await b.close();
})();
