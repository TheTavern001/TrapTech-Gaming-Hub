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
  const core = [...block.matchAll(/\{\s*id:\s*'([^']+)',\s*title:\s*'([^']+)'[\s\S]*?module:\s*'([^']+)'/g)].map(m => ({ id: m[1], title: m[2], module: m[3] }));
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

  const manifestResult = await get(BASE + '/manifest.webmanifest');
  let manifest = null; try { manifest = JSON.parse(manifestResult.text); } catch {}
  check('PWA manifest responds with valid JSON', manifestResult.res.status === 200 && !!manifest && Array.isArray(manifest.icons), { status: manifestResult.res.status, icons: manifest?.icons?.length || 0 });
  if (!(manifestResult.res.status === 200 && manifest && Array.isArray(manifest.icons))) failures.push('PWA manifest responds with valid JSON');

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
