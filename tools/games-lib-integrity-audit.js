#!/usr/bin/env node
'use strict';

// Read-only integrity audit for the Games Library. This does not change game files,
// registry metadata, scores, or deployment state. Run from the repository root:
//   node tools/games-lib-integrity-audit.js
// It compares the source registry with generated docs/catalog, on-disk game builds,
// and the most recent saved E2E results. Missing/stale evidence is reported as a
// blocker rather than being silently counted as a pass.

const fs = require('fs');
const path = require('path');
const { games, CATS, EXTERNAL } = require('../src/games-lib');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public', 'games-lib');
const DOC = path.join(ROOT, 'docs', 'GAMES-LIB.md');
const CATALOG = path.join(PUB, 'catalog.json');
const E2E = path.join(ROOT, 'screenshots', 'v7', 'games-lib', 'e2e-results.json');
const CANDIDATES = path.join(ROOT, 'docs', 'GAME-CANDIDATES.md');

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return null; }
}
function exists(file) { return fs.existsSync(file); }
function countDocRows(text) {
  return (text.match(/^\|\s*\d+\s*\|/gm) || []).length;
}

const issues = [];
const warnings = [];
const docText = exists(DOC) ? fs.readFileSync(DOC, 'utf8') : '';
const catalog = readJson(CATALOG);
const e2e = readJson(E2E);
const candidateText = exists(CANDIDATES) ? fs.readFileSync(CANDIDATES, 'utf8') : '';
const built = games.filter(g => g.build === 'built');
const vendored = games.filter(g => g.build === 'vendored');
const tested = new Set(Object.keys(e2e || {}));
const categoryCounts = Object.fromEntries(CATS.map(cat => [cat, games.filter(g => g.category === cat).length]));
const gameRows = [];
const catalogBySlug = new Map((catalog && Array.isArray(catalog.games) ? catalog.games : []).map(g => [g.slug, g]));

if (!exists(DOC)) issues.push('Missing generated docs/GAMES-LIB.md');
if (!catalog) issues.push('Missing or invalid public/games-lib/catalog.json');
if (!e2e) warnings.push('No readable saved E2E results; every game needs a fresh run before being called verified.');
if (!candidateText) warnings.push('Missing docs/GAME-CANDIDATES.md; candidate pool cannot be compared.');

for (const g of games) {
  const dir = path.join(PUB, g.slug);
  const entry = path.join(dir, 'index.html');
  const code = path.join(dir, 'game.js');
  const license = path.join(dir, 'LICENSE');
  const result = e2e && e2e[g.slug];
  const problems = [];

  if (!exists(dir)) problems.push('missing game directory');
  const catalogGame = catalogBySlug.get(g.slug);
  if (catalog && !catalogGame) problems.push('missing from catalog.json');
  if (catalogGame) {
    for (const key of ['id', 'title', 'category', 'url', 'scoring', 'build', 'giveaway', 'endless_mode']) {
      if (catalogGame[key] !== g[key]) problems.push('catalog mismatch: ' + key);
    }
    if (catalogGame.art && typeof catalogGame.art === 'string' && catalogGame.art.startsWith('/')) {
      const artPath = path.join(ROOT, catalogGame.art.replace(/^\//, ''));
      if (!exists(artPath)) warnings.push(g.slug + ': catalog art file missing (' + catalogGame.art + ')');
    }
  }
  if (exists(entry)) {
    const html = fs.readFileSync(entry, 'utf8');
    for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
      const src = match[1];
      if (/^(https?:)?\/\//i.test(src) || src.startsWith('data:')) continue;
      const localPath = path.resolve(dir, src);
      if (!localPath.startsWith(path.resolve(PUB) + path.sep) || !exists(localPath)) {
        problems.push('broken local script reference: ' + src);
      }
    }
  }
  if (g.build === 'built' && !exists(code)) problems.push('missing game.js for built game');
  if (g.build === 'vendored' && !exists(code) && !exists(entry)) problems.push('missing vendored entry/build');
  if (g.build === 'built' && !exists(entry)) warnings.push(g.slug + ': missing generated index.html (run tools/games-lib-build.js)');
  if (g.build === 'vendored' && !exists(license)) warnings.push(g.slug + ': vendored license file missing at expected path');
  if (!result) warnings.push(g.slug + ': no saved E2E result');
  else {
    if (!result.pass) problems.push('last saved E2E result failed');
    if (result.desktop && Number.isFinite(result.desktop.fps) && result.desktop.fps < 30) problems.push('desktop FPS below 30 (' + result.desktop.fps + ')');
    if (result.mobile && Number.isFinite(result.mobile.fps) && result.mobile.fps < 30) problems.push('mobile FPS below 30 (' + result.mobile.fps + ')');
    if (Array.isArray(result.errors) && result.errors.length) problems.push('console/page errors (' + result.errors.length + ')');
  }
  if (!g.giveaway) problems.push('not giveaway eligible');
  if (g.just_for_fun) problems.push('marked just-for-fun');
  if (Number(g.acLevel || g.acLevel === 0 ? g.acLevel : 0) < 2) problems.push('anti-cheat level below L2 or unspecified');
  if (problems.length) issues.push(g.slug + ': ' + problems.join('; '));
  gameRows.push({ slug: g.slug, title: g.title, category: g.category, build: g.build, tier: g.tier, e2e: result ? (result.pass ? 'pass' : 'fail') : 'not-run', problems });
}

const docRows = countDocRows(docText);
if (docRows !== games.length) issues.push('Registry/docs mismatch: source registry has ' + games.length + ' games, docs/GAMES-LIB.md has ' + docRows + ' rows.');
if (catalog && Array.isArray(catalog.games) && catalog.games.length !== games.length) {
  issues.push('Registry/catalog mismatch: source registry has ' + games.length + ' games, catalog.json has ' + catalog.games.length + ' entries.');
}
if (catalog && Array.isArray(catalog.games)) {
  const extra = catalog.games.filter(g => !games.some(source => source.slug === g.slug)).map(g => g.slug);
  if (extra.length) issues.push('Catalog has unregistered games: ' + extra.join(', '));
}
if (catalog && (!Array.isArray(catalog.games) || !Array.isArray(catalog.categories))) issues.push('catalog.json has an unexpected schema.');
if (Array.isArray(EXTERNAL) && EXTERNAL.length) issues.push('External game links exist; these violate the no-redirect library requirement.');
if (e2e) {
  const stale = [...tested].filter(slug => !games.some(g => g.slug === slug));
  if (stale.length) warnings.push('Saved E2E results for unregistered slugs: ' + stale.join(', '));
}

const report = {
  generatedAt: new Date().toISOString(),
  branchNote: 'Run this script against the exact commit intended for review/deployment.',
  counts: {
    registry: games.length,
    built,
    vendored,
    builtCount: built.length,
    vendoredCount: vendored.length,
    docsRows: docRows,
    catalogRows: catalog && Array.isArray(catalog.games) ? catalog.games.length : null,
    savedE2EResults: e2e ? Object.keys(e2e).length : 0,
    candidateRows: countDocRows(candidateText),
    externalLinks: Array.isArray(EXTERNAL) ? EXTERNAL.length : null
  },
  categoryCounts,
  blockers: issues,
  warnings,
  games: gameRows
};

console.log(JSON.stringify(report, null, 2));
if (issues.length) process.exitCode = 1;
