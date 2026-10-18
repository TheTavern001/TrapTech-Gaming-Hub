'use strict';
// Build id + cache busting. Every deploy gets a BUILD_ID (env BUILD_ID, or a content hash of the files the browser loads).
// It is added as ?v=<id> to every JS/CSS reference in the served HTML, to every module import (via the import map), to the
// translation files (via <meta name="build-id">) and to the service worker registration, so a CDN that ignores
// Cache-Control (for example a fixed edge TTL) can never serve a stale file after a deploy: the URL itself changes.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const PUB = path.join(__dirname, '..', 'public');
const walk = (dir, ext, out = []) => {
  let es = []; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of es) { const f = path.join(dir, e.name); if (e.isDirectory()) walk(f, ext, out); else if (ext.test(e.name)) out.push(f); }
  return out;
};
const JS = walk(path.join(PUB, 'js'), /\.js$/).sort();
const hashFiles = () => {
  const h = crypto.createHash('sha1');
  for (const f of [...JS, ...walk(path.join(PUB, 'css'), /\.css$/).sort(), ...walk(path.join(PUB, 'i18n'), /\.json$/).sort(), path.join(PUB, 'index.html'), path.join(PUB, 'sw.js'), path.join(PUB, 'manifest.webmanifest')]) {
    try { h.update(path.relative(PUB, f)); h.update(fs.readFileSync(f)); } catch { /* optional file */ }
  }
  return h.digest('hex').slice(0, 12);
};
const BID = (/^[A-Za-z0-9._-]{4,40}$/.test(process.env.BUILD_ID || '') ? process.env.BUILD_ID : hashFiles());
const ver = (u) => u + (u.includes('?') ? '&' : '?') + 'v=' + BID;
const IMPORTMAP_JSON = JSON.stringify({ imports: Object.assign({ three: '/games-lib/vendor/three.module.min.js', 'three/addons/': '/games-lib/vendor/three-addons/' },
  Object.fromEntries(JS.map(f => { const u = '/js/' + path.relative(path.join(PUB, 'js'), f).split(path.sep).join('/'); return [u, ver(u)]; }))) });
const IMPORTMAP_HASH = `'sha256-${crypto.createHash('sha256').update(IMPORTMAP_JSON).digest('base64')}'`;
// rewrite the static index.html once; the caller caches the result. __COSV__ is replaced per request (cosmetics.css changes with the shop rotation).
function transformIndex(html) {
  return html
    .replace(/<script type="importmap">[\s\S]*?<\/script>/, () => `<script type="importmap">${IMPORTMAP_JSON}</script>`)
    .replace(/(<script[^>]*\ssrc=")(\/js\/[^"?]+)"/g, (m, a, u) => `${a}${ver(u)}"`)
    .replace(/(<link[^>]*\shref=")(\/(?:css\/[^"?]+\.css|manifest\.webmanifest))"/g, (m, a, u) => `${a}${ver(u)}"`)
    .replace('href="/cosmetics.css"', 'href="/cosmetics.css?v=__COSV__"')
    .replace('<head>', `<head>\n<meta name="build-id" content="${BID}">`);
}
// service worker: cache name and precache URLs carry the build id
const swSource = () => { try { return fs.readFileSync(path.join(PUB, 'sw.js'), 'utf8').replace(/__BUILD__/g, BID); } catch { return ''; } };
module.exports = { BID, IMPORTMAP_HASH, IMPORTMAP_JSON, transformIndex, swSource, ver };
