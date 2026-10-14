#!/usr/bin/env node
'use strict';

// Read-only live deployment verification. Does not create accounts or mutate production data.
// Usage: BASE=https://your-deployment.example node tools/verify-live-deployment.js
const fs = require('node:fs');
const path = require('node:path');
const { buildFingerprint } = require('../src/build-info');
const { games } = require('../src/games-lib');

const BASE = String(process.env.BASE || 'https://glassy-drifter-9532.de.deplexo.com').replace(/\/$/, '');
const ROOT = path.resolve(__dirname, '..');
const failures = [];
const results = [];
const check = (name, ok, detail) => {
  const passed = !!ok;
  results.push({ name, ok: passed, ...(detail === undefined ? {} : { detail }) });
  if (!passed) failures.push(name);
  console.log((passed ? 'PASS ' : 'FAIL ') + name + (detail === undefined ? '' : ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail))));
};
async function get(url) {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'Cache-Control': 'no-cache' } });
  const body = Buffer.from(await res.arrayBuffer());
  return { res, body, text: body.toString('utf8'), type: (res.headers.get('content-type') || '').toLowerCase() };
}
async function bounded(items, limit, fn) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) { const i = next++; if (i >= items.length) return; await fn(items[i], i); }
  });
  await Promise.all(workers);
}
function fail(name, detail) { check(name, false, detail); failures.push(name); }
(async () => {
  console.log('Live target:', BASE);
  const expected = buildFingerprint(ROOT);
  const config = fs.readFileSync(path.join(ROOT, 'src/config.js'), 'utf8');
  const block = (config.match(/const GAMES = \[([\s\S]*?)\n\];/) || [])[1] || '';
  const coreAll = [...block.matchAll(/\{\s*id:\s*'([^']+)',\s*title:\s*'([^']+)'[\s\S]*?module:\s*'([^']+)'/g)].map(m => ({ id: m[1], title: m[2], module: m[3] }));
  const RETIRED_CHANCE = new Set(['plinko', 'spin-to-win', 'blazed-roulette']);
  const core = coreAll.filter(g => !RETIRED_CHANCE.has(g.id));
  const index = await get(BASE + '/');
  check('Homepage responds 200', index.res.status === 200, { status: index.res.status, type: index.type });
  if (index.res.status === 200) {
    check('Homepage references canonical Trap Tech icon', index.text.includes('/assets/brand/traptech-app-icon.svg'));
    check('Homepage loads launch redesign stylesheet', index.text.includes('/css/launch-redesign.css'));
    check('Homepage links the PWA manifest', index.text.includes('/manifest.webmanifest'));
  } else failures.push('Homepage responds 200');

  const health = await get(BASE + '/healthz');
  let healthJson = null; try { healthJson = JSON.parse(health.text); } catch {}
  check('Health endpoint responds healthy', health.res.status === 200 && healthJson?.ok === true, { status: health.res.status, body: healthJson });
  if (!(health.res.status === 200 && healthJson?.ok === true)) failures.push('Health endpoint responds healthy');

  const build = await get(BASE + '/api/build');
  let buildJson = null; try { buildJson = JSON.parse(build.text); } catch {}
  check('Build endpoint returns catalog counts', build.res.status === 200 && buildJson?.core_games === core.length && buildJson?.games_library === games.length, { status: build.res.status, expectedCore: core.length, actualCore: buildJson?.core_games, expectedLibrary: games.length, actualLibrary: buildJson?.games_library });
  if (!(build.res.status === 200 && buildJson?.core_games === core.length && buildJson?.games_library === games.length)) failures.push('Build endpoint returns catalog counts');
  check('Deployed source fingerprint matches this checkout', buildJson?.build_fingerprint === expected, { expected, deployed: buildJson?.build_fingerprint || null });
  if (buildJson?.build_fingerprint !== expected) failures.push('Deployed source fingerprint matches this checkout');

  const auditResult = await get(BASE + '/api/audit/report');
  let auditJson = null; try { auditJson = JSON.parse(auditResult.text); } catch {}
  const auditReport = auditJson?.report;
  const auditReady = auditResult.res.status === 200 && auditJson?.ok === true && auditReport?.summary?.registryGames === games.length && auditReport?.summary?.coreGamesRegistered === core.length && Array.isArray(auditReport?.games) && Array.isArray(auditReport?.coreGames) && Array.isArray(auditReport?.issues) && Array.isArray(auditReport?.warnings);
  check('Deep structural audit report is available on the deployed build', auditReady, { status: auditResult.res.status, coreGames: auditReport?.summary?.coreGamesRegistered, libraryGames: auditReport?.summary?.registryGames, blockers: auditReport?.summary?.gamesWithBlockers, coreBlockers: auditReport?.summary?.coreGamesWithBlockers, issues: auditReport?.issues?.length, warnings: auditReport?.warnings?.length });
  if (!auditReady) failures.push('Deep structural audit report is available on the deployed build');
  check('Audit explicitly retains human visual/gameplay gates', auditReady && Array.isArray(auditReport.requiredHumanGates) && auditReport.requiredHumanGates.some(x => /real Android device playthrough/i.test(x)) && auditReport.requiredHumanGates.some(x => /avatar slot/i.test(x)), { gateCount: auditReport?.requiredHumanGates?.length || 0 });
  if (!(auditReady && Array.isArray(auditReport.requiredHumanGates) && auditReport.requiredHumanGates.some(x => /real Android device playthrough/i.test(x)) && auditReport.requiredHumanGates.some(x => /avatar slot/i.test(x)))) failures.push('Audit explicitly retains human visual/gameplay gates');

  check('Full-system source audit retains the manual AAA release gate',
    auditReady && auditReport.releaseGrade === 'STRUCTURAL_ONLY' && auditReport.fullAAAReviewComplete === false &&
    Array.isArray(auditReport.systemChecks) && auditReport.systemChecks.length === 6 &&
    auditReport.systemChecks.every(g => g.passed === g.total && g.e2eExecuted === false && g.physicalDeviceQaComplete === false) &&
    auditReport.summary.releaseSystemContractsPassed === auditReport.summary.releaseSystemContractsTotal &&
    auditReport.summary.missingAchievementGameCount === 0 && auditReport.summary.unresolvedAchievementRewardCount === 0,
    { systems: auditReport?.systemChecks?.length, passed: auditReport?.summary?.releaseSystemContractsPassed,
      total: auditReport?.summary?.releaseSystemContractsTotal, grade: auditReport?.releaseGrade });

  const reviewPage = await get(BASE + '/audit');
  check('Mobile release-control dashboard is served from the same revision',
    reviewPage.res.status === 200 && reviewPage.text.includes('Release Control') && reviewPage.text.includes('/api/audit/report'),
    { status: reviewPage.res.status, bytes: reviewPage.body.length });

  // Private source-model visual lab: the page, module and an actual GLB must serve.
  // Both registered game engines must load the same settings module and CSS.
  // These are HTTP asset checks, not an AAA/mobile quality certification.
  const prefModule = await get(BASE + '/js/player-prefs.js');
  check('Shared game settings ESM serves valid source',prefModule.res.status===200 &&
    prefModule.text.includes('export function openGameSettings') &&
    prefModule.text.includes('saveGlobal'));
  const prefCSS = await get(BASE + '/css/player-prefs.css');
  check('Responsive game settings CSS loads',prefCSS.res.status===200 &&
    prefCSS.text.includes('.ttgs-modal') && prefCSS.text.includes('max-width:360px'));
  const hubApp = await get(BASE + '/js/app.js');
  check('Hub Settings and 13 core games import shared preferences',hubApp.res.status===200 &&
    hubApp.text.includes("import * as GP from './player-prefs.js'") &&
    hubApp.text.includes('GP.openGameSettings('));
  const libKit = await get(BASE + '/games-lib/kit.js');
  // 2026-10-13 Deplexo c118594 STEP 12 smoke failure: old Kit marker
  // lacked the gameSettingsOpen title/input guard added to the real runtime.
  // Verify the full pause/restore and menu-input isolation contract.
  check('Library Kit game settings pause integration is served',libKit.res.status===200 &&
    libKit.text.includes("import('/js/player-prefs.js')") &&
    libKit.text.includes('wasPaused=g.paused;gameSettingsOpen=true;g.paused=true') &&
    libKit.text.includes('g.paused=wasPaused;gameSettingsOpen=false') &&
    libKit.text.includes('g.ptr.pressed=false;g.ptr.released=false') &&
    libKit.text.includes("if (!gameSettingsOpen && (g.state === 'title'") &&
    libKit.text.includes('if(gameSettingsOpen)return; ac();'));
  const vendorSettings = await get(BASE + '/games-lib/vendor-settings.mjs');
  check('Three independent licensed games share a source settings adapter',
    vendorSettings.res.status===200 &&
    vendorSettings.text.includes("gl-bud-merge") &&
    vendorSettings.text.includes("gl-hex-stack") &&
    vendorSettings.text.includes("gl-dino-dash"));
  const vendorPages = await Promise.all(['bud-merge','hex-stack','dino-dash'].map(id=>
    get(BASE+'/games-lib/'+id+'/index.html')));
  check('All three vendor game pages link their settings adapter',
    vendorPages.every(p=>p.res.status===200&&p.text.includes('../vendor-settings.mjs')));
  const runnerScript=await get(BASE+'/games-lib/runner3x.js');
  check('Rail Rush uses real GLB trains and modular saloon',runnerScript.res.status===200 &&
    runnerScript.text.includes('originalTrain(id)') &&
    runnerScript.text.includes('ot-wall-wood-window-glass') &&
    runnerScript.text.includes('const portrait=cam.aspect<0.72'));
  const lab = await get(BASE + '/games-lib/labs/garage/index.html');
  check('Vehicle 3D QA page HTTP 200',lab.res.status===200&&lab.text.includes('PRIVATE QA'));
  const cfgLab = await get(BASE + '/games-lib/labs/garage/vehicles.json');
  let labModels;try{labModels=JSON.parse(cfgLab.text)}catch{}
  check('Vehicle QA manifest has six original models',
    cfgLab.res.status===200&&labModels?.previewOnly===true&&labModels?.models?.length===6);
  const labScript = await get(BASE + '/games-lib/labs/garage/garage.mjs');
  check('Vehicle viewer ESM is served',labScript.res.status===200&&labScript.text.includes('GLTFLoader'));
  const labGlb = await get(BASE + '/games-lib/assets3d/rc-sedan.glb');
  check('Vehicle source GLB loads through Express',
    labGlb.res.status===200&&labGlb.body.length>20000&&labGlb.body.subarray(0,4).toString('ascii')==='glTF');
  const storeResult = await get(BASE + '/api/store');
  let storeJson = null; try { storeJson = JSON.parse(storeResult.text); } catch {}
  const prestigeItems = storeJson?.prestige || [];
  const prestigeIds = prestigeItems.map(p => p.id);
  const prestigeReady = storeResult.res.status === 200 && prestigeItems.length === 12 && new Set(prestigeIds).size === 12 && prestigeItems.every(p => p.supply === 1 && p.usd_cents >= 100000);
  check('Store returns 12 one-of-one originals priced at $1,000+', prestigeReady, { status: storeResult.res.status, count: prestigeItems.length, unique: new Set(prestigeIds).size, invalid: prestigeItems.filter(p => p.supply !== 1 || p.usd_cents < 100000).map(p => p.id) });
  if (!prestigeReady) failures.push('Store returns 12 one-of-one originals priced at $1,000+');
  check('Prestige sales remain preview-only until wearable release approval', storeResult.res.status === 200 && storeJson?.prestige_sales_enabled === false, { status: storeResult.res.status, enabled: storeJson?.prestige_sales_enabled });
  if (!(storeResult.res.status === 200 && storeJson?.prestige_sales_enabled === false)) failures.push('Prestige sales remain preview-only until wearable release approval');

  const storeUi = await get(BASE + '/js/hub-store.js');
  check('Store UI loads the Prestige preview-only gate', storeUi.res.status === 200 && storeUi.text.includes('Preview only') && storeUi.text.includes('/assets/prestige/'), { status: storeUi.res.status });
  if (!(storeUi.res.status === 200 && storeUi.text.includes('Preview only') && storeUi.text.includes('/assets/prestige/'))) failures.push('Store UI loads the Prestige preview-only gate');

  // Exercise the generated 1,200-item rotating cosmetics catalog and its public pagination before release.
  const cosmeticFirstResult = await get(BASE + '/api/shop/catalog?limit=24&offset=0');
  let cosmeticFirst = null; try { cosmeticFirst = JSON.parse(cosmeticFirstResult.text); } catch {}
  const firstItems = Array.isArray(cosmeticFirst?.items) ? cosmeticFirst.items : [];
  const firstIds = firstItems.map(i => i && i.id).filter(Boolean);
  const cosmeticFirstReady = cosmeticFirstResult.res.status === 200 && cosmeticFirst?.ok === true && cosmeticFirst.catalog_size === 1200 && cosmeticFirst.total === 1200 && cosmeticFirst.limit === 24 && cosmeticFirst.offset === 0 && firstItems.length === 24 && firstIds.length === 24 && new Set(firstIds).size === 24 && firstItems.every(i => i && typeof i.name === 'string' && i.name.length > 0);
  check('Rotating cosmetics catalog returns 1,200 items and a valid first page', cosmeticFirstReady, { status: cosmeticFirstResult.res.status, catalogSize: cosmeticFirst?.catalog_size, total: cosmeticFirst?.total, pageItems: firstItems.length, uniqueIds: new Set(firstIds).size });
  if (!cosmeticFirstReady) failures.push('Rotating cosmetics catalog returns 1,200 items and a valid first page');
  const [cosmeticNextResult, cosmeticTailResult] = await Promise.all([
    get(BASE + '/api/shop/catalog?limit=24&offset=24'),
    get(BASE + '/api/shop/catalog?limit=24&offset=1176')
  ]);
  let cosmeticNext = null, cosmeticTail = null;
  try { cosmeticNext = JSON.parse(cosmeticNextResult.text); } catch {}
  try { cosmeticTail = JSON.parse(cosmeticTailResult.text); } catch {}
  const nextItems = Array.isArray(cosmeticNext?.items) ? cosmeticNext.items : [];
  const tailItems = Array.isArray(cosmeticTail?.items) ? cosmeticTail.items : [];
  const nextIds = nextItems.map(i => i && i.id).filter(Boolean);
  const tailIds = tailItems.map(i => i && i.id).filter(Boolean);
  const pageSetsValid = cosmeticNextResult.res.status === 200 && cosmeticNext?.ok === true && cosmeticNext.total === 1200 && cosmeticNext.offset === 24 && nextItems.length === 24 && nextIds.length === 24 && new Set(nextIds).size === 24 && !nextIds.some(id => firstIds.includes(id)) && cosmeticTailResult.res.status === 200 && cosmeticTail?.ok === true && cosmeticTail.total === 1200 && cosmeticTail.offset === 1176 && tailItems.length === 24 && tailIds.length === 24 && new Set(tailIds).size === 24 && !tailIds.some(id => firstIds.includes(id) || nextIds.includes(id));
  check('Cosmetic pagination returns non-overlapping middle and final pages', pageSetsValid, { middleStatus: cosmeticNextResult.res.status, middleItems: nextItems.length, finalStatus: cosmeticTailResult.res.status, finalItems: tailItems.length, crossPageOverlaps: tailIds.filter(id => firstIds.includes(id) || nextIds.includes(id)).length });
  if (!pageSetsValid) failures.push('Cosmetic pagination returns non-overlapping middle and final pages');

  const manifestResult = await get(BASE + '/manifest.webmanifest');
  let manifest = null; try { manifest = JSON.parse(manifestResult.text); } catch {}
  check('PWA manifest responds with valid JSON', manifestResult.res.status === 200 && !!manifest && Array.isArray(manifest.icons), { status: manifestResult.res.status, icons: manifest?.icons?.length || 0 });
  if (!(manifestResult.res.status === 200 && manifest && Array.isArray(manifest.icons))) failures.push('PWA manifest responds with valid JSON');

  // Container-build smoke mode deliberately verifies the highest-value HTTP contracts without
  // crawling every game and asset under a CPU/memory-constrained image builder. The full audit
  // remains available when BUILD_SMOKE is unset and is intended for a provisioned test runner.
  if (process.env.BUILD_SMOKE === '1') {
    const uniqueFailures = [...new Set(failures)];
    const summary = { mode: 'build-smoke', base: BASE, expectedFingerprint: expected, deployedFingerprint: buildJson?.build_fingerprint || null, checks: results.length, passed: results.filter(x => x.ok).length, failed: uniqueFailures.length, failures: uniqueFailures };
    console.log('\\nBUILD SMOKE VERIFICATION SUMMARY\\n' + JSON.stringify(summary, null, 2));
    process.exit(failures.length ? 1 : 0);
  }

  const svgPaths = ['/assets/brand/traptech-app-icon.svg', '/assets/brand/favicon.svg', '/assets/brand/hub-mark.svg', '/assets/brand/tt-favicon.svg', '/assets/brand/tt-maskable.svg'];
  const svgBodies = {};
  await bounded(svgPaths, 5, async p => {
    try {
      const r = await get(BASE + p);
      const ok = r.res.status === 200 && r.type.includes('image/svg+xml') && r.text.includes('<svg');
      check('Brand SVG ' + p, ok, { status: r.res.status, type: r.type });
      if (!ok) failures.push('Brand SVG ' + p);
      svgBodies[p] = r.text.trim();
    } catch (e) { fail('Brand SVG ' + p, e.message); }
  });
  if (svgBodies[svgPaths[0]]) {
    const mismatch = svgPaths.slice(1).filter(p => svgBodies[p] && svgBodies[p] !== svgBodies[svgPaths[0]]);
    check('All deployed Trap Tech icon aliases match canonical artwork', mismatch.length === 0, mismatch);
    if (mismatch.length) failures.push('All deployed Trap Tech icon aliases match canonical artwork');
  }

  const pngPaths = [
    ['/assets/icons/icon-192.png?v=traptech-1', 192],
    ['/assets/icons/icon-512.png?v=traptech-1', 512],
    ['/assets/icons/maskable-512.png?v=traptech-1', 512],
    ['/assets/icons/apple-touch-icon.png?v=traptech-1', 180],
    ['/assets/brand/favicon.png?v=traptech-1', 64]
  ];
  for (const [p, size] of pngPaths) {
    try {
      const r = await get(BASE + p);
      const png = r.body.length >= 24 && r.body.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      const width = png ? r.body.readUInt32BE(16) : 0, height = png ? r.body.readUInt32BE(20) : 0;
      const ok = r.res.status === 200 && r.type.includes('image/png') && png && width === size && height === size;
      check('PNG icon ' + p.split('?')[0], ok, { status: r.res.status, type: r.type, width, height, bytes: r.body.length });
      if (!ok) failures.push('PNG icon ' + p.split('?')[0]);
    } catch (e) { fail('PNG icon ' + p.split('?')[0], e.message); }
  }
  if (manifest?.icons) {
    await bounded(manifest.icons, 5, async icon => {
      try {
        const r = await get(BASE + icon.src);
        const ok = r.res.status === 200 && r.type.includes('image/png');
        check('Manifest icon ' + icon.src, ok, { status: r.res.status, type: r.type });
        if (!ok) failures.push('Manifest icon ' + icon.src);
      } catch (e) { fail('Manifest icon ' + icon.src, e.message); }
    });
  }

  const monetizeSource = fs.readFileSync(path.join(ROOT, 'src/monetize.js'), 'utf8');
  const prestigeBlock = (monetizeSource.match(/const PRESTIGE = \{([\s\S]*?)\n\};/) || [])[1] || '';
  const prestigeSlugs = [...prestigeBlock.matchAll(/^\s*'prestige-original-([^']+)':/gm)].map(m => m[1]);
  const prestigeFailures = [];
  await bounded(prestigeSlugs, 6, async slug => {
    const p = '/assets/prestige/' + slug + '.svg';
    try {
      const r = await get(BASE + p);
      if (r.res.status !== 200 || !r.type.includes('image/svg+xml') || !r.text.trim().startsWith('<svg') || r.body.length > 30000 || /<script\b|(?:href|src)=["']https?:/i.test(r.text)) prestigeFailures.push({ path: p, status: r.res.status, type: r.type, bytes: r.body.length });
    } catch (e) { prestigeFailures.push({ path: p, error: e.message }); }
  });
  check('All one-of-one Prestige SVGs are served as safe vector art', prestigeSlugs.length === 12 && prestigeFailures.length === 0, { count: prestigeSlugs.length, failures: prestigeFailures });

  const fixedPages = ['/games', '/games-lib/index.html', '/css/launch-redesign.css'];
  await bounded(fixedPages, 3, async p => {
    try {
      const r = await get(BASE + p);
      const ok = r.res.status === 200 && (p.endsWith('.css') ? r.type.includes('text/css') : true);
      check('Page/asset ' + p, ok, { status: r.res.status, type: r.type, bytes: r.body.length });
      if (!ok) failures.push('Page/asset ' + p);
    } catch (e) { fail('Page/asset ' + p, e.message); }
  });

  await bounded(core, 6, async g => {
    const p = '/js/' + g.module;
    try {
      const r = await get(BASE + p);
      const ok = r.res.status === 200 && r.body.length > 100;
      check('Core game module ' + g.id, ok, { status: r.res.status, bytes: r.body.length });
      if (!ok) failures.push('Core game module ' + g.id);
    } catch (e) { fail('Core game module ' + g.id, e.message); }
  });

  const localAssets = new Map();
  await bounded(games, 8, async g => {
    const p = '/games-lib/' + g.slug + '/index.html';
    try {
      const r = await get(BASE + p);
      const ok = r.res.status === 200 && /<html|<!doctype html/i.test(r.text);
      check('Library entry ' + g.slug, ok, { status: r.res.status, bytes: r.body.length });
      if (!ok) failures.push('Library entry ' + g.slug);
      if (!ok) return;
      for (const m of r.text.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
        const ref = m[1].trim();
        if (!ref || /^(?:https?:|\/\/|data:|#|javascript:|mailto:|tel:)/i.test(ref)) continue;
        let u;
        try { u = new URL(ref, BASE + p); } catch { continue; }
        if (u.origin !== new URL(BASE).origin) continue;
        if (!/\.(?:js|mjs|css|json|wasm|png|jpe?g|webp|avif|gif|svg|woff2?|ttf|otf|mp3|ogg|wav|ico)$/i.test(u.pathname)) continue;
        localAssets.set(u.pathname, (localAssets.get(u.pathname) || new Set()).add(g.slug));
      }
    } catch (e) { fail('Library entry ' + g.slug, e.message); }
  });
  // Validate local dependencies used by the catalog, not just its HTML shell. This catches
  // missing scripts, styles, atlases, textures and fonts that static entry checks can miss.
  const nestedCssAssets = new Map();
  await bounded([...localAssets.entries()], 12, async ([asset, slugsForAsset]) => {
    try {
      const r = await get(BASE + asset);
      const ok = r.res.status === 200 && r.body.length > 0;
      check('Library dependency ' + asset, ok, { status: r.res.status, bytes: r.body.length, referencedBy: [...slugsForAsset].slice(0, 5), gameCount: slugsForAsset.size });
      if (ok && /\.css$/i.test(asset)) {
        for (const m of r.text.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)) {
          const ref = m[2].trim();
          if (!ref || /^(?:data:|#|blob:|https?:|\/\/)/i.test(ref)) continue;
          let u; try { u = new URL(ref, BASE + asset); } catch { continue; }
          if (u.origin !== new URL(BASE).origin || !/\.(?:png|jpe?g|webp|avif|gif|svg|woff2?|ttf|otf|ico)$/i.test(u.pathname)) continue;
          let users = nestedCssAssets.get(u.pathname);
          if (!users) { users = new Set(); nestedCssAssets.set(u.pathname, users); }
          for (const slug of slugsForAsset) users.add(slug);
        }
      }
    } catch (e) { fail('Library dependency ' + asset, e.message); }
  });
  const cssAssetFailures = [];
  await bounded([...nestedCssAssets.entries()], 12, async ([asset, slugsForAsset]) => {
    try {
      const r = await get(BASE + asset);
      if (r.res.status !== 200 || !r.body.length) cssAssetFailures.push({ path: asset, status: r.res.status, bytes: r.body.length, referencedBy: [...slugsForAsset].slice(0, 5) });
    } catch (e) { cssAssetFailures.push({ path: asset, error: e.message }); }
  });
  check('All CSS-referenced local assets respond', cssAssetFailures.length === 0, { checked: nestedCssAssets.size, failures: cssAssetFailures.slice(0, 100) });

  const uniqueFailures = [...new Set(failures)];
  const summary = { base: BASE, expectedFingerprint: expected, deployedFingerprint: buildJson?.build_fingerprint || null, checks: results.length, passed: results.filter(x => x.ok).length, failed: uniqueFailures.length, failures: uniqueFailures };
  console.log('\nLIVE VERIFICATION SUMMARY\n' + JSON.stringify(summary, null, 2));
  process.exitCode = failures.length ? 1 : 0;
})().catch(e => { console.error('Live verification aborted:', e); process.exitCode = 2; });
