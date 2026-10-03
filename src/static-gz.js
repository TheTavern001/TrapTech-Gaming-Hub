'use strict';
// Serves build-time gzipped copies of static text assets ($BUILD_DIR/gz, made by scripts/deplexo-prebuild.js) to clients that
// accept gzip, with the same Content-Type / Cache-Control as express.static. No per-request compression work or zlib
// buffers. Entries whose source file changed after the build (size/mtime differ) are ignored, so a stale .gz is never served.
const fs = require('fs');
const path = require('path');
const send = require('send');

module.exports = function staticGz(pubDir) {
  const BUILD = process.env.BUILD_DIR || path.join(__dirname, '..', 'build');
  const manifestFile = path.join(BUILD, 'gz', 'manifest.json');
  const map = new Map();
  try {
    const m = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    for (const [url, e] of Object.entries(m.files || {})) {
      try { const st = fs.statSync(path.join(pubDir, url)); if (st.size === e.size && Math.round(st.mtimeMs) === e.mtime) map.set(url, path.join(BUILD, 'gz', e.gz)); } catch {}
    }
    console.log(`[static-gz] ${map.size} precompressed assets`);
  } catch { return (req, res, next) => next(); }
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    let p; try { p = decodeURIComponent(req.path); } catch { return next(); }
    const gz = map.get(p); if (!gz) return next();
    res.setHeader('Vary', 'Accept-Encoding');
    if (!/\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) return next();
    const type = send.mime.lookup(p); const cs = send.mime.charsets.lookup(type);
    res.setHeader('Content-Type', type + (cs ? '; charset=' + cs : ''));
    res.setHeader('Content-Encoding', 'gzip');
    res.sendFile(gz, { maxAge: '1h', acceptRanges: false, dotfiles: 'allow' }, (err) => { if (err && !res.headersSent) { res.removeHeader('Content-Encoding'); next(); } });
  };
};
