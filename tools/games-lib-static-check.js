#!/usr/bin/env node
'use strict';

// Fast deterministic checks for the registry/catalog and new Kit games.
// This is intentionally separate from the runtime E2E suite: passing it does not
// certify gameplay, mobile performance, anti-cheat behavior, or asset licensing.
const fs = require('node:fs');
const path = require('node:path');
const { games, EXTERNAL } = require('../src/games-lib');

const root = path.join(__dirname, '..');
const pub = path.join(root, 'public', 'games-lib');
const catalogPath = path.join(pub, 'catalog.json');
const docPath = path.join(root, 'docs', 'GAMES-LIB.md');
const hubAppPath = path.join(root, 'public', 'js', 'app.js');
const libraryPagePath = path.join(pub, 'index.html');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const errors = [];
const warnings = [];
const catalogBySlug = new Map((catalog.games || []).map(g => [g.slug, g]));
const sourceBySlug = new Map(games.map(g => [g.slug, g]));

if (new Set(games.map(g => g.slug)).size !== games.length) errors.push('Duplicate slug in source registry.');
if (!Array.isArray(catalog.games) || catalog.games.length !== games.length) errors.push('Catalog count does not match source registry.');
if (EXTERNAL.length) errors.push('External games/redirects are present.');

for (const g of games) {
  const dir = path.join(pub, g.slug);
  const htmlPath = path.join(dir, 'index.html');
  const jsPath = path.join(dir, 'game.js');
  const c = catalogBySlug.get(g.slug);
  if (!fs.existsSync(dir)) { errors.push(g.slug + ': game directory missing'); continue; }
  if (!fs.existsSync(htmlPath)) errors.push(g.slug + ': index.html missing');
  if (g.build === 'built' && !fs.existsSync(jsPath)) errors.push(g.slug + ': built game.js missing');
  if (!c) { errors.push(g.slug + ': catalog entry missing'); continue; }
  for (const key of ['id', 'title', 'category', 'url', 'art', 'scoring', 'build', 'giveaway', 'endless_mode']) {
    if (c[key] !== g[key]) errors.push(g.slug + ': catalog mismatch for ' + key);
  }
  if (g.art) {
    const artPath = path.join(root, 'public', g.art.replace(/^\//, ''));
    if (!fs.existsSync(artPath)) warnings.push(g.slug + ': artwork missing: ' + g.art);
  }
  if (fs.existsSync(htmlPath)) {
    const html = fs.readFileSync(htmlPath, 'utf8');
    for (const m of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
      const src = m[1];
      if (/^(https?:)?\/\//i.test(src) || src.startsWith('data:')) continue;
      const resolved = path.resolve(dir, src);
      if (!resolved.startsWith(path.resolve(pub) + path.sep) || !fs.existsSync(resolved)) errors.push(g.slug + ': broken local script ' + src);
    }
  }
}
for (const slug of catalogBySlug.keys()) if (!sourceBySlug.has(slug)) errors.push('Unregistered catalog slug: ' + slug);

const doc = fs.existsSync(docPath) ? fs.readFileSync(docPath, 'utf8') : '';
const hubApp = fs.existsSync(hubAppPath) ? fs.readFileSync(hubAppPath, 'utf8') : '';
const libraryPage = fs.existsSync(libraryPagePath) ? fs.readFileSync(libraryPagePath, 'utf8') : '';
if (!hubApp.includes('href="/games-lib/index.html"')) errors.push('Main Hub /games page is missing the Games Library entry point.');
if (!hubApp.includes("fetch('/api/games-lib'")) errors.push('Main Hub does not read the live Games Library count.');
if (!hubApp.includes('libraryGames.find') || !hubApp.includes('location.href = libGame.url + url.search')) errors.push('Main Hub play routing does not open library games with their query parameters intact.');
const adapterPath = path.join(pub, 'adapter.js');
const adapter = fs.existsSync(adapterPath) ? fs.readFileSync(adapterPath, 'utf8') : '';
if (!adapter.includes("qs.get('event')") || !adapter.includes("qs.get('giveaway')") || !adapter.includes('body.event = event')) errors.push('Library adapter does not forward official event/giveaway references to server run validation.');
if (hubApp.includes('150+ more games')) errors.push('Main Hub contains a stale Games Library count.');
for (const slug of ['neon-circuit', 'rift-survival']) {
  if (!libraryPage.includes(slug)) errors.push('Library page is missing new-game spotlight for ' + slug);
}
if (!libraryPage.includes('id="category"') || !libraryPage.includes('id="eligibility"')) errors.push('Library page is missing category/status filters.');
if (!doc.includes('wave transition bonus 10 × wave')) errors.push('Games Library documentation has stale Rift Survival scoring text.');
const riftSource = fs.existsSync(path.join(pub, 'rift-survival', 'game.js')) ? fs.readFileSync(path.join(pub, 'rift-survival', 'game.js'), 'utf8') : '';
if (!/g\.player\s*=\s*\{[^}]*\br\s*:\s*\d+/s.test(riftSource)) errors.push('Rift Survival player collision radius is missing; enemy damage may never trigger.');
const playoffPath = path.join(root, 'src', 'games-lib-playoff.js');
const playoffSource = fs.existsSync(playoffPath) ? fs.readFileSync(playoffPath, 'utf8') : '';
if (!playoffSource.includes("'neon-circuit': ['e'") || !playoffSource.includes("'rift-survival': ['s'")) errors.push('New original games are missing game-specific skill tie-break metrics.');
const docRows = (doc.match(/^\|\s*\d+\s*\|/gm) || []).length;
if (docRows !== games.length) errors.push('Documentation row count mismatch: ' + docRows + ' vs ' + games.length);

console.log(JSON.stringify({ registry: games.length, catalog: catalog.games.length, docsRows: docRows, errors, warnings }, null, 2));
if (errors.length) process.exitCode = 1;
