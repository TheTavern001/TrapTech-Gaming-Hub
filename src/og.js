'use strict';
// Server-rendered share images (Open Graph / social cards), 1200x630 PNG. SVG templates rendered with resvg.
// Fonts: Orbitron + Exo 2 (SIL OFL), converted to TTF in src/og-fonts. Logos: The Gaming Hub + Trap Tech Solutions (v7: Reese's real TT monogram + chrome lockup, tools/build-brand-v7.py).
//
// Low-memory design (Deplexo free plan = 128 MB RAM):
//  - @resvg/resvg-js is only loaded the first time an image has to be rendered (most requests never need it).
//  - Rendered PNGs (~0.4-0.5 MB each) are cached on DISK in $DATA_DIR/og-cache (LRU by mtime, size cap OG_CACHE_MAX_MB),
//    never in RAM, and streamed to the client. Identical in-flight requests share one render.
//  - Renders run one at a time (1-slot queue) followed by a GC so resvg's native memory is released immediately
//    (see renderQueued). A render takes ~60 ms of CPU; results are cached so each card is normally rendered once.
//  - Art is embedded from pre-scaled copies made at build time (scripts/deplexo-prebuild.js -> $BUILD_DIR/og-art) when present,
//    so a 1 MB source PNG is not base64'd + decoded for a 380x380 slot. Falls back to the original file.
//  - The static default card is pre-rendered at build time ($BUILD_DIR/og/default.png).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const BUILD_DIR = process.env.BUILD_DIR || path.join(ROOT, 'build');
const FONTS = fs.readdirSync(path.join(__dirname, 'og-fonts')).map(f => path.join(__dirname, 'og-fonts', f));
const CACHE_DIR = process.env.OG_CACHE_DIR || path.join(process.env.DATA_DIR || path.join(ROOT, 'data'), 'og-cache');
const CACHE_MAX = Math.max(1, Number(process.env.OG_CACHE_MAX_MB || 30)) * 1048576;
let Resvg = null; // lazy
const resvg = () => Resvg || (Resvg = require('@resvg/resvg-js'));

// Image slots used by the templates: [width, height, preserveAspectRatio]. Pre-scaled art is generated for these boxes.
const BOX = { logo: [300, 76, 'xMidYMid meet'], tt: [260, 70, 'xMidYMid meet'], art: [380, 380, 'xMidYMid slice'] };
const scaledName = (rel, [w, h]) => rel.replace(/^\/+/, '').replace(/\.(webp|png)$/, '') + `@${w}x${h}.png`;
const brandCache = new Map(); // only the 2 fixed brand images (a few KB each after scaling)
function dataUri(rel, box = BOX.art) {
  if (!rel || !/^\/assets\/[\w\/.-]+$/.test(rel)) return null;
  const png = rel.replace(/\.webp$/, '.png');
  const scaled = path.join(BUILD_DIR, 'og-art', scaledName(png, box));
  let f = fs.existsSync(scaled) ? scaled : path.join(PUB, png);
  if (f !== scaled && (!f.startsWith(PUB) || !fs.existsSync(f))) return null;
  const brand = box !== BOX.art;
  if (brand && brandCache.has(f)) return brandCache.get(f);
  const uri = 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  if (brand) brandCache.set(f, uri);
  return uri;
}
const x = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const clip = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

function frame(inner, { art = null, accent = '#a855f7' } = {}) {
  const logo = dataUri('/assets/brand/hub-logo.png', BOX.logo); const tt = dataUri('/assets/brand/traptech-wordmark.png', BOX.tt); const a = dataUri(art, BOX.art);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#140a3c"/><stop offset=".55" stop-color="#0a0f2e"/><stop offset="1" stop-color="#06203f"/></linearGradient>
    <linearGradient id="nv" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a855f7"/><stop offset="1" stop-color="#22d3ee"/></linearGradient>
    <radialGradient id="glow" cx=".85" cy=".2" r=".7"><stop offset="0" stop-color="${accent}" stop-opacity=".45"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#6d5bd0" stroke-opacity=".16" stroke-width="1"/></pattern>
    <clipPath id="artc"><rect x="760" y="120" width="380" height="380" rx="28"/></clipPath>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/><rect width="1200" height="630" fill="url(#grid)"/><rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="14" y="14" width="1172" height="602" rx="30" fill="none" stroke="url(#nv)" stroke-width="3" stroke-opacity=".8"/>
  ${logo ? `<image x="60" y="44" width="300" height="76" xlink:href="${logo}"/>` : ''}
  ${a ? `<rect x="752" y="112" width="396" height="396" rx="34" fill="url(#nv)" opacity=".75"/><image x="760" y="120" width="380" height="380" preserveAspectRatio="xMidYMid slice" clip-path="url(#artc)" xlink:href="${a}"/>` : ''}
  ${inner}
  <text x="60" y="580" font-family="Exo 2" font-weight="600" font-size="22" fill="#9aa3d0">Free to play • Points &amp; cosmetics only • 21+</text>
  ${tt ? `<text x="1140" y="532" text-anchor="end" font-family="Orbitron" font-weight="700" font-size="14" fill="#9aa3d0" letter-spacing="3">BUILT BY</text><image x="880" y="540" width="260" height="70" xlink:href="${tt}"/>` : ''}
</svg>`;
}
const T = (x0, y, size, fill, text, { font = 'Orbitron', weight = 900, anchor = 'start', ls = 0 } = {}) =>
  `<text x="${x0}" y="${y}" font-family="${font}" font-weight="${weight}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}">${x(text)}</text>`;

const templates = {
  default: () => frame(`${T(60, 240, 64, '#fff', 'PLAY • COMPETE')}${T(60, 320, 64, 'url(#nv)', 'WIN • CONNECT')}
    ${T(60, 390, 28, '#c7cdf5', 'Free arcade games, leaderboards, tournaments and', { font: 'Exo 2', weight: 600 })}${T(60, 430, 28, '#c7cdf5', 'brand giveaways. No purchase necessary.', { font: 'Exo 2', weight: 600 })}`, { art: '/assets/cards/v5/jetpack-dash.png' }),
  run: (d) => frame(`${T(60, 190, 26, '#22d3ee', clip(d.game, 28).toUpperCase(), { weight: 700, ls: 3 })}
    ${T(60, 320, d.scoreText.length > 9 ? 92 : 120, '#fff', d.scoreText)}
    ${T(60, 380, 34, '#e9e6ff', `${clip(d.username, 20)}${d.title ? ' • ' + clip(d.title, 22) : ''}`, { font: 'Exo 2', weight: 800 })}
    ${T(60, 430, 28, '#fde047', d.rank ? `#${d.rank} of ${d.players} players${d.best ? ' • personal best' : ''}` : 'New run', { font: 'Exo 2', weight: 800 })}
    <rect x="60" y="460" width="330" height="62" rx="31" fill="url(#nv)"/>${T(225, 501, 24, '#fff', 'CAN YOU BEAT IT?', { anchor: 'middle', weight: 800 })}`, { art: d.art }),
  giveaway: (d) => frame(`${T(60, 180, 24, '#fde047', 'FREE GIVEAWAY', { weight: 700, ls: 3 })}
    ${T(60, 260, d.title.length > 18 ? 52 : 66, '#fff', clip(d.title, 26))}
    ${T(60, 320, 32, '#c7cdf5', `Hosted by ${clip(d.host, 28)}`, { font: 'Exo 2', weight: 800 })}
    ${T(60, 370, 28, '#22d3ee', d.when, { font: 'Exo 2', weight: 800 })}
    ${T(60, 420, 26, '#e9e6ff', 'Play free to enter. No purchase necessary.', { font: 'Exo 2', weight: 600 })}
    <rect x="60" y="455" width="300" height="62" rx="31" fill="url(#nv)"/>${T(210, 496, 24, '#fff', 'PLAY TO ENTER', { anchor: 'middle', weight: 800 })}`, { art: d.art, accent: d.color || '#a855f7' }),
  profile: (d) => frame(`${T(60, 190, 24, '#22d3ee', 'PLAYER PROFILE', { weight: 700, ls: 3 })}
    ${T(60, 280, 72, '#fff', clip(d.username, 16))}
    ${T(60, 335, 32, '#fde047', clip(d.title, 30), { font: 'Exo 2', weight: 800 })}
    ${T(60, 400, 30, '#e9e6ff', `Level ${d.level} • ${d.ach} achievements • ${d.games} games`, { font: 'Exo 2', weight: 700 })}
    ${T(60, 445, 30, '#c7cdf5', `${d.points} total points`, { font: 'Exo 2', weight: 700 })}`, { art: '/assets/brand/hub-mark.png' }),
  tournament: (d) => frame(`${T(60, 180, 24, '#fde047', d.format === 'bracket' ? 'BRACKET TOURNAMENT' : 'TIMED TOURNAMENT', { weight: 700, ls: 3 })}
    ${T(60, 260, d.title.length > 18 ? 52 : 64, '#fff', clip(d.title, 26))}
    ${T(60, 320, 32, '#22d3ee', d.game, { font: 'Exo 2', weight: 800 })}
    ${T(60, 370, 28, '#c7cdf5', d.when, { font: 'Exo 2', weight: 700 })}
    ${T(60, 420, 26, '#e9e6ff', d.prize ? clip('Prize: ' + d.prize, 44) : 'Free entry - play to compete', { font: 'Exo 2', weight: 600 })}`, { art: d.art }),
};
const svgFor = (kind, data) => (templates[kind] || templates.default)(data || {});
const OPTS = () => ({ fitTo: { mode: 'width', value: 1200 }, font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'Exo 2' } });
// Synchronous render (used by the build script; also kept as the public API for compatibility).
function render(kind, data) { return new (resvg().Resvg)(svgFor(kind, data), OPTS()).render().asPng(); }

// ---------- 1-slot render queue ----------
// resvg frees its native buffers (decoded images, the 1200x630 canvas, its font db) only when V8 finalizes the JS
// wrapper objects, and V8 does not know about that native memory, so with a small JS heap it can pile up to hundreds
// of MB. So: one render at a time, then a full GC (cheap: the heap is small) so the native memory is released right away.
// Measured (120 renders): no GC ~98-536 MB RSS, renderAsync ~90-110 MB, sync + GC ~77 MB (node + resvg alone: 51 MB).
const gc = global.gc || (() => { try { require('v8').setFlagsFromString('--expose-gc'); return require('vm').runInNewContext('gc'); } catch { return null; } })();
const tick = () => new Promise(r => setImmediate(r));
let chain = Promise.resolve();
function renderQueued(kind, data) {
  const job = chain.then(async () => {
    await tick();
    let png = render(kind, data);
    await tick(); // let N-API finalizers run, then collect
    if (gc) gc();
    return png;
  });
  chain = job.catch(() => {});
  return job;
}

// ---------- disk LRU cache ----------
let cacheOk = null; const entries = new Map(); let total = 0; // name -> { size, at }
function initCache() {
  if (cacheOk !== null) return cacheOk;
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true }); fs.accessSync(CACHE_DIR, fs.constants.W_OK);
    for (const f of fs.readdirSync(CACHE_DIR)) {
      const p = path.join(CACHE_DIR, f);
      if (!f.endsWith('.png')) { try { fs.unlinkSync(p); } catch {} continue; } // stale temp files
      const st = fs.statSync(p); entries.set(f, { size: st.size, at: st.mtimeMs }); total += st.size;
    }
    cacheOk = true; prune();
  } catch (e) { console.error(`[og] disk cache disabled (${CACHE_DIR}): ${e.code || e.message}`); cacheOk = false; }
  return cacheOk;
}
function prune() {
  if (total <= CACHE_MAX) return;
  const list = [...entries].sort((a, b) => a[1].at - b[1].at);
  for (const [name, e] of list) { if (total <= CACHE_MAX * 0.9) break; try { fs.unlinkSync(path.join(CACHE_DIR, name)); } catch {} entries.delete(name); total -= e.size; }
}
const inflight = new Map();
// Resolves to { file } (a PNG on disk) or { buf } (when no cache is possible).
async function get(kind, data, key) {
  if (kind === 'default' || !templates[kind]) { const pre = path.join(BUILD_DIR, 'og', 'default.png'); if (fs.existsSync(pre)) return { file: pre }; kind = 'default'; key = 'default'; }
  if (!key || !initCache()) return { buf: await renderQueued(kind, data) };
  const name = crypto.createHash('sha1').update(`${kind}:${key}`).digest('hex') + '.png';
  const file = path.join(CACHE_DIR, name);
  const hit = entries.get(name);
  if (hit && fs.existsSync(file)) { hit.at = Date.now(); fs.utimes(file, new Date(), new Date(), () => {}); return { file }; }
  if (inflight.has(name)) return inflight.get(name);
  const p = (async () => {
    const buf = await renderQueued(kind, data);
    try {
      const tmp = file + '.' + process.pid + '.tmp';
      await fs.promises.writeFile(tmp, buf); await fs.promises.rename(tmp, file);
      if (entries.has(name)) total -= entries.get(name).size;
      entries.set(name, { size: buf.length, at: Date.now() }); total += buf.length; prune();
      return { file };
    } catch (e) { console.error('[og] cache write failed', e.code || e.message); return { buf }; }
  })();
  inflight.set(name, p); p.finally(() => inflight.delete(name)).catch(() => {});
  return p;
}
// Express helper: send the card for (kind, data, key) with the same headers as before.
async function send(res, kind, data, key) {
  try {
    const r = await get(kind, data, key);
    res.setHeader('Content-Type', 'image/png'); res.setHeader('Cache-Control', 'public, max-age=600');
    if (r.buf) return res.end(r.buf);
    const st = await fs.promises.stat(r.file); res.setHeader('Content-Length', st.size);
    fs.createReadStream(r.file).on('error', () => res.destroy()).pipe(res);
  } catch (e) { console.error('[og] render failed', e); if (!res.headersSent) res.status(500).json({ ok: false, error: 'Server error' }); }
}
const stats = () => ({ dir: CACHE_DIR, enabled: cacheOk, files: entries.size, bytes: total, max_bytes: CACHE_MAX, resvg_loaded: !!Resvg });
module.exports = { render, get, send, stats, svgFor, BOX, scaledName, templates };
