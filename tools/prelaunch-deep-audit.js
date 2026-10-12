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
  if (g.build === 'built' && !js) problems.push('built game.js missing/unreadable');
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
    slug, id: g.id, title: g.title, category: g.category, build: g.build,
    htmlHash: html ? hash(html) : null, gameJsHash: js ? hash(js) : null,
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
  mode: 'read-only structural audit; not a visual/gameplay/physical-device pass',
  summary: {
    registryGames: games.length,
    gamesWithBlockers: rows.filter(r => r.problems.length).length,
    gamesWithReviewNotes: rows.filter(r => r.notes.length).length,
    duplicateReviewFindings: issues.filter(i => i.severity === 'duplicate-review').length,
    avatar: { editorPresent: avatar.editorPresent, rendererPresent: avatar.rendererPresent, ownershipTestsDetected: avatar.testsCoverOwnership },
    shop: { staticItemsFound: shop.staticItemsFound, duplicateStaticIds: shop.staticItemIdDuplicates.length, generatorPresent: shop.generatorPresent }
  },
  games: rows, issues, warnings, avatar, shop,
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
console.log(JSON.stringify({ output: path.relative(ROOT, OUT), summary: evidence.summary, blockers: issues.length, reviewNotes: warnings.length }, null, 2));
if (issues.some(i => i.severity === 'blocker')) process.exitCode = 1;
