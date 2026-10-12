#!/usr/bin/env node
'use strict';

// Zero-cost local prelaunch verification. Run it in the repository checkout or Docker build.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const EXCLUDED = new Set(['node_modules', '.git', 'coverage', 'screenshots']);
const SCAN_ROOTS = ['src', 'tools', 'public/js', 'public/games-lib'];
const failures = [];
const counts = { javascriptFiles: 0, localModuleImports: 0, jsonFiles: 0, manifestIcons: 0, coreGames: 0, libraryGames: 0 };

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
function read(p) { try { return fs.readFileSync(p, "utf8"); } catch { return null; } }
function rel(p) { return path.relative(ROOT, p).split(path.sep).join('/'); }

for (const root of SCAN_ROOTS) {
  const abs = path.join(ROOT, root);
  if (!fs.existsSync(abs)) { fail(root, 'Required scan root is missing'); continue; }
  for (const file of walk(abs).filter(p => p.endsWith('.js'))) {
    counts.javascriptFiles++;
    const source = fs.readFileSync(file, 'utf8');
    // Use the correct parser goal: ESM for files with static imports/exports, script mode otherwise.
    // This also keeps legacy vendored browser scripts (which may use script-only syntax) testable.
    const isModule = /^\s*(?:import|export)\s/m.test(source);
    const args = isModule ? ['--input-type=module', '--check', '-'] : ['--check', '-'];
    const result = spawnSync(process.execPath, args, {
      input: source, encoding: 'utf8', timeout: 15000
    });
    if (result.status !== 0) fail(rel(file), (result.stderr || result.stdout || 'JavaScript syntax check failed').trim().slice(0, 1400));
    const importSpecs = new Set();
    for (const m of source.matchAll(/\bfrom\s*['"]([^'"]+)['"]|\bimport\s*(?:\(\s*)?['"]([^'"]+)['"]/g)) {
      const spec = m[1] || m[2];
      if (!spec || /^(?:[a-z]+:|\/\/|data:)/i.test(spec) || (!spec.startsWith('.') && !spec.startsWith('/'))) continue;
      importSpecs.add(spec);
    }
    for (const spec of importSpecs) {
      const target = path.resolve(spec.startsWith('/') ? path.join(ROOT, 'public', spec.slice(1)) : path.resolve(path.dirname(file), spec));
      const safeRoots = [path.resolve(ROOT, 'src') + path.sep, path.resolve(ROOT, 'tools') + path.sep, path.resolve(ROOT, 'public') + path.sep];
      if (!safeRoots.some(base => target.startsWith(base))) { fail(rel(file), 'Local module import escapes repository scan roots: ' + spec); continue; }
      counts.localModuleImports++;
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) fail(rel(file), 'Missing local module dependency: ' + spec);
    }
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
const seededSource = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const highScoreSource = seededSource('public/js/games/high-score.js');
if (!highScoreSource.includes('range(min, max)') || !highScoreSource.includes('this.r()') || /Math\.random\(\)|\brnd\(/.test(highScoreSource)) fail('public/js/games/high-score.js', 'Score-affecting target placement and spawn timing must use the server-seeded RNG');
const terpTapperSource = seededSource('public/js/games/terp-tapper.js');
if (!terpTapperSource.includes('this.r()') || /Math\.random\(\)/.test(terpTapperSource)) fail('public/js/games/terp-tapper.js', 'Rhythm chart generation must use the server-seeded RNG');
const voidSwarmSource = seededSource('public/js/games/void-swarm.js');
if (!voidSwarmSource.includes('range(min, max)') || /Math\.random\(\)/.test(voidSwarmSource)) fail('public/js/games/void-swarm.js', 'Enemy attacks, dives, and power-up drops must use the server-seeded RNG');
const growGuardSource = seededSource('public/js/games/grow-guard.js');
if (/Math\.random\(\)/.test(growGuardSource) || !growGuardSource.includes('const noise = () =>')) fail('public/js/games/grow-guard.js', 'Decorative soil texture noise must be isolated from gameplay RNG');
const jetpackSource = seededSource('public/js/jetpack.js');
const jetpackObstacleSource = (jetpackSource.match(/_spawnObstacle\(\) \{([\s\S]*?)\n  \}/) || [])[1] || '';
const jetpackCoinSource = (jetpackSource.match(/_spawnCoins\(\) \{([\s\S]*?)\n  \}/) || [])[1] || '';
if (!jetpackSource.includes('setSeed(seed)') || !jetpackSource.includes('seededRng(seed)') || /Math\.random\(\)|\brnd\(/.test(jetpackObstacleSource + jetpackCoinSource)) fail('public/js/jetpack.js', 'Jetpack obstacle and coin layouts must respect the server seed');
if (!mobileTest.includes("id: 'desktop-chrome'") || !mobileTest.includes('p.mouse.click')) fail('tools/e2e-mobile.js', 'Core game regression must include a desktop viewport using mouse input');

const lib = fs.readFileSync(path.join(ROOT, 'src/games-lib.js'), 'utf8');
const slugs = [...lib.matchAll(/T\('([^']+)'\s*,\s*'([^']+)'/g)].map(m => ({ slug: m[1], title: m[2] }));
const libraryBySlug = new Map(require('../src/games-lib').games.map(g => [g.slug, g]));
counts.libraryGames = slugs.length;
if (!slugs.length) fail('src/games-lib.js', 'No Games Library entries were parsed');
if (slugs.length !== 80) fail('src/games-lib.js', 'Expected the current 80-title curated Games Library, found ' + slugs.length);
const RETIRED_DUPLICATE_SLUGS = Object.freeze(["jet-blaster","sky-flap","hoop-flap","slab-stack","neon-snake","brick-blitz","sling-siege","castle-crush","moto-lanes","lane-racer","ruin-runner","gem-rush","toad-cross","bat-boy","highway-heist","park-getaway","night-shift","hill-glider","pen-throw","lawn-guard"]);
for (const retiredSlug of RETIRED_DUPLICATE_SLUGS) {
  if (slugs.some(g => g.slug === retiredSlug)) fail('src/games-lib.js', 'Retired duplicate is still registered: ' + retiredSlug);
  if (fs.existsSync(path.join(ROOT, 'public/games-lib', retiredSlug))) fail('public/games-lib/' + retiredSlug, 'Retired duplicate files are still publicly shipped');
}
try {
  const staticCatalog = JSON.parse(read(path.join(ROOT, 'public/games-lib/catalog.json')) || 'null');
  const staticSlugs = Array.isArray(staticCatalog?.games) ? staticCatalog.games.map(g => g && g.slug).filter(Boolean) : [];
  const registeredSlugs = new Set(slugs.map(g => g.slug));
  if (staticSlugs.length !== slugs.length || new Set(staticSlugs).size !== staticSlugs.length || staticSlugs.some(slug => !registeredSlugs.has(slug))) {
    fail('public/games-lib/catalog.json', 'Static fallback catalog must exactly match the 80-title active registry');
  }
} catch (e) { fail('public/games-lib/catalog.json', 'Static fallback catalog is invalid JSON: ' + e.message); }
for (const shared of ['adapter.js', 'kit.js', 'lib.css']) if (!fs.existsSync(path.join(ROOT, 'public/games-lib', shared))) fail('public/games-lib/' + shared, 'Required shared Games Library runtime asset is missing');
const libraryKit = fs.readFileSync(path.join(ROOT, 'public/games-lib/kit.js'), 'utf8');
if (!/const safeStore\s*=/.test(libraryKit) || !/safeStore\.get\('gl_mute'\)/.test(libraryKit) || !/safeStore\.set\('gl_mute'/.test(libraryKit)) fail('public/games-lib/kit.js', 'Games Library localStorage access must be guarded for locked WebViews');
if (!/meta\[name="viewport"\]/.test(libraryKit) || !/maximum-scale|user-scalable/.test(libraryKit) || !/viewport-fit=cover/.test(libraryKit)) fail('public/games-lib/kit.js', 'Games Library must preserve zoom while normalizing mobile safe-area viewport settings');
const libraryReferenceOwners = new Map();
for (const game of libraryBySlug.values()) {
  const key = String(game.ref_internal || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  if (!key) fail(game.slug, 'Internal gameplay reference is missing; unique game identity must be reviewable');
  else if (libraryReferenceOwners.has(key)) fail(game.slug, 'Duplicate internal gameplay reference shared with ' + libraryReferenceOwners.get(key) + ': ' + key);
  else libraryReferenceOwners.set(key, game.slug);
}
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
    // Three.js-based titles use native ES modules and bare imports resolved by each page's import map.
    // Parse those as modules rather than misclassifying valid import/export syntax as CommonJS errors.
    const isModule = /^\s*(?:import|export)\s/m.test(js);
    const syntaxArgs = isModule ? ['--input-type=module', '--check', '-'] : ['--check', '-'];
    const syntax = spawnSync(process.execPath, syntaxArgs, { input: js, encoding: 'utf8', timeout: 15000 });
    if (syntax.status !== 0) fail(g.slug + '/game.js', (syntax.stderr || syntax.stdout || 'Game JavaScript syntax check failed').trim().slice(0, 1400));
  }
  if (fs.existsSync(entry)) {
    const html = fs.readFileSync(entry, 'utf8');
    for (const m of html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
      const ref = m[1];
      if (!ref || /^(?:https?:|\/\/|data:|#|javascript:|mailto:)/i.test(ref)) continue;
      const clean = ref.split(/[?#]/)[0];
      if (!/\.(?:m?js|css|json|wasm|png|jpe?g|webp|avif|gif|svg|woff2?|ttf|otf|mp3|ogg|wav|ico)$/i.test(clean)) continue;
      const target = path.resolve(dir, clean.startsWith('/') ? path.join(ROOT, 'public', clean.slice(1)) : clean);
      const safe = [path.resolve(dir) + path.sep, path.resolve(ROOT, 'public') + path.sep];
      if (!safe.some(root => target.startsWith(root))) fail(g.slug, 'Asset path escapes game roots: ' + ref);
      else if (!fs.existsSync(target)) fail(g.slug, 'Missing referenced local asset: ' + ref);
    }
  }
}

const indexHtml = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
const redesignCss = path.join(ROOT, 'public/css/launch-redesign.css');
if (!fs.existsSync(redesignCss) || !fs.readFileSync(redesignCss, 'utf8').trim()) fail('public/css/launch-redesign.css', 'Launch redesign stylesheet is missing or empty');
if (!/href=["']\/css\/launch-redesign\.css(?:\?[^"']*)?["']/.test(indexHtml)) fail('public/index.html', 'Homepage does not link the launch redesign stylesheet');
if (!/href=["']\/assets\/brand\/traptech-app-icon\.svg["']/.test(indexHtml)) fail('public/index.html', 'Homepage browser favicon must use the canonical Trap Tech app icon');
if (!/src=["']\/assets\/brand\/traptech-app-icon\.svg["']/.test(indexHtml)) fail('public/index.html', 'Hub startup/splash mark must use the canonical Trap Tech app icon');
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
if (!engine.includes('const uiTarget = target &&') || !engine.includes('if (!this._activeKeys.has(e.code)) return;')) fail('public/js/games/engine.js', 'Keyboard input must not steal focused UI controls or release uncaptured keys');
if (!(engine.indexOf("if (e.code === 'KeyP' || e.code === 'Escape')") < engine.indexOf('const uiTarget = target &&'))) fail('public/js/games/engine.js', 'Escape/pause shortcuts must remain available while focused controls are protected');
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
const prestigeSource = read(path.join(ROOT, 'src/monetize.js')) || '';
const prestigeBlock = (prestigeSource.match(/const PRESTIGE = \{([\s\S]*?)\n\};/) || [])[1] || '';
const prestigeItems = [...prestigeBlock.matchAll(/^\s*'([^']+)': \{[^\n]*?fx: '([^']+)', supply: (\d+)/gm)].map(m => ({ id: m[1], fx: m[2], supply: Number(m[3]) }));
const storeUi = read(path.join(ROOT, 'public/js/hub-store.js')) || '';
const artBlock = (storeUi.match(/const PX_ART = \{([\s\S]*?)\n\};/) || [])[1] || '';
const iconBlock = (storeUi.match(/const PX_ICON = \{([\s\S]*?)\n\};/) || [])[1] || '';
const assetBlock = (storeUi.match(/const PX_ASSET = \{([\s\S]*?)\n\};/) || [])[1] || '';
const fxBlock = (storeUi.match(/const FX_CLASS = \{([\s\S]*?)\n\};/) || [])[1] || '';
const prestigeCss = read(path.join(ROOT, 'public/css/app.css')) || '';
if (prestigeItems.length !== 12) fail('src/monetize.js', 'Expected exactly 12 Prestige originals, found ' + prestigeItems.length);
if (new Set(prestigeItems.map(item => item.fx)).size !== prestigeItems.length) fail('src/monetize.js', 'Each Prestige original must have a unique signature effect');
const artClasses = [];
for (const item of prestigeItems) {
  if (item.supply !== 1) fail('src/monetize.js', item.id + ' must have one-of-one supply');
  const art = new RegExp("'" + item.id + "':\\s*'([^']+)'").exec(artBlock);
  const icon = new RegExp("'" + item.id + "':\\s*'([^']+)'").exec(iconBlock);
  const asset = new RegExp("'" + item.id + "':\\s*'([^']+)'").exec(assetBlock);
  const fx = new RegExp("'" + item.fx + "':\\s*'([^']+)'").exec(fxBlock);
  if (!art) fail('public/js/hub-store.js', 'Missing unique prestige art class for ' + item.id);
  else { artClasses.push(art[1]); if (!prestigeCss.includes('.px-art.' + art[1])) fail('public/css/app.css', 'Missing art CSS for ' + item.id + ' (' + art[1] + ')'); }
  if (!icon) fail('public/js/hub-store.js', 'Missing icon mapping for ' + item.id);
  if (!asset) fail('public/js/hub-store.js', 'Missing original SVG artwork mapping for ' + item.id);
  else {
    const assetPath = path.join(ROOT, 'public/assets/prestige', asset[1] + '.svg');
    const svg = read(assetPath) || '';
    if (!svg.trim().startsWith('<svg')) fail('public/assets/prestige/' + asset[1] + '.svg', 'Original Prestige artwork SVG is missing or invalid');
    if (svg.length > 30000 || /<script\b|(?:href|src)=["']https?:/i.test(svg)) fail('public/assets/prestige/' + asset[1] + '.svg', 'Artwork must be compact and self-contained');
  }
  if (!fx) fail('public/js/hub-store.js', 'Missing visual effect mapping for ' + item.fx);
  else if (!prestigeCss.includes('.' + fx[1])) fail('public/css/app.css', 'Missing effect CSS for ' + item.fx + ' (' + fx[1] + ')');
}
if (new Set(artClasses).size !== artClasses.length) fail('public/js/hub-store.js', 'Prestige art classes must be unique');
console.log(JSON.stringify({ ok: failures.length === 0, counts, failures }, null, 2));
if (failures.length) process.exit(1);
