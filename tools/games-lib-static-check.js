#!/usr/bin/env node
'use strict';

// Deterministic static consistency checks for the Games Library.
// This does not certify gameplay, visual quality, or live score security.
const fs = require('node:fs');
const path = require('node:path');
const { games, CATS, EXTERNAL } = require('../src/games-lib');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const GAME_ROOT = path.join(PUBLIC, 'games-lib');
const CATALOG_PATH = path.join(GAME_ROOT, 'catalog.json');
const DOC_PATH = path.join(ROOT, 'docs', 'GAMES-LIB.md');
const failures = [];
const counts = { registry: games.length, catalog: 0, docsRows: 0, gamePages: 0, localScriptRefs: 0, artAssets: 0 };
const fail = (where, message) => failures.push({ where, message });
const exists = (p) => fs.existsSync(p);
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = stable(value[k]);
    return out;
  }
  return value;
}
function same(a, b) {
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
}
function localPublicPath(urlPath) {
  if (typeof urlPath !== 'string' || !urlPath.startsWith('/')) return null;
  const resolved = path.resolve(PUBLIC, urlPath.slice(1));
  return resolved.startsWith(PUBLIC + path.sep) ? resolved : null;
}
function slurpJson(file, label) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (err) { fail(label, 'Missing or invalid JSON: ' + err.message); return null; }
}

const catalog = slurpJson(CATALOG_PATH, 'catalog.json');
const doc = exists(DOC_PATH) ? fs.readFileSync(DOC_PATH, 'utf8') : '';
if (!doc) fail('docs/GAMES-LIB.md', 'Generated Games Library inventory is missing');
counts.docsRows = (doc.match(/^\|\s*\d+\s*\|/gm) || []).length;
counts.catalog = catalog && Array.isArray(catalog.games) ? catalog.games.length : 0;

for (const file of ['adapter.js', 'kit.js', 'lib.css']) {
  if (!exists(path.join(GAME_ROOT, file))) fail('shared assets', 'Missing ' + file);
}

const slugs = new Set();
const ids = new Set();
for (const g of games) {
  const where = String(g.slug || '(no slug)');
  if (!g.slug) fail(where, 'Registry entry has no slug');
  if (slugs.has(g.slug)) fail(where, 'Duplicate registry slug');
  slugs.add(g.slug);
  if (!g.id) fail(where, 'Registry entry has no id');
  if (ids.has(g.id)) fail(where, 'Duplicate registry id');
  ids.add(g.id);
  if (!CATS.includes(g.category)) fail(where, 'Unknown category: ' + g.category);
  if (!g.giveaway) fail(where, 'A listed library game is not giveaway eligible');
  if (Number(g.acLevel || 0) < 2) fail(where, 'Anti-cheat level is below L2 or unspecified');

  const dir = path.join(GAME_ROOT, where);
  if (!exists(dir) || !fs.statSync(dir).isDirectory()) {
    fail(where, 'Missing game directory');
    continue;
  }
  const entry = localPublicPath(g.url);
  if (!entry || !exists(entry)) fail(where, 'Registry URL is not a valid local game page: ' + g.url);
  else {
    counts.gamePages++;
    const html = fs.readFileSync(entry, 'utf8');
    for (const match of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
      const src = match[1];
      if (/^(?:https?:)?\/\//i.test(src) || /^(?:data:|blob:|javascript:)/i.test(src) || src.startsWith('/api/')) continue;
      const clean = src.split(/[?#]/, 1)[0];
      const resolved = clean.startsWith('/') ? path.resolve(PUBLIC, clean.slice(1)) : path.resolve(path.dirname(entry), clean);
      if (!resolved.startsWith(PUBLIC + path.sep) || !exists(resolved) || !fs.statSync(resolved).isFile()) {
        fail(where, 'Broken or unsafe local script reference (must stay within public/): ' + src);
      } else counts.localScriptRefs++;
    }
  }
  if (g.build === 'built' && !exists(path.join(dir, 'game.js'))) fail(where, 'Original build is missing game.js');
  if (g.art) {
    const artPath = localPublicPath(g.art);
    if (!artPath || !exists(artPath) || !fs.statSync(artPath).isFile()) fail(where, 'Catalog artwork is missing: ' + g.art);
    else counts.artAssets++;
  }
}

if (catalog) {
  if (!Array.isArray(catalog.categories) || !same(catalog.categories, CATS)) fail('catalog.json', 'Categories differ from src/games-lib.js');
  const expectedGames = games.map(({ ref_internal, ...g }) => g);
  if (!Array.isArray(catalog.games) || !same(catalog.games, expectedGames)) {
    const catGames = Array.isArray(catalog.games) ? catalog.games : [];
    const registrySlugs = new Set(expectedGames.map(g => g.slug));
    const catalogSlugs = new Set(catGames.map(g => g.slug));
    const missing = expectedGames.filter(g => !catalogSlugs.has(g.slug)).map(g => g.slug);
    const extra = catGames.filter(g => !registrySlugs.has(g.slug)).map(g => g.slug);
    const internalLeak = catGames.some(g => Object.prototype.hasOwnProperty.call(g, 'ref_internal'));
    fail('catalog.json', 'Generated catalog differs from canonical registry' +
      (missing.length ? '; missing: ' + missing.join(', ') : '') +
      (extra.length ? '; unregistered: ' + extra.join(', ') : '') +
      (internalLeak ? '; internal reference metadata must not ship in public catalog' : ''));
  }
  if (!same(catalog.external || [], EXTERNAL)) fail('catalog.json', 'External-game entries differ from the registry');
}
if (counts.docsRows !== games.length) fail('docs/GAMES-LIB.md', 'Inventory has ' + counts.docsRows + ' numbered rows; registry has ' + games.length);
if (counts.catalog !== games.length) fail('catalog.json', 'Catalog has ' + counts.catalog + ' entries; registry has ' + games.length);

const report = { ok: failures.length === 0, counts, failures };
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
