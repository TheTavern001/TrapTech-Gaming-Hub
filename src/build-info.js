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
  const config = fs.readFileSync(path.join(root, 'src/config.js'), 'utf8');
  const block = (config.match(/const GAMES = \[([\s\S]*?)\n\];/) || [])[1] || '';
  for (const m of block.matchAll(/\{\s*id:\s*'([^']+)',\s*title:\s*'([^']+)'[\s\S]*?module:\s*'([^']+)'/g)) files.add('public/js/' + m[3]);
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
