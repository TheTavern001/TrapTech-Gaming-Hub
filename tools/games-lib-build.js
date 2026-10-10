// Games Library builder: writes public/games-lib/<slug>/index.html + CREDITS.md for built games and catalog.json.
// Usage: node tools/games-lib-build.js
const fs = require('fs'); const path = require('path');
const { games, CATS, EXTERNAL } = require('../src/games-lib');
const ROOT = path.join(__dirname, '..', 'public', 'games-lib');
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let n = 0;
for (const g of games) {
  const dir = path.join(ROOT, g.slug); if (!fs.existsSync(path.join(dir, 'game.js')) && g.build === 'built') { console.log('missing', g.slug); continue; }
  if (g.build === 'built') {
    const uses = [...fs.readFileSync(path.join(dir, 'game.js'), 'utf8').matchAll(/@uses ([\w.-]+)/g)].map(m => `<script src="../${m[1]}"></script>`).join('');
    fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>${esc(g.title)} - The Gaming Hub</title><meta name="theme-color" content="#050714"><link rel="stylesheet" href="../lib.css"></head>
<body class="glplay"><a class="glback" href="/games-lib/index.html" aria-label="Back to the library">&#8592;</a>
<script src="../adapter.js"></script><script src="../kit.js"></script>${uses}<script src="game.js"></script></body></html>\n`);
    fs.writeFileSync(path.join(dir, 'CREDITS.md'), `# ${g.title}\n\nOriginal game built for The Gaming Hub (Trap Tech Solutions). Code: MIT (see ../LICENSE-HUB.md). Art: vector shapes drawn in code. Sound: synthesized at runtime with WebAudio. No third-party assets.\n`);
  }
  n++;
}
fs.writeFileSync(path.join(ROOT, 'catalog.json'), JSON.stringify({ categories: CATS, games: games.map(({ ref_internal, ...g }) => g), external: EXTERNAL }));
console.log('built', n, 'of', games.length);
