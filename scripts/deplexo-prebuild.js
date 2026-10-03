#!/usr/bin/env node
'use strict';
// Build-time asset prep for low-memory hosting (run in the Dockerfile; safe to run locally).
// Writes ONLY to $BUILD_DIR (default ./build), never into public/:
//   build/gz/...           gzip -9 copies of static text assets + manifest.json (served by src/static-gz.js)
//   build/og-art/...       art/logos pre-scaled to the exact boxes used by the OG card templates (src/og.js)
//   build/og/default.png   the static default share card, pre-rendered
// Usage: BUILD_DIR=/app/build node scripts/deplexo-prebuild.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const BUILD = process.env.BUILD_DIR = path.resolve(process.env.BUILD_DIR || path.join(ROOT, 'build'));
const t0 = Date.now();
fs.rmSync(BUILD, { recursive: true, force: true });

// ---------- 1) precompressed static assets ----------
const GZ_EXT = new Set(['.js', '.mjs', '.css', '.svg', '.json', '.webmanifest', '.txt', '.xml', '.ttf', '.otf', '.ico', '.map', '.html']);
const files = {}; let raw = 0, packed = 0;
(function walk(dir) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, d.name);
    if (d.isDirectory()) { walk(f); continue; }
    if (!GZ_EXT.has(path.extname(d.name).toLowerCase())) continue;
    const st = fs.statSync(f); if (st.size < 1024) continue;
    const gz = zlib.gzipSync(fs.readFileSync(f), { level: 9 });
    if (gz.length > st.size * 0.9) continue;
    const url = '/' + path.relative(PUB, f).split(path.sep).join('/');
    const out = path.join(BUILD, 'gz', url.slice(1) + '.gz'); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, gz);
    files[url] = { gz: url.slice(1) + '.gz', size: st.size, mtime: Math.round(st.mtimeMs) }; raw += st.size; packed += gz.length;
  }
})(PUB);
fs.writeFileSync(path.join(BUILD, 'gz', 'manifest.json'), JSON.stringify({ built_at: new Date().toISOString(), files }));
console.log(`gz: ${Object.keys(files).length} files, ${(raw / 1048576).toFixed(2)} MB -> ${(packed / 1048576).toFixed(2)} MB`);

// ---------- 2) OG art pre-scaled to the template boxes ----------
const og = require('../src/og');
const { Resvg } = require('@resvg/resvg-js');
function scale(rel, box) {
  const src = path.join(PUB, rel); if (!fs.existsSync(src)) return;
  const [w, h, par] = box;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><image x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="${par}" xlink:href="data:image/png;base64,${fs.readFileSync(src).toString('base64')}"/></svg>`;
  const png = new Resvg(svg, { fitTo: { mode: 'original' } }).render().asPng();
  const out = path.join(BUILD, 'og-art', og.scaledName('/' + rel, box)); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, png);
  return png.length;
}
let n = 0, bytes = 0;
const art = [];
for (const dir of ['assets/cards/v5', 'assets/giveaways']) { try { for (const f of fs.readdirSync(path.join(PUB, dir))) if (f.endsWith('.png') && !f.includes('-tall')) art.push(`${dir}/${f}`); } catch {} }
art.push('assets/brand/hub-mark.png');
for (const rel of art) { const b = scale(rel, og.BOX.art); if (b) { n++; bytes += b; } }
for (const [rel, box] of [['assets/brand/hub-logo.png', og.BOX.logo], ['assets/brand/traptech-wordmark.png', og.BOX.tt]]) { const b = scale(rel, box); if (b) { n++; bytes += b; } }
console.log(`og-art: ${n} images, ${(bytes / 1048576).toFixed(2)} MB`);

// ---------- 3) static default share card ----------
fs.mkdirSync(path.join(BUILD, 'og'), { recursive: true });
const def = og.render('default', {});
fs.writeFileSync(path.join(BUILD, 'og', 'default.png'), def);
console.log(`og/default.png: ${Math.round(def.length / 1024)} KB`);
console.log(`deplexo-prebuild done in ${Date.now() - t0} ms -> ${BUILD}`);
