#!/usr/bin/env node
'use strict';

// Read-only, repository-wide pre-launch audit. Structural checks are evidence collection,
// not proof of AAA quality. Runtime/mobile/visual checks remain explicit blockers.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { games } = require('../src/games-lib');

const ROOT = path.join(__dirname, '..');
const GAME_ROOT = path.join(ROOT, 'public', 'games-lib');
const REPORT_DIR = path.join(ROOT, 'docs', 'audit');
const OUT = path.join(REPORT_DIR, 'prelaunch-structural-audit.json');
const issues = [];
const warnings = [];
const rows = [];
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');
const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
const exists = (p) => fs.existsSync(p);
const normalized = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function duplicates(entries, keyFn) {
  const groups = new Map();
  for (const entry of entries) {
    const key = keyFn(entry);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  return [...groups.entries()].filter(([, group]) => group.length > 1).map(([key, group]) => ({ key, items: group }));
}

// Core Hub games live in public/js and are registered in src/config.js. Parse the source
// instead of requiring config.js because production secrets are intentionally mandatory there.
const configSource = read(path.join(ROOT, 'src', 'config.js')) || '';
const coreRegistryBlock = (configSource.match(/const GAMES = \[([\s\S]*?)\n\];/) || [])[1] || '';
const coreGames = [...coreRegistryBlock.matchAll(/\{\s*id:\s*'([^']+)',\s*title:\s*'([^']+)'[\s\S]*?module:\s*'([^']+)'/g)]
  .map(m => ({ id: m[1], title: m[2], module: m[3] }));
const coreRows = [];
for (const g of coreGames) {
  const modulePath = path.resolve(ROOT, 'public', 'js', g.module);
  const safeRoot = path.resolve(ROOT, 'public', 'js') + path.sep;
  const source = modulePath.startsWith(safeRoot) ? read(modulePath) : null;
  const problems = [];
  const notes = [];
  if (!source) problems.push('core game module missing/unreadable: ' + g.module);
  if (source && !/(?:requestAnimationFrame|setInterval|setTimeout)/.test(source)) notes.push('no obvious game-loop/timer token; inspect interaction model');
  if (source && !/(?:pointerdown|pointerup|touchstart|touchend|addEventListener\(['"]key|onKey|pointer|touch)/i.test(source)) notes.push('no obvious pointer/touch/keyboard input token');
  if (source && /Math\.random\(\)/.test(source) && /score|submit/i.test(source)) notes.push('randomness appears in scoring-related code; review deterministic scoring and server validation');
  const row = {
    id: g.id, title: g.title, module: g.module, moduleHash: source ? hash(source) : null,
    hasCanvasToken: /canvas|\.ctx\b|getContext\(/i.test(source || ''),
    hasWebGLToken: /WebGLRenderer|THREE\.|webgl/i.test(source || ''),
    hasPointerOrTouchToken: /pointerdown|pointerup|touchstart|touchend|ontouch/i.test(source || ''),
    hasKeyboardToken: /keydown|keyup|KeyboardEvent/i.test(source || ''),
    problems, notes
  };
  coreRows.push(row);
  for (const p of problems) issues.push({ id: g.id, title: g.title, severity: 'blocker', finding: p });
  for (const n of notes) warnings.push({ id: g.id, title: g.title, severity: 'review', finding: n });
}

const sharedLibraryFiles = ['adapter.js', 'kit.js', 'lib.css'];
for (const name of sharedLibraryFiles) if (!exists(path.join(GAME_ROOT, name))) issues.push({ severity: 'blocker', finding: 'Games Library shared runtime asset missing: ' + name });

const registrySlugs = new Set();
for (const g of games) {
  const slug = String(g.slug || '');
  const dir = path.join(GAME_ROOT, slug);
  const htmlPath = path.join(dir, 'index.html');
  const jsPath = path.join(dir, 'game.js');
  const html = read(htmlPath);
  const js = read(jsPath);
  const problems = [];
  const notes = [];

  if (!slug) problems.push('registry entry has no slug');
  if (registrySlugs.has(slug)) problems.push('duplicate registry slug');
  registrySlugs.add(slug);
  if (!exists(dir)) problems.push('game directory missing');
  if (!html) problems.push('game entry HTML missing/unreadable');
  // The registry exposes `src` (built/vendored), not `build`; every catalog entry must have its own runnable game.js wrapper.
  if (!js) problems.push('game.js missing/unreadable (registry `build` is not a field; check every entry regardless of source type)');
  if (html) {
    if (!/<meta[^>]+name=["']viewport["']/i.test(html)) problems.push('viewport meta missing');
    if (!/<title\b/i.test(html)) notes.push('document title missing');
    for (const m of html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
      const ref = m[1];
      if (!ref || /^(?:https?:|\/\/|data:|#|javascript:|mailto:)/i.test(ref)) continue;
      const clean = ref.split(/[?#]/)[0];
      if (!/\.(?:js|css|png|jpe?g|webp|svg|woff2?|mp3|ogg|wav|json|glb|gltf|ktx2)$/i.test(clean)) continue;
      const target = path.resolve(dir, clean.startsWith('/') ? path.join(ROOT, 'public', clean.slice(1)) : clean);
      const safeRoots = [path.resolve(dir) + path.sep, path.resolve(ROOT, 'public') + path.sep];
      if (!safeRoots.some(root => target.startsWith(root))) problems.push('asset path escapes public game roots: ' + ref);
      else if (!exists(target)) notes.push('missing local asset reference: ' + ref);
    }
  }
  if (js) {
    if (!/(?:requestAnimationFrame|setInterval|setTimeout)/.test(js)) notes.push('no obvious game-loop/timer token; inspect interaction model');
    if (!/(?:touchstart|pointerdown|pointerup|touch-action|addEventListener\(['"]key)/i.test((html || '') + js)) notes.push('no obvious touch/pointer/keyboard control token');
    if (/Math\.random\(\)/.test(js) && /score|submit/i.test(js)) notes.push('randomness appears in scoring-related code; review determinism and anti-cheat');
    if (/innerHTML\s*=\s*[^;]*(?:username|title|message|error)/i.test(js)) notes.push('review dynamic HTML writes for escaping/XSS');
  }
  const record = {
    slug, id: g.id, title: g.title, category: g.category, source: g.src || 'unknown',
    implementationPresent: !!js, htmlHash: html ? hash(html) : null, gameJsHash: js ? hash(js) : null,
    hasCanvas: /<canvas\b/i.test(html || '') || /createElement\(['"]canvas['"]\)/i.test(js || ''),
    hasWebGL: /webgl|three\.module|WebGLRenderer/i.test((html || '') + (js || '')),
    hasTouchControlsToken: /touchstart|pointerdown|touch-action|ontouch/i.test((html || '') + (js || '')),
    hasKeyboardControlsToken: /keydown|keyup|KeyboardEvent/i.test((html || '') + (js || '')),
    problems, notes
  };
  rows.push(record);
  for (const p of problems) issues.push({ slug, severity: 'blocker', finding: p });
  for (const n of notes) warnings.push({ slug, severity: 'review', finding: n });
}

for (const d of duplicates(games, g => normalized(g.title))) {
  issues.push({ severity: 'duplicate-review', finding: 'Duplicate/near-duplicate normalized game titles', key: d.key, slugs: d.items.map(g => g.slug) });
}
for (const d of duplicates(rows.filter(r => r.htmlHash), r => r.htmlHash)) {
  if (d.items.length > 1) issues.push({ severity: 'duplicate-review', finding: 'Byte-identical game entry HTML', hash: d.key, slugs: d.items.map(r => r.slug) });
}
for (const d of duplicates(rows.filter(r => r.gameJsHash), r => r.gameJsHash)) {
  if (d.items.length > 1) issues.push({ severity: 'duplicate-review', finding: 'Byte-identical game.js files; confirm shared template versus duplicated game', hash: d.key, slugs: d.items.map(r => r.slug) });
}

const avatarSrc = read(path.join(ROOT, 'src', 'avatars.js')) || '';
const shopSrc = read(path.join(ROOT, 'src', 'shop.js')) || '';
const generatorSrc = read(path.join(ROOT, 'src', 'shop-gen.js')) || '';
const avatarEditor = read(path.join(ROOT, 'public', 'js', 'avatar-editor.js')) || '';
const avatarRenderer = read(path.join(ROOT, 'public', 'js', 'avatar-3d.js')) || '';
const avatarTests = read(path.join(ROOT, 'tools', 'e2e-avatars.js')) || '';
const avatar = {
  serverModulePresent: !!avatarSrc,
  editorPresent: !!avatarEditor,
  rendererPresent: !!avatarRenderer,
  serverChecksOwnership: /owned|unlock|prestige|crowns/i.test(avatarSrc),
  testsCoverOwnership: /403|Prestige-only|cannot be worn|before it is bought/i.test(avatarTests),
  supportsPresentationOptions: /male|female|other/i.test(avatarEditor),
  usesWebGLRenderer: /WebGLRenderer|three/i.test(avatarRenderer),
  warnings: []
};
if (!avatar.serverModulePresent || !avatar.editorPresent || !avatar.rendererPresent) avatar.warnings.push('Avatar server/editor/renderer files are incomplete.');
if (!avatar.testsCoverOwnership) avatar.warnings.push('Avatar E2E does not visibly cover server-side ownership gating.');
if (!avatar.supportsPresentationOptions) avatar.warnings.push('Check presentation choices (male/female/other) and inclusive part compatibility.');
if (!avatar.usesWebGLRenderer) avatar.warnings.push('3D avatar renderer not detected; confirm fallback and target experience.');

const serverSrc = read(path.join(ROOT, 'src', 'server.js')) || '';
const indexHtml = read(path.join(ROOT, 'public', 'index.html')) || '';
const manifestRaw = read(path.join(ROOT, 'public', 'manifest.webmanifest'));
let manifest = null;
try { manifest = manifestRaw ? JSON.parse(manifestRaw) : null; } catch { /* recorded below */ }
const canonicalIconPath = path.join(ROOT, 'public', 'assets', 'brand', 'traptech-app-icon.svg');
const canonicalIcon = (read(canonicalIconPath) || '').trim();
const iconAliases = ['favicon.svg', 'hub-mark.svg', 'tt-favicon.svg', 'tt-maskable.svg'];
const mismatchedAliases = iconAliases.filter(name => (read(path.join(ROOT, 'public', 'assets', 'brand', name)) || '').trim() !== canonicalIcon);
const brandIcons = {
  canonicalSvgPresent: exists(canonicalIconPath),
  faviconMatchesCanonical: !mismatchedAliases.includes('favicon.svg'),
  iconAliases,
  mismatchedAliases,
  indexUsesCanonicalSvg: /assets\/brand\/traptech-app-icon\.svg/.test(indexHtml),
  splashUsesCanonicalSvg: /<img[^>]+src=["']\/assets\/brand\/traptech-app-icon\.svg["']/.test(indexHtml),
  dynamicRasterRoutePresent: /HUB_ICON_ROUTES/.test(serverSrc) && /@resvg\/resvg-js/.test(serverSrc),
  manifestValidJson: !!manifest,
  manifestIcons: Array.isArray(manifest?.icons) ? manifest.icons.map(x => ({ src: x.src, sizes: x.sizes, type: x.type, purpose: x.purpose || 'any' })) : [],
  missingManifestIconRoutes: []
};
if (!brandIcons.canonicalSvgPresent) issues.push({ severity: 'blocker', finding: 'Canonical Trap Tech app icon SVG is missing.' });
if (mismatchedAliases.length) warnings.push({ severity: 'review', finding: 'Trap Tech icon aliases differ from canonical artwork.', paths: mismatchedAliases });
if (!brandIcons.indexUsesCanonicalSvg || !brandIcons.splashUsesCanonicalSvg) warnings.push({ severity: 'review', finding: 'Browser icon or startup splash does not reference the canonical Trap Tech app icon SVG.' });
if (!brandIcons.dynamicRasterRoutePresent) issues.push({ severity: 'blocker', finding: 'Dynamic Trap Tech raster icon route is missing.' });
if (!brandIcons.manifestValidJson) issues.push({ severity: 'blocker', finding: 'Web app manifest is missing or invalid JSON.' });
for (const item of brandIcons.manifestIcons) {
  if (!item.src || !serverSrc.includes(item.src.split('?')[0])) brandIcons.missingManifestIconRoutes.push(item.src || '(missing src)');
}
if (brandIcons.missingManifestIconRoutes.length) issues.push({ severity: 'blocker', finding: 'Manifest icons do not map to a declared server icon route or static asset.', paths: brandIcons.missingManifestIconRoutes });

const itemIds = [];
for (const m of shopSrc.matchAll(/^\s*\[['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/gm)) {
  itemIds.push({ id: m[1], type: m[2], name: m[3], source: 'shop.js' });
}
const generatorIdPattern = /ID_RE\s*=\s*\/([^/]+)\//;
const shop = {
  staticItemsFound: itemIds.length,
  staticItemIdDuplicates: duplicates(itemIds, x => x.id).map(d => ({ id: d.key, names: d.items.map(x => x.name) })),
  generatorPresent: !!generatorSrc,
  hasStableGeneratedIdRule: generatorIdPattern.test(generatorSrc) && /function hash\(/.test(generatorSrc),
  hasRarityModel: /common.*rare.*epic.*legendary|RARITY|RARITIES/.test(shopSrc + generatorSrc),
  prestigeReferences: (shopSrc + generatorSrc).match(/prestige/gi)?.length || 0,
  warnings: []
};
if (!shop.generatorPresent) shop.warnings.push('Procedural shop generator missing.');
if (!shop.hasStableGeneratedIdRule) shop.warnings.push('Stable generated cosmetic ID rule was not confirmed.');
if (!shop.hasRarityModel) shop.warnings.push('Rarity tiers were not detected.');
if (shop.staticItemIdDuplicates.length) issues.push({ severity: 'duplicate-review', finding: 'Duplicate static shop item IDs', duplicates: shop.staticItemIdDuplicates });

const evidence = {
  generatedAt: new Date().toISOString(),
  mode: 'read-only structural audit of core Hub games and Games Library; not a visual/gameplay/physical-device pass',
  summary: {
    registryGames: games.length,
    coreGamesRegistered: coreGames.length,
    coreGamesWithBlockers: coreRows.filter(r => r.problems.length).length,
    coreGamesWithReviewNotes: coreRows.filter(r => r.notes.length).length,
    gamesWithBlockers: rows.filter(r => r.problems.length).length,
    gamesWithReviewNotes: rows.filter(r => r.notes.length).length,
    duplicateReviewFindings: issues.filter(i => i.severity === 'duplicate-review').length,
    avatar: { editorPresent: avatar.editorPresent, rendererPresent: avatar.rendererPresent, ownershipTestsDetected: avatar.testsCoverOwnership },
    shop: { staticItemsFound: shop.staticItemsFound, duplicateStaticIds: shop.staticItemIdDuplicates.length, generatorPresent: shop.generatorPresent }
  },
  coreGames: coreRows, games: rows, issues, warnings, avatar, shop, brandIcons,
  requiredHumanGates: [
    'Fresh desktop and real Android device playthrough for every game',
    'Record controls, pause/resume, restart, scoring, score submission and invalid/forged-score rejection',
    'Capture title, active gameplay and game-over UI screenshots for every game',
    'Record physical-device P50/P95 frame time and sustained frame drops; do not treat headless GPU results as device proof',
    'Review actual visual identity and near-duplicate mechanics/art; automate detection is triage, not final duplicate verdict',
    'Review every avatar slot, combination, clipping, scale, pose, animation, fallback, mobile responsiveness and save/load path',
    'Audit shop rotation, item preview, owned/equipped states, purchase atomicity, currency deductions, generated-ID stability, one-of-one prestige uniqueness and cosmetics-only fairness',
    'Verify every asset license and source manifest before public launch'
  ]
};
fs.mkdirSync(REPORT_DIR, { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ output: path.relative(ROOT, OUT), summary: evidence.summary, coreGamesAudited: coreRows.length, libraryGamesAudited: rows.length, brandIcons: { canonicalSvgPresent: brandIcons.canonicalSvgPresent, manifestValidJson: brandIcons.manifestValidJson, missingManifestIconRoutes: brandIcons.missingManifestIconRoutes.length }, blockers: issues.length, reviewNotes: warnings.length }, null, 2));
if (issues.some(i => i.severity === 'blocker')) process.exitCode = 1;
