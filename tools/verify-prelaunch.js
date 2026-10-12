#!/usr/bin/env node
'use strict';

// Zero-cost, local prelaunch verification. This deliberately avoids depending on
// GitHub status reporting: run it in the repository checkout or the deployment build.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const EXCLUDED = new Set(['node_modules', '.git', 'coverage', 'screenshots']);
const SCAN_ROOTS = ['src', 'tools', 'public/js', 'public/games-lib'];
const failures = [];
const counts = { javascriptFiles: 0, jsonFiles: 0, manifestIcons: 0, coreGames: 0, libraryGames: 0 };

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory() && EXCLUDED.has(ent.name)) continue;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(abs));
    else if (ent.isFile()) out.push(abs);
  }
  return out;
}
function fail(where, message) { failures.push({ where, message }); }
function rel(p) { return path.relative(ROOT, p).split(path.sep).join('/'); }

for (const root of SCAN_ROOTS) {
  const abs = path.join(ROOT, root);
  if (!fs.existsSync(abs)) { fail(root, 'Required scan root is missing'); continue; }
  for (const file of walk(abs).filter(p => p.endsWith('.js'))) {
    counts.javascriptFiles++;
    const source = fs.readFileSync(file, 'utf8');
    // Use the correct parser goal: ESM for files with static imports/exports, script mode otherwise.
    // This also keeps legacy vendored browser scripts (which may use script-only syntax) testable.
    const isModule = /^\\s*(?:import|export)\\s/m.test(source);
    const args = isModule ? ['--input-type=module', '--check', '-'] : ['--check', '-'];
    const result = spawnSync(process.execPath, args, {
      input: source, encoding: 'utf8', timeout: 15000
    });
    if (result.status !== 0) fail(rel(file), (result.stderr || result.stdout || 'JavaScript syntax check failed').trim().slice(0, 1400));
  }
}

const jsonFiles = ['package.json', 'public/manifest.webmanifest'];
for (const file of jsonFiles) {
  const abs = path.join(ROOT, file);
  try { JSON.parse(fs.readFileSync(abs, 'utf8')); counts.jsonFiles++; }
  catch (e) { fail(file, 'Invalid JSON: ' + e.message); }
}

const config = fs.readFileSync(path.join(ROOT, 'src/config.js'), 'utf8');
const block = (config.match(/const GAMES = \[([\s\S]*?)\n\];/) || [])[1] || '';
const core = [...block.matchAll(/\{\s*id:\s*'([^']+)',\s*title:\s*'([^']+)'[\s\S]*?module:\s*'([^']+)'/g)];
counts.coreGames = core.length;
if (!core.length) fail('src/config.js', 'No core games were parsed from the registry');
const ids = new Set();
for (const [, id, title, module] of core) {
  if (ids.has(id)) fail('src/config.js', 'Duplicate core game id: ' + id);
  ids.add(id);
  const file = path.resolve(ROOT, 'public/js', module);
  if (!file.startsWith(path.resolve(ROOT, 'public/js') + path.sep) || !fs.existsSync(file)) fail(id, title + ': registered module missing or escapes public/js: ' + module);
}

const mobileTest = fs.readFileSync(path.join(ROOT, 'tools/e2e-mobile.js'), 'utf8');
const mobileBlock = (mobileTest.match(/const GAMES = \[([^\]]*)\]/) || [])[1] || '';
const mobileIds = [...mobileBlock.matchAll(/'([^']+)'/g)].map(m => m[1]);
for (const id of ids) if (!mobileIds.includes(id)) fail('tools/e2e-mobile.js', 'Core game missing from mobile regression suite: ' + id);
for (const id of mobileIds) if (!ids.has(id)) fail('tools/e2e-mobile.js', 'Mobile suite references an unregistered core game: ' + id);

const lib = fs.readFileSync(path.join(ROOT, 'src/games-lib.js'), 'utf8');
const slugs = [...lib.matchAll(/T\('([^']+)'\s*,\s*'([^']+)'/g)].map(m => ({ slug: m[1], title: m[2] }));
const libraryBySlug = new Map(require('../src/games-lib').games.map(g => [g.slug, g]));
counts.libraryGames = slugs.length;
if (!slugs.length) fail('src/games-lib.js', 'No Games Library entries were parsed');
if (slugs.length !== 100) fail('src/games-lib.js', 'Expected the current 100-title Games Library, found ' + slugs.length);
for (const shared of ['adapter.js', 'kit.js', 'lib.css']) if (!fs.existsSync(path.join(ROOT, 'public/games-lib', shared))) fail('public/games-lib/' + shared, 'Required shared Games Library runtime asset is missing');
const libraryKit = fs.readFileSync(path.join(ROOT, 'public/games-lib/kit.js'), 'utf8');
if (!/const safeStore\s*=/.test(libraryKit) || !/safeStore\.get\('gl_mute'\)/.test(libraryKit) || !/safeStore\.set\('gl_mute'/.test(libraryKit)) fail('public/games-lib/kit.js', 'Games Library localStorage access must be guarded for locked WebViews');
if (!/meta\[name="viewport"\]/.test(libraryKit) || !/maximum-scale|user-scalable/.test(libraryKit) || !/viewport-fit=cover/.test(libraryKit)) fail('public/games-lib/kit.js', 'Games Library must preserve zoom while normalizing mobile safe-area viewport settings');
const slugSet = new Set();
for (const g of slugs) {
  if (slugSet.has(g.slug)) fail(g.slug, 'Duplicate Games Library slug');
  slugSet.add(g.slug);
  const dir = path.join(ROOT, 'public/games-lib', g.slug);
  const entry = path.join(dir, 'index.html');
  const gameJs = path.join(dir, 'game.js');
  const catalogGame = libraryBySlug.get(g.slug);
  if (!catalogGame) fail(g.slug, 'Slug is not present in exported Games Library registry');
  if (!fs.existsSync(entry)) fail(g.slug, 'Missing game entry HTML');
  if (catalogGame?.build === 'built' && !fs.existsSync(gameJs)) fail(g.slug, 'Missing game.js for an original built title');
  if (fs.existsSync(gameJs)) {
    const js = fs.readFileSync(gameJs, 'utf8');
    if (!js.trim()) fail(g.slug, 'game.js is empty');
    const syntax = spawnSync(process.execPath, ['--check', '-'], { input: js, encoding: 'utf8', timeout: 15000 });
    if (syntax.status !== 0) fail(g.slug + '/game.js', (syntax.stderr || syntax.stdout || 'Game JavaScript syntax check failed').trim().slice(0, 1400));
  }
  if (fs.existsSync(entry)) {
    const html = fs.readFileSync(entry, 'utf8');
    for (const m of html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
      const ref = m[1];
      if (!ref || /^(?:https?:|\/\/|data:|#|javascript:|mailto:)/i.test(ref)) continue;
      const clean = ref.split(/[?#]/)[0];
      if (!/\.(?:js|css|json|wasm|png|jpe?g|webp|svg|woff2?|mp3|ogg|wav)$/i.test(clean)) continue;
      const target = path.resolve(dir, clean.startsWith('/') ? path.join(ROOT, 'public', clean.slice(1)) : clean);
      const safe = [path.resolve(dir) + path.sep, path.resolve(ROOT, 'public') + path.sep];
      if (!safe.some(root => target.startsWith(root))) fail(g.slug, 'Asset path escapes game roots: ' + ref);
      else if (!fs.existsSync(target)) fail(g.slug, 'Missing referenced local asset: ' + ref);
    }
  }
}

const canonical = fs.readFileSync(path.join(ROOT, 'public/assets/brand/traptech-app-icon.svg'), 'utf8').trim();
for (const alias of ['favicon.svg', 'hub-mark.svg', 'tt-favicon.svg', 'tt-maskable.svg']) {
  const file = path.join(ROOT, 'public/assets/brand', alias);
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8').trim() !== canonical) fail('brand', alias + ' is not identical to the canonical Trap Tech app icon');
}
const html = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
if (!html.includes('/assets/brand/traptech-app-icon.svg')) fail('public/index.html', 'Canonical Trap Tech icon is not referenced');
if (!/<img[^>]+src=["']\/assets\/brand\/traptech-app-icon\.svg["']/.test(html)) fail('public/index.html', 'Startup splash does not use the canonical Trap Tech icon');
const engine = fs.readFileSync(path.join(ROOT, 'public/js/games/engine.js'), 'utf8');
if (!engine.includes('clearInputs()') || !/destroy\(\)\s*\{\s*this\.clearInputs\(\)/.test(engine) || !/restart\(\)\s*\{\s*this\.clearInputs\(\)/.test(engine) || !/finish\(\)\s*\{[^}]*this\.clearInputs\(\)/s.test(engine)) fail('public/js/games/engine.js', 'Input cleanup is not wired to destroy/restart/finish lifecycle');
for (const [file, token] of [['public/js/games/plinko.js', 'e.cancelled'], ['public/js/games/spin-to-win.js', 'e.cancelled'], ['public/js/games/sling-smash.js', 'e.cancelled']]) {
  if (!(read(path.join(ROOT, file)) || '').includes(token)) fail(file, 'Forced input cancellation must not trigger a gameplay release action');
}
const brick = read(path.join(ROOT, 'public/js/games/brick-breaker.js')) || '';
if (!brick.includes('Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 6))')) fail('public/js/games/brick-breaker.js', 'Physics must retain a safe minimum substep for zero/near-zero frame deltas');
if (!brick.includes('b.x = k.x - r') || !brick.includes('b.y = k.y - r')) fail('public/js/games/brick-breaker.js', 'Brick collisions must resolve penetration to prevent repeated damage during one contact');
const sky = read(path.join(ROOT, 'public/js/games/sky-hopper.js')) || '';
if (!sky.includes('const maxShift = prevPipe') || !sky.includes('const shift = prev ?')) fail('public/js/games/sky-hopper.js', 'Gap transitions must remain bounded during generation and movement');
const server = fs.readFileSync(path.join(ROOT, 'src/server.js'), 'utf8');
if (!server.includes('@resvg/resvg-js') || !server.includes('HUB_ICON_ROUTES')) fail('src/server.js', 'Dynamic PNG icon route/rasterizer is missing');
if (!server.includes('build_fingerprint') || !server.includes('BUILD_FINGERPRINT')) fail('src/server.js', 'Live build fingerprint is not exposed by /api/build');
try {
  const { buildFingerprint } = require('../src/build-info');
  const first = buildFingerprint(ROOT), second = buildFingerprint(ROOT);
  if (!/^[a-f0-9]{24}$/.test(first) || first !== second) fail('src/build-info.js', 'Build fingerprint is invalid or non-deterministic');
} catch (e) { fail('src/build-info.js', 'Build fingerprint could not be computed: ' + e.message); }
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/manifest.webmanifest'), 'utf8'));
for (const icon of (manifest.icons || [])) {
  counts.manifestIcons++;
  if (!icon.src) fail('manifest', 'An icon has no src');
  else if (!server.includes(icon.src.split('?')[0]) && !fs.existsSync(path.join(ROOT, 'public', icon.src.replace(/^\//, '').split('?')[0]))) fail('manifest', 'Icon source has no matching server route/static file: ' + icon.src);
}

const result = { ok: failures.length === 0, counts, failures };
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
