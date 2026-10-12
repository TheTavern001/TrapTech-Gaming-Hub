'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function buildFingerprint(root = path.resolve(__dirname, '..')) {
  const files = new Set([
    'package.json',
    'src/config.js',
    'src/games-lib.js',
    'src/server.js',
    'src/build-info.js',
    'public/index.html',
    'public/manifest.webmanifest',
    'public/css/launch-redesign.css',
    'public/assets/brand/traptech-app-icon.svg',
    'public/assets/brand/favicon.svg',
    'public/assets/brand/hub-mark.svg',
    'public/assets/brand/tt-favicon.svg',
    'public/assets/brand/tt-maskable.svg',
    'public/js/games/engine.js',
    'public/games-lib/adapter.js',
    'public/games-lib/kit.js',
    'public/games-lib/catalog.json'
  ]);
  // Include all first-party source/metadata files so changes to avatar, shop, navigation,
  // CSS, catalog metadata or a vendored game's JS/HTML change the live fingerprint too.
  const sourceExt = new Set(['.js', '.html', '.css', '.json', '.webmanifest', '.svg']);
  const collect = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) collect(abs);
      else if (ent.isFile() && sourceExt.has(path.extname(ent.name).toLowerCase())) files.add(path.relative(root, abs).split(path.sep).join('/'));
    }
  };
  for (const dir of ['src', 'public/js', 'public/css', 'public/games-lib', 'public/assets/brand']) collect(path.join(root, dir));
  const { games } = require('./games-lib');
  for (const game of games) {
    files.add('public/games-lib/' + game.slug + '/index.html');
    const js = path.join(root, 'public/games-lib', game.slug, 'game.js');
    if (fs.existsSync(js)) files.add('public/games-lib/' + game.slug + '/game.js');
  }
  const hash = crypto.createHash('sha256');
  for (const rel of [...files].sort()) {
    hash.update(rel).update('\0');
    const file = path.join(root, rel);
    try { hash.update(fs.readFileSync(file)); }
    catch { hash.update('MISSING'); }
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 24);
}

module.exports = { buildFingerprint };
