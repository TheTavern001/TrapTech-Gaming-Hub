'use strict';
// Render game HTML after the private-review gate, before either static server.
// Relative module imports are resolved by the shared, versioned import map.
// Do not retain one expanded HTML copy per game on the 128 MB host.
const fs = require('fs');
const path = require('path');
const BI = require('./build-id');
const ORIGIN = 'https://library.invalid';

function transform(html, page) {
  const localAsset = (raw) => {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(raw)) return raw;
    const u = new URL(raw.replace(/&amp;/g, '&'), ORIGIN + page);
    if (u.origin !== ORIGIN || !/\.(?:m?js|css)$/i.test(u.pathname)) return raw;
    return BI.ver(u.pathname + u.search + u.hash).replace(/&/g, '&amp;');
  };
  const map = `<script type="importmap">${BI.IMPORTMAP_JSON}</script>`;
  // The six existing maps only alias Three.js and addons; the shared map also
  // versions every exact module URL, including relative/transitive imports.
  return html
    .replace(/<script\b[^>]*type=["']importmap["'][^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/(<(?:script|link)\b[^>]*\b(?:src|href)=)(["'])([^"']+)\2/gi,
      (m, prefix, quote, url) => prefix + quote + localAsset(url) + quote)
    .replace(/<head\b[^>]*>/i, m => `${m}\n<meta name="build-id" content="${BI.BID}">${map}`);
}

module.exports = function libraryPages(pubDir) {
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    let page;
    try { page = decodeURIComponent(req.path); } catch { return next(); }
    // Strict segments prevent decoded traversal and access outside games-lib.
    if (!/^\/games-lib\/(?:[a-z0-9_-]+\/)*(?:[a-z0-9_-]+(?:\.html)?)?$/i.test(page)) return next();
    if (page.endsWith('/')) page += 'index.html';
    else if (!page.endsWith('.html')) page += '.html';
    fs.readFile(path.join(pubDir, page.slice(1)), 'utf8', (err, html) => {
      if (err) return err.code === 'ENOENT' || err.code === 'ENOTDIR' ? next() : next(err);
      try {
        res.set('Cache-Control', 'no-store');
        res.type('html').send(transform(html, page));
      } catch (error) { next(error); }
    });
  };
};
module.exports.transform = transform;
