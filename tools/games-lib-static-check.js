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
const docRows = (doc.match(/^\|\s*\d+\s*\|/gm) || []).length;
if (docRows !== games.length) errors.push('Documentation row count mismatch: ' + docRows + ' vs ' + games.length);

console.log(JSON.stringify({ registry: games.length, catalog: catalog.games.length, docsRows: docRows, errors, warnings }, null, 2));
if (errors.length) process.exitCode = 1;
