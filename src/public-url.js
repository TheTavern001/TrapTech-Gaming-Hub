'use strict';
// PUBLIC_URL: the site's public address, e.g. https://traptechgaminghub.com (see FINALIZE.md and DEPLOY-DEPLEXO.md).
// When set it is used for every absolute link the server writes (Open Graph / Twitter cards, og:url, canonical) and is
// handed to the browser (<meta name="public-url">) for share, referral and copy-link buttons, so links point at the real
// domain even when the request came in on the host's own subdomain or through a proxy. Unset = the request's own origin.
// CANONICAL_REDIRECT=1 additionally 301-redirects page loads on any other hostname to PUBLIC_URL (API calls, /healthz
// and non-GET requests are never redirected). The service worker and manifest use relative paths (scope "/"), so they
// work on any origin; note a browser treats each origin as a separate install.
function parse(v) {
  if (!v) return '';
  try { const u = new URL(String(v).trim()); if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('scheme'); return u.origin; }
  catch { console.warn(`[config] PUBLIC_URL "${v}" is not a valid http(s) URL, ignoring it`); return ''; }
}
const PUBLIC_URL = parse(process.env.PUBLIC_URL);
const HOST = PUBLIC_URL ? new URL(PUBLIC_URL).hostname : '';
const isHttps = (req) => req.secure || req.headers['x-forwarded-proto'] === 'https';
const originOf = (req) => PUBLIC_URL || `${isHttps(req) ? 'https' : 'http'}://${req.get('host')}`;
function redirect() {
  const on = !!PUBLIC_URL && process.env.CANONICAL_REDIRECT === '1';
  return (req, res, next) => {
    if (!on || (req.method !== 'GET' && req.method !== 'HEAD') || req.path === '/healthz' || req.path.startsWith('/api/')) return next();
    // req.hostname honours X-Forwarded-Host (trust proxy), so a proxy in front (e.g. a Cloudflare Worker) does not loop
    if (String(req.hostname || '').toLowerCase() === HOST) return next();
    res.redirect(301, PUBLIC_URL + req.originalUrl);
  };
}
module.exports = { PUBLIC_URL, originOf, redirect, parse };
