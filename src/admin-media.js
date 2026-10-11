'use strict';
// v7 item 22: admin image uploads (giveaway art, banners, prize images, badge art).
// The browser crops and downsizes the picture (max 2400 px, JPEG/PNG) and sends the bytes + crop boxes; the SERVER
// does the final crop + resize to exact card sizes with what is already installed (@resvg/resvg-js, lazy loaded, used for
// OG images too) and stores PNGs on the data disk ($DATA_DIR/media, i.e. /data on Deplexo). One render at a time,
// renderAsync off the main thread, input capped at 4 MB / 4096 px, so memory stays well inside the 128 MB plan.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cfg = require('./config');
const R2 = require('./r2');
const DIR = path.join(path.dirname(cfg.DB_PATH), 'media');
try { fs.mkdirSync(DIR, { recursive: true }); } catch {}
const SIZES = { card: [800, 450], thumb: [400, 225], tall: [600, 620], square: [512, 512], banner: [1200, 300], badge: [256, 256], og: [1200, 630] };
const MAX_BYTES = 4 * 1048576, MAX_DIM = 4096;

function sniff(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { type: 'image/png', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1]; const len = buf.readUInt16BE(i + 2);
      if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) return { type: 'image/jpeg', h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      i += 2 + len;
    }
  }
  return null;
}
let queue = Promise.resolve();
const serial = (fn) => { const p = queue.then(fn, fn); queue = p.catch(() => {}); return p; };
async function renderCrop(buf, info, crop, [W, H]) {
  const { Resvg, renderAsync } = require('@resvg/resvg-js');
  const c = { x: Math.max(0, +crop.x || 0), y: Math.max(0, +crop.y || 0), w: Math.max(1, +crop.w || info.w), h: Math.max(1, +crop.h || info.h) };
  // crop values may be normalised (0..1) or pixels
  if (c.w <= 1 && c.h <= 1) { c.x *= info.w; c.y *= info.h; c.w *= info.w; c.h *= info.h; }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="${c.x} ${c.y} ${c.w} ${c.h}" preserveAspectRatio="xMidYMid slice"><image width="${info.w}" height="${info.h}" xlink:href="data:${info.type};base64,${buf.toString('base64')}"/></svg>`;
  const opts = { fitTo: { mode: 'width', value: W }, font: { loadSystemFonts: false } };
  const img = typeof renderAsync === 'function' ? await renderAsync(svg, opts) : new Resvg(svg, opts).render();
  return img.asPng();
}
// crops: { card: {x,y,w,h}, tall: {...}, ... } (normalised or px). Returns { urls: { card: '/media/...png', ... }, w, h }
async function save(buf, crops, kind = 'giveaway') {
  if (!Buffer.isBuffer(buf) || !buf.length) return { ok: false, error: 'No image received.' };
  if (buf.length > MAX_BYTES) return { ok: false, error: 'Image is too large (max 4 MB after the in-browser resize).' };
  const info = sniff(buf); if (!info) return { ok: false, error: 'Use a JPEG or PNG image.' };
  if (!info.w || !info.h || info.w > MAX_DIM || info.h > MAX_DIM) return { ok: false, error: `Image must be at most ${MAX_DIM} px on each side.` };
  const want = Object.entries(crops || {}).filter(([k]) => SIZES[k]);
  if (!want.length) want.push(['card', { x: 0, y: 0, w: 1, h: 1 }]);
  if (want.some(([k]) => k === 'card') && !want.some(([k]) => k === 'thumb')) want.push(['thumb', want.find(([k]) => k === 'card')[1]]);
  const hash = crypto.createHash('sha256').update(buf).update(JSON.stringify(crops || {})).digest('hex').slice(0, 16);
  const safeKind = String(kind).replace(/[^a-z0-9-]/gi, '').slice(0, 16) || 'img';
  const urls = {};
  try {
    await serial(async () => {
      for (const [k, crop] of want) {
        const name = `${safeKind}-${hash}-${k}.png`; const f = path.join(DIR, name);
        const png = await renderCrop(buf, info, crop, SIZES[k]);
        if (R2.configured()) { await R2.put('media/' + name, png, 'image/png'); urls[k] = R2.publicUrl('media/' + name) || '/media/' + name; }
        else { if (!fs.existsSync(f)) fs.writeFileSync(f, png); urls[k] = '/media/' + name; }
      }
    });
  } catch (e) { console.error('[media] render failed', e.message); return { ok: false, error: 'Could not read that image. Try a different JPEG or PNG.' }; }
  return { ok: true, urls, w: info.w, h: info.h, type: info.type };
}
function serve(app) {
  app.get('/media/:name', async (req, res) => {
    const n = String(req.params.name); if (!/^[a-z0-9-]{1,40}-[a-f0-9]{16}-[a-z]+\.png$/.test(n)) return res.status(404).end();
    const f = path.join(DIR, n);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); res.setHeader('X-Content-Type-Options', 'nosniff');
    if (fs.existsSync(f)) { res.type('png'); return fs.createReadStream(f).pipe(res); }
    if (!R2.configured()) return res.status(404).end();
    try { const object = await R2.get('media/' + n); if (!object) return res.status(404).end(); res.type(object.contentType); return res.end(object.body); }
    catch { return res.status(502).end(); }
  });
}
const exists = (url) => { const m = /^\/media\/([a-z0-9-]+\.png)$/.exec(String(url || '')); return !!m && fs.existsSync(path.join(DIR, m[1])); };
const fileOf = (url) => { const m = /^\/media\/([a-z0-9-]+\.png)$/.exec(String(url || '')); return m ? path.join(DIR, m[1]) : null; };
module.exports = { SIZES, save, serve, exists, fileOf, sniff, DIR };
