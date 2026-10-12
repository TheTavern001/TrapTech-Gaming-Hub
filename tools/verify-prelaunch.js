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
    const isModule = /^\s*(?:import|export)\s/m.test(source);
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
if (!mobileTest.includes("id: 'desktop-chrome'") || !mobileTest.includes('p.mouse.click')) fail('tools/e2e-mobile.js', 'Core game regression must include a desktop viewport using mouse input');

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
if (new Set(artClasses).size !== prestigeItems.length) fail('public/js/hub-store.js', 'Prestige originals must not share art classes');
if (!prestigeCss.includes('.px-art .px-artwork')) fail('public/css/app.css', 'Original Prestige SVG artwork is not styled for display');
if (!storeUi.includes('/assets/prestige/')) fail('public/js/hub-store.js', 'Prestige SVG artwork is not loaded by the store UI');
if (!prestigeSource.includes('prestige_original_one_owner')) fail('src/monetize.js', 'Missing database-level one-active-owner constraint for Prestige originals');

const shopSource = read(path.join(ROOT, 'src/shop.js')) || '';
if (!/const CATALOG_UNIVERSE_SIZE = 1200/.test(shopSource) || !shopSource.includes("app.get('/api/shop/catalog'") || !shopSource.includes('catalog_only: !onSale.has(it.id)') || !shopSource.includes('if (!inRotation(rot, it))')) fail('src/shop.js', 'The 1,200-item catalog must be paginated, preview-only outside rotation, and protected by purchase-time rotation checks');
try {
  const generator = require('../src/shop-gen');
  const ids = new Set(), names = new Set();
  let invalid = 0, nondeterministic = 0, duplicateNames = 0;
  for (let day = 0; day < 600; day++) for (let slot = 0; slot < 2; slot++) {
    const a = generator.make('d', 25000 + day, slot);
    const b = generator.make('d', 25000 + day, slot);
    if (!a || !a.id || !a.name || !generator.TYPES.includes(a.type) || !generator.RARITIES.includes(a.rarity)) invalid++;
    if (a && b && JSON.stringify(a) !== JSON.stringify(b)) nondeterministic++;
    if (a?.id) ids.add(a.id);
    if (a?.name) { const key = a.type + ':' + a.name.toLowerCase(); if (names.has(key)) duplicateNames++; names.add(key); }
  }
  if (ids.size !== 1200) fail('src/shop-gen.js', 'Expected 1,200 unique generated item IDs, found ' + ids.size);
  if (invalid) fail('src/shop-gen.js', invalid + ' generated catalog items have invalid metadata');
  if (nondeterministic) fail('src/shop-gen.js', nondeterministic + ' generated catalog items are not deterministic');
  if (duplicateNames) fail('src/shop-gen.js', duplicateNames + ' generated daily items share display names');
} catch (e) { fail('src/shop-gen.js', 'Could not verify the 1,200-item generator: ' + e.message); }
const avatar3dSource = read(path.join(ROOT, 'public/js/avatar-3d.js')) || '';
const avatar3dBg = (avatar3dSource.match(/const backgrounds = \{([\s\S]*?)\n  \};/) || [])[1] || '';
const prestigeBackgrounds = ['diamond-prism','stack-throne','royal-crown','phoenix-mantle','singularity-orbit','void-dragon','nebula-wings','titan-exoframe','holo-decree','storm-halo','chronos-mantle','aurora-crown'];
for (const bg of prestigeBackgrounds) {
  if (!avatar3dBg.includes("'" + bg + "'") || !avatar3dSource.includes("cfg.bg === '" + bg + "'")) fail('public/js/avatar-3d.js', '3D avatar preview is missing prestige environment ' + bg);
}
const avatarSource = read(path.join(ROOT, 'src/avatars.js')) || '';
const avatarWearables = [
  ['held', 'cane', 'prestige-original-cane'], ['held', 'cash', 'prestige-original-throne'], ['hat', 'crown', 'prestige-original-crown'],
  ['acc', 'phoenix-wings', 'prestige-original-phoenix'], ['acc', 'singularity-orbit', 'prestige-original-singularity'],
  ['acc', 'void-dragon', 'prestige-original-dragon'], ['acc', 'nebula-wings', 'prestige-original-nebula'],
  ['outfit', 'titan-exoframe', 'prestige-original-mech'], ['acc', 'holo-decree', 'prestige-original-holo'],
  ['hat', 'storm-halo', 'prestige-original-storm'], ['acc', 'chronos-mantle', 'prestige-original-chronos'],
  ['hat', 'aurora-crown', 'prestige-original-aurora']
];
for (const [kind, id, prestigeId] of avatarWearables) {
  if (!avatarSource.includes("add('" + kind + "', '" + id + "'") || !avatarSource.includes("prestige: '" + prestigeId + "'")) fail('src/avatars.js', 'Missing wearable variation for ' + prestigeId + ' (' + kind + ':' + id + ')');
}
const avatar3dWearables = read(path.join(ROOT, 'public/js/avatar-3d.js')) || '';
const avatarSvgSource = avatarSource;
for (const id of ['phoenix-wings','singularity-orbit','void-dragon','nebula-wings','holo-decree','chronos-mantle','titan-exoframe','storm-halo','aurora-crown']) {
  if (!avatar3dWearables.includes("cfg.acc === '" + id + "'") && !avatar3dWearables.includes("cfg.outfit === '" + id + "'") && !avatar3dWearables.includes("cfg.hat === '" + id + "'")) fail('public/js/avatar-3d.js', 'Missing 3D wearable geometry for ' + id);
  if (!avatarSvgSource.includes("c.acc === '" + id + "'") && !avatarSvgSource.includes("c.outfit === '" + id + "'") && !avatarSvgSource.includes("c.hat === '" + id + "'") && !avatarSvgSource.includes("'" + id + "':")) fail('src/avatars.js', 'Missing SVG fallback art for ' + id);
}
const economyUi = read(path.join(ROOT, 'public/js/economy.js')) || '';
if (!economyUi.includes('Browse 1,200+ items') || !economyUi.includes('/api/shop/catalog?limit=24') || !economyUi.includes('catalog-prev') || !economyUi.includes('catalog-next')) fail('public/js/economy.js', 'Points Shop must expose searchable paginated catalog browsing');
const avatarPartsSource = read(path.join(ROOT, 'src/avatars.js')) || '';
const avatarPrestigeMap = (avatarPartsSource.match(/const PRESTIGE_BG = \{([\s\S]*?)\n\};/) || [])[1] || '';
if (!avatarPrestigeMap.includes("'cash-rain': 'prestige-throne'") || !avatarPrestigeMap.includes("'gold-rays': 'prestige-crown'")) fail('src/avatars.js', 'Legacy prestige backgrounds must remain locked to their historic owners');
const prestigePriceRows = [...prestigeBlock.matchAll(/'([^']+)': \{[^\n]*?usd: (\d+)/gm)];
if (prestigePriceRows.length !== 12 || prestigePriceRows.some(m => Number(m[2]) < 100000)) fail('src/monetize.js', 'All 12 prestige originals must cost at least $1,000');
try {
  const Database = require('better-sqlite3');
  const testDb = new Database(':memory:');
  testDb.exec("CREATE TABLE prestige_owned (item_id TEXT NOT NULL, serial INTEGER NOT NULL, user_id INTEGER, order_id INTEGER, created_at INTEGER NOT NULL, revoked_at INTEGER, PRIMARY KEY(item_id, serial)); CREATE UNIQUE INDEX prestige_original_one_owner ON prestige_owned(item_id) WHERE item_id LIKE 'prestige-original-%' AND revoked_at IS NULL;");
  const insertOwner = testDb.prepare('INSERT INTO prestige_owned (item_id, serial, user_id, order_id, created_at, revoked_at) VALUES (?,?,?,?,?,?)');
  insertOwner.run('prestige-original-cane', 1, 1, null, Date.now(), null);
  let duplicateBlocked = false;
  try { insertOwner.run('prestige-original-cane', 2, 2, null, Date.now(), null); } catch (e) { duplicateBlocked = /UNIQUE constraint failed/.test(e.message); }
  if (!duplicateBlocked) fail('prestige_original_one_owner', 'Database allowed two active owners for one original');
  insertOwner.run('prestige-original-cane', 2, 2, null, Date.now(), Date.now());
  insertOwner.run('prestige-cane', 1, 1, null, Date.now(), null);
  insertOwner.run('prestige-cane', 2, 2, null, Date.now(), null);
  testDb.close();
} catch (e) { fail('prestige_original_one_owner', 'SQLite one-of-one constraint test failed: ' + e.message); }

if (!prestigeSource.includes("process.env.PRESTIGE_SALES_ENABLED === '1'") || !prestigeSource.includes('prestige_sales_enabled: prestigeSalesEnabled()')) fail('src/monetize.js', 'Prestige sales must remain explicitly gated until wearable variations are approved');
if (!storeUi.includes('!r.prestige_sales_enabled') || !storeUi.includes('Preview only')) fail('public/js/hub-store.js', 'Store UI must visibly prevent purchases while Prestige originals are preview-only');

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/manifest.webmanifest'), 'utf8'));
for (const icon of (manifest.icons || [])) {
  counts.manifestIcons++;
  if (!icon.src) fail('manifest', 'An icon has no src');
  else if (!server.includes(icon.src.split('?')[0]) && !fs.existsSync(path.join(ROOT, 'public', icon.src.replace(/^\//, '').split('?')[0]))) fail('manifest', 'Icon source has no matching server route/static file: ' + icon.src);
}

const result = { ok: failures.length === 0, counts, failures };
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
