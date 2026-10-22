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
  if (source && /Math\.random\(\)/.test(source) && /score|submit/i.test(source)) notes.push('module contains Math.random and scoring logic; inspect call sites to distinguish gameplay RNG from visual/audio effects');
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

const RETIRED_DUPLICATE_SLUGS = Object.freeze(["jet-blaster","sky-flap","hoop-flap","slab-stack","neon-snake","brick-blitz","sling-siege","castle-crush","moto-lanes","lane-racer","ruin-runner","gem-rush","toad-cross","bat-boy","highway-heist","park-getaway","night-shift","hill-glider","pen-throw","lawn-guard"]);
if (games.length < 80) issues.push({ severity: 'blocker', finding: 'Curated Games Library has fewer than its 80-game baseline; review retired game decisions: ' + games.length });
if (new Set(games.map(g => g.slug)).size !== games.length) issues.push({ severity: 'blocker', finding: 'Duplicate Games Library slugs in active registry' });
for (const slug of RETIRED_DUPLICATE_SLUGS) {
  if (games.some(g => g.slug === slug)) issues.push({ severity: 'blocker', finding: 'Retired duplicate still registered: ' + slug });
  if (exists(path.join(GAME_ROOT, slug))) issues.push({ severity: 'blocker', finding: 'Retired duplicate game folder still ships: ' + slug });
}
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
  // Original Hub-built games require game.js; vendored games have their own multi-file entrypoints.
  if (g.build === 'built' && !js) problems.push('built game.js missing/unreadable');
  if (g.build === 'vendored' && html && !/<script[^>]+src=["'][^"']+\.js["']/i.test(html)) problems.push('vendored game has no script entrypoint');
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
    if (/Math\.random\(\)/.test(js) && /score|submit/i.test(js)) notes.push('module contains Math.random and scoring logic; inspect call sites to distinguish gameplay RNG from visual/audio effects');
    if (/innerHTML\s*=\s*[^;]*(?:username|title|message|error)/i.test(js)) notes.push('review dynamic HTML writes for escaping/XSS');
  }
  const record = {
    slug, id: g.id, title: g.title, category: g.category, build: g.build, source: g.source || g.src || 'unknown',
    implementationPresent: !!js || (g.build === 'vendored' && !!html), htmlHash: html ? hash(html) : null, gameJsHash: js ? hash(js) : null,
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

for (const d of duplicates(games.filter(g => !g.retired), g => normalized(g.ref_internal))) { // retired ids only redirect to their replacement
  issues.push({ severity: 'duplicate-review', finding: 'Duplicate internal gameplay reference; review whether these are duplicate game loops', key: d.key, slugs: d.items.map(g => g.slug) });
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
  const route = String(item.src || '').split('?')[0];
  // Manifest icons may be served either by an explicit server route or by the public static-file middleware.
  // Do not flag a valid static asset merely because its URL is not hard-coded in src/server.js.
  const staticPath = route.startsWith('/') ? path.join(ROOT, 'public', route.slice(1)) : '';
  if (!route || (!serverSrc.includes(route) && !(staticPath && exists(staticPath)))) {
    brandIcons.missingManifestIconRoutes.push(item.src || '(missing src)');
  }
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


// Cross-system release contracts: structural presence and registry consistency only.
// Test script presence is NOT evidence that any E2E test has been executed.
const achievementSrc = read(path.join(ROOT, 'src', 'achievements.js')) || '';
const cosmeticSrc = read(path.join(ROOT, 'src', 'cosmetics.js')) || '';
const questsSrc = read(path.join(ROOT, 'src', 'rotating-quests.js')) || '';
const anticheatSrc = read(path.join(ROOT, 'src', 'anticheat.js')) || '';
const monetizationSrc = read(path.join(ROOT, 'src', 'monetize.js')) || '';
const playoffSrc = read(path.join(ROOT, 'src', 'games-lib-playoff.js')) || '';
const perGameDefs = (achievementSrc.match(/const PER_GAME = \{([\s\S]*?)\n\};/) || [])[1] || '';
const perGameIds = [...perGameDefs.matchAll(/^\s*(?:'([^']+)'|([a-z][a-z0-9-]*)):\s*\{/gm)].map(m => m[1] || m[2]);
const missingGameAchievements = coreGames.filter(g => !perGameIds.includes(g.id)).map(g => g.id);
const duplicateGameAchievements = duplicates(perGameIds, id => id).map(g => g.key);
const cosmeticDefinitions = {
  banner: (cosmeticSrc.match(/const BANNERS = \[([\s\S]*?)\]\.map\(/) || [])[1] || '',
  frame: (cosmeticSrc.match(/const FRAMES = \[([\s\S]*?)\]\.map\(/) || [])[1] || '',
  title: (cosmeticSrc.match(/const TITLES = \[([\s\S]*?)\]\s*\.map\(/) || [])[1] || ''
};
const cosmeticIds = {
  banner: new Set([...cosmeticDefinitions.banner.matchAll(/^\s*\['([^']+)'/gm)].map(m => m[1])),
  frame: new Set([...cosmeticDefinitions.frame.matchAll(/^\s*\['([^']+)'/gm)].map(m => m[1])),
  title: new Set([...cosmeticDefinitions.title.matchAll(/'([^']+)'/g)].map(m => normalized(m[1]).replace(/\s+/g, '-')))
};
for (const m of shopSrc.matchAll(/^\s*\['([^']+)',\s*'([^']+)'/gm)) {
  if (cosmeticIds[m[2]]) cosmeticIds[m[2]].add(m[1]);
}
const achievementRewards = [...achievementSrc.matchAll(/R\(['"]([^'"]+)['"],\s*['"]([^'"]+)['"]\)/g)].map(m => ({ type: m[1], id: m[2] }));
const unresolvableRewards = achievementRewards.filter(r => !cosmeticIds[r.type]?.has(r.id));
const skillTieBreakMetadata = games.every(g => Array.isArray(g.tiebreak) && g.tiebreak.some(t => /skill:/.test(t)) &&
  g.tiebreak.some(t => /sudden-death/i.test(t)) && !g.tiebreak.some(t => /timestamp|fewer attempts|submission time/i.test(t)));
const systemChecks = [
  { id: 'games', label: 'Games and scored gameplay', checks: [
    { name: 'Every core game has a local module', pass: coreRows.every(r => r.problems.length === 0) },
    { name: 'Every current library entry has HTML and expected game implementation', pass: games.length >= 80 && rows.length === games.length && rows.every(r => r.problems.length === 0) },
    { name: 'Signed-run route and anti-cheat implementation exist', pass: serverSrc.includes('/api/run/start') && serverSrc.includes('/api/score') && /validate|reject|rate/i.test(anticheatSrc) },
    { name: 'Browser, Android and forged-score test harnesses present', pass: ['e2e-games-lib.js','e2e-mobile.js','e2e-anticheat.js'].every(p => exists(path.join(ROOT, 'tools', p))) }
  ] },
  { id: 'achievements', label: 'Achievements and earned rewards', checks: [
    { name: 'All 16 configured core games define five milestones', pass: missingGameAchievements.length === 0 && duplicateGameAchievements.length === 0 },
    { name: 'All achievement cosmetic rewards resolve to actual IDs', pass: unresolvableRewards.length === 0 },
    { name: 'Server-side achievement evaluation source present', pass: /function evaluate\(|const evaluate\s*=/.test(achievementSrc) }
  ], metrics: { coreGamesCovered: perGameIds.length, rewardReferences: achievementRewards.length, missingGameAchievements, unresolvableRewards } },
  { id: 'quests', label: 'Quests, XP and player progression', checks: [
    { name: 'Server quest objectives and tiers defined', pass: questsSrc.includes('const OBJECTIVES') && questsSrc.includes('const TIERS') },
    { name: 'Client quest reward metadata is rejected', pass: questsSrc.includes('Never accept client-modified') },
    { name: 'Quest progression regression harness present', pass: exists(path.join(ROOT, 'tools', 'test-rotating-quests.js')) }
  ] },
  { id: 'avatar', label: 'Avatars and profile customization', checks: [
    { name: 'Avatar server, editor and 3D renderer sources present', pass: avatar.serverModulePresent && avatar.editorPresent && avatar.rendererPresent },
    { name: 'Ownership restrictions and negative API tests present', pass: avatar.serverChecksOwnership && avatar.testsCoverOwnership },
    { name: 'Avatar SVG fallback present', pass: /avatar-preview\.svg/.test(avatarEditor) && /<svg/.test(avatarSrc) }
  ] },
  { id: 'shop', label: 'Shop, cosmetics, seasons and payments', checks: [
    { name: 'Procedural catalog and rarity model defined', pass: shop.generatorPresent && shop.hasRarityModel },
    { name: 'Economy and payment regression harnesses present', pass: exists(path.join(ROOT, 'tools', 'e2e-economy.js')) && exists(path.join(ROOT, 'tools', 'e2e-payments.js')) },
    { name: 'Prestige originality uniqueness database constraint', pass: monetizationSrc.includes('prestige_original_one_owner') },
    { name: 'Achievement reward cosmetics exist', pass: unresolvableRewards.length === 0 }
  ] },
  { id: 'giveaways', label: 'Giveaways and competition integrity', checks: [
    { name: 'Public game catalog declares skill-only tie-breaking', pass: skillTieBreakMetadata },
    { name: 'Server-derived metrics and equal-seed playoff source present', pass: playoffSrc.includes('function derive(') && playoffSrc.includes('lib_playoffs') },
    { name: 'Giveaway and tie-break test harnesses present', pass: exists(path.join(ROOT, 'tools', 'e2e-events.js')) && exists(path.join(ROOT, 'tools', 'e2e-tiebreak.js')) }
  ] }
].map(group => ({ ...group, passed: group.checks.filter(c => c.pass).length, total: group.checks.length, e2eExecuted: false, physicalDeviceQaComplete: false }));
const failedSystemContracts = systemChecks.flatMap(group => group.checks.filter(c => !c.pass).map(c => ({ system: group.id, check: c.name })));
if (missingGameAchievements.length) issues.push({ severity: 'blocker', finding: 'Core games lack per-game achievement milestones', ids: missingGameAchievements });
if (duplicateGameAchievements.length) issues.push({ severity: 'blocker', finding: 'Duplicate per-game achievement definition', ids: duplicateGameAchievements });
if (unresolvableRewards.length) issues.push({ severity: 'blocker', finding: 'Achievement rewards reference unknown cosmetic IDs', rewards: unresolvableRewards });
if (!skillTieBreakMetadata) issues.push({ severity: 'blocker', finding: 'Catalog describes non-skill tie-breaking despite seeded playoff requirement' });
if (failedSystemContracts.length) issues.push({ severity: 'blocker', finding: 'Required structural release contracts missing', checks: failedSystemContracts });

const evidence = {
  generatedAt: new Date().toISOString(),
  mode: 'read-only structural audit of core Hub games and Games Library; not a visual/gameplay/physical-device pass',
  summary: {
    registryGames: games.length,
    releaseSystemContractsPassed: systemChecks.reduce((sum,g) => sum + g.passed, 0),
    releaseSystemContractsTotal: systemChecks.reduce((sum,g) => sum + g.total, 0),
    missingAchievementGameCount: missingGameAchievements.length,
    unresolvedAchievementRewardCount: unresolvableRewards.length,
    // Match the public runtime registry: archived chance games are audited below but are not active core titles.
    coreGamesRegistered: coreGames.filter(g => !new Set(['plinko', 'spin-to-win', 'blazed-roulette']).has(g.id)).length,
    coreGamesWithBlockers: coreRows.filter(r => r.problems.length).length,
    coreGamesWithReviewNotes: coreRows.filter(r => r.notes.length).length,
    gamesWithBlockers: rows.filter(r => r.problems.length).length,
    gamesWithReviewNotes: rows.filter(r => r.notes.length).length,
    duplicateReviewFindings: issues.filter(i => i.severity === 'duplicate-review').length,
    activeRegistryReferences: new Set(games.map(g => normalized(g.ref_internal)).filter(Boolean)).size,
    avatar: { editorPresent: avatar.editorPresent, rendererPresent: avatar.rendererPresent, ownershipTestsDetected: avatar.testsCoverOwnership },
    shop: { staticItemsFound: shop.staticItemsFound, duplicateStaticIds: shop.staticItemIdDuplicates.length, generatorPresent: shop.generatorPresent }
  },
  coreGames: coreRows, games: rows, issues, warnings, avatar, shop, brandIcons, systemChecks,
  releaseGrade: 'STRUCTURAL_ONLY', fullAAAReviewComplete: false,
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
