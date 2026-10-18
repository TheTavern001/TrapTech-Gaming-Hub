#!/usr/bin/env node
'use strict';
// Isolated HTTP regression; never contacts production or opens a real database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const express = require('express');
const ROOT = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-library-cache-'));
const pub = path.join(tmp, 'public');
let server, checks = 0;
const check = (ok, message) => { assert.ok(ok, message); checks++; };
const write = (name, body) => { const f = path.join(tmp, name); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); };
const html = '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="../lib.css"></head><body><script type="importmap">{"imports":{"three":"../vendor/three.module.min.js"}}</script><script src="../kit.js"></script><script type="module" src="game.js"></script></body></html>';
async function main() {
  for (const name of ['build-id.js', 'library-pages.js']) write('src/' + name, fs.readFileSync(path.join(ROOT, 'src', name)));
  write('public/games-lib/probe/index.html', html);
  write('public/games-lib/probe/game.js', "import { value } from '../shared.js'; import { addon } from 'three/addons/probe.js'; document.body.dataset.result=value+addon;");
  write('public/games-lib/shared.js', "export const value='current-';");
  write('public/games-lib/vendor/three-addons/probe.js', "export const addon='addon';");
  write('public/games-lib/vendor/three.module.min.js', 'export const REVISION=1;');
  write('public/games-lib/kit.js', 'window.KIT=true;');
  write('public/games-lib/lib.css', 'body{color:lime}');
  write('public/index.html', '<html><head><script type="importmap">{}</script></head><body>shell</body></html>');
  write('public/sw.js', "const CACHE='__BUILD__';");
  const env = { ...process.env }; delete env.BUILD_ID;
  const getId = () => execFileSync(process.execPath, ['-e', `process.stdout.write(require(${JSON.stringify(path.join(tmp, 'src/build-id.js'))}).BID)`], { env }).toString();
  const id1 = getId(); write('public/games-lib/shared.js', "export const value='current-'; // changed library only");
  const id2 = getId(); check(id1 !== id2, 'library-only code changes invalidate the build ID');
  const BI = require(path.join(tmp, 'src/build-id.js'));
  const render = require(path.join(tmp, 'src/library-pages.js'));
  const imports = JSON.parse(BI.IMPORTMAP_JSON).imports;
  check(imports['/games-lib/shared.js'].endsWith('?v=' + BI.BID), 'transitive relative import is versioned');
  check(imports['three/addons/probe.js'].endsWith('?v=' + BI.BID), 'bare addon import is versioned without recursive remapping');
  check(BI.IMPORTMAP_HASH === "'sha256-" + crypto.createHash('sha256').update(BI.IMPORTMAP_JSON).digest('base64') + "'", 'CSP hash matches rendered map');
  check(BI.ver('/x.js?a=1&v=old#frag') === '/x.js?a=1&v=' + BI.BID + '#frag', 'version replacement preserves query and fragment');
  const transformed = render.transform(html, '/games-lib/probe/index.html');
  check((transformed.match(/type="importmap"/g) || []).length === 1, 'exactly one import map');
  check(transformed.indexOf('type="importmap"') < transformed.indexOf('type="module"'), 'map precedes modules');
  check(transformed.includes('/games-lib/kit.js?v=' + BI.BID) && transformed.includes('/games-lib/lib.css?v=' + BI.BID), 'classic scripts and styles are versioned');
  check(render.transform('<html><head></head><script src="https://example.test/x.js"></script></html>', '/games-lib/probe/index.html').includes('src="https://example.test/x.js"'), 'external URLs are unchanged');
  // Fake a valid prebuild manifest with raw HTML/SW: these must never bypass rendering.
  const files = {};
  for (const p of ['/games-lib/probe/index.html', '/index.html', '/sw.js', '/games-lib/kit.js']) {
    const f = path.join(pub, p.slice(1)), st = fs.statSync(f), gz = p.slice(1) + '.gz';
    write('build/gz/' + gz, zlib.gzipSync(fs.readFileSync(f)));
    files[p] = { gz, size: st.size, mtime: Math.round(st.mtimeMs) };
  }
  write('build/gz/manifest.json', JSON.stringify({ files }));
  process.env.BUILD_DIR = path.join(tmp, 'build');
  const app = express();
  const gate = require('../src/private-review').makeGate({ enabled: true, users: 'reviewer', reviewerExists: () => true, currentUser: req => req.headers['x-test-reviewer'] ? { username: 'reviewer' } : null });
  app.use(gate);
  app.get(['/index', '/index.html'], (req, res) => res.redirect(302, '/'));
  app.use(render(pub));
  app.use(require('../src/static-gz')(pub));
  app.get('/sw.js', (req, res) => res.type('js').send(BI.swSource()));
  app.use(express.static(pub, { index: false }));
  app.get('/', (req, res) => res.type('html').send(BI.transformIndex(fs.readFileSync(path.join(pub, 'index.html'), 'utf8'))));
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const headers = { 'x-test-reviewer': '1', 'accept-encoding': 'gzip' };
  for (const p of ['/games-lib/probe/index.html', '/games-lib/probe/', '/games-lib/probe/index']) {
    const r = await fetch(base + p, { headers }), body = await r.text();
    check(r.status === 200 && body.includes('/games-lib/probe/game.js?v=' + BI.BID), 'rendered GET ' + p);
    check(r.headers.get('cache-control') === 'no-store', 'HTML cannot be persisted ' + p);
  }
  const worker = await (await fetch(base + '/sw.js', { headers })).text();
  check(!worker.includes('__BUILD__') && worker.includes(BI.BID), 'gzip does not serve raw SW placeholder');
  const canonical = await fetch(base + '/index.html', { headers, redirect: 'manual' });
  check(canonical.status === 302 && canonical.headers.get('location') === '/', 'raw shell goes through canonical runtime route');
  const gz = await fetch(base + '/games-lib/kit.js', { headers });
  check(gz.headers.get('content-encoding') === 'gzip' && (await gz.text()).includes('window.KIT'), 'JS still uses precompression');
  const denied = await fetch(base + '/games-lib/probe/index.html');
  check(denied.status === 503 && !(await denied.text()).includes('type="importmap"'), 'private review still gates library HTML');
  const head = await fetch(base + '/games-lib/probe/index.html', { method: 'HEAD', headers });
  check(head.status === 200 && !(await head.text()), 'HEAD semantics preserved');
  check((await fetch(base + '/games-lib/missing/index.html', { headers })).status === 404, 'missing game stays 404');
  const actual = fs.readFileSync(path.join(ROOT, 'src/server.js'), 'utf8');
  check(actual.indexOf('app.use(PRIVATE_REVIEW.makeGate') < actual.indexOf("require('./library-pages')") && actual.indexOf("require('./library-pages')") < actual.indexOf("require('./static-gz')"), 'production order retains authorization before game rendering and gzip');
  // Exercise every repository game document, including nested lab/admin pages.
  const actualBI = require('../src/build-id');
  const actualRender = require('../src/library-pages').transform;
  let documents = 0;
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(f); continue; }
      if (!entry.name.endsWith('.html')) continue;
      const page = '/' + path.relative(path.join(ROOT, 'public'), f).split(path.sep).join('/');
      const result = actualRender(fs.readFileSync(f, 'utf8'), page);
      assert.equal((result.match(/type="importmap"/g) || []).length, 1, page);
      for (const m of result.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)=["']([^"']+)["']/gi)) {
        const u = new URL(m[1].replace(/&amp;/g, '&'), 'https://library.invalid' + page);
        if (u.origin === 'https://library.invalid' && /\.(?:m?js|css)$/.test(u.pathname)) assert.equal(u.searchParams.get('v'), actualBI.BID, page + ': ' + u.pathname);
      }
      documents++;
    }
  }
  walk(path.join(ROOT, 'public/games-lib'));
  check(documents > 0, 'all ' + documents + ' repository library HTML documents have versioned local code/styles');
  console.log('Library HTML documents checked:', documents);
  // Optional real-browser proof that import maps cover transitive and bare imports.
  if (process.env.CACHE_BROWSER === '1') {
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] } : {}) });
    try {
      const page = await browser.newPage({ extraHTTPHeaders: headers });
      const requests = [], errors = [];
      page.on('request', r => requests.push(new URL(r.url()))); page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + '/games-lib/probe/index.html');
      await page.waitForFunction(() => document.body.dataset.result === 'current-addon');
      check(errors.length === 0, 'browser has zero module errors');
      for (const p of ['probe/game.js', 'shared.js', 'vendor/three-addons/probe.js', 'kit.js', 'lib.css']) check(requests.some(u => u.pathname === '/games-lib/' + p && u.searchParams.get('v') === BI.BID), 'browser requests current version: ' + p);
    } finally { await browser.close(); }
  }
  console.log(`PASS: ${checks} library cache regression checks`);
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { if (server) await new Promise(r => server.close(r)); fs.rmSync(tmp, { recursive: true, force: true }); });
