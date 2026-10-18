'use strict';
// v8 security + privacy layer (Reese's release): public-page CSP, cross-site request (CSRF) guard for cookie sessions,
// self-service account data export and deletion. Admin pages keep their own stricter CSP (admin-sec.js).
const crypto = require('crypto'), fs = require('fs'), path = require('path');
const bcrypt = require('bcryptjs');

// ---- CSP for the public SPA ----
const IMPORTMAP_HASH = require('./build-id').IMPORTMAP_HASH; // the import map is generated with the build id, so its hash is computed from the generated text
const COMMON = ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "img-src 'self' data: blob: https:", "font-src 'self' data:",
  "media-src 'self' data: blob:", "worker-src 'self' blob:", "manifest-src 'self'", "connect-src 'self' https://cloudflareinsights.com", "style-src 'self' 'unsafe-inline'"];
// the hub shell: no inline scripts (importmap is pinned by hash)
const HUB = [...COMMON, `script-src 'self' 'wasm-unsafe-eval' https://static.cloudflareinsights.com ${IMPORTMAP_HASH}`.trim(), "frame-src 'self'", "frame-ancestors 'none'"].join('; ');
// game bundles (third-party engines are loaded from our own origin) may need eval / inline bootstraps; still same-origin only
const GAME = [...COMMON, "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:", "frame-src 'self'", "frame-ancestors 'self'"].join('; ');
const cspFor = (p) => (/^\/(games-lib|games)\//.test(p) ? GAME : HUB);

function install(app, H) {
  const reportOnly = process.env.CSP_MODE === 'report-only', off = process.env.CSP_MODE === 'off';
  app.use((req, res, next) => {
    if (!off && !req.path.startsWith('/api/') && !req.path.startsWith('/admin')) res.setHeader(reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy', cspFor(req.path));
    next();
  });
  // ---- CSRF: browsers announce cross-site requests; refuse state changes that come from another site ----
  const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
  const hostOf = (v) => { try { return new URL(v).host; } catch { return ''; } };
  app.use('/api', (req, res, next) => {
    if (SAFE.has(req.method)) return next();
    const site = String(req.headers['sec-fetch-site'] || '').toLowerCase();
    if (site === 'cross-site' || site === 'same-site') {
      // same-site (a sibling subdomain) is still not our page; webhooks are server-to-server and never carry Sec-Fetch headers
      return res.status(403).json({ ok: false, error: 'Cross-site request blocked.' });
    }
    const origin = req.headers.origin;
    if (origin && origin !== 'null') {
      const allowed = new Set([String(req.headers.host || '').toLowerCase()]);
      for (const k of ['PUBLIC_URL', 'CANONICAL_URL']) if (process.env[k]) allowed.add(hostOf(process.env[k]).toLowerCase());
      if (!allowed.has(hostOf(origin).toLowerCase())) return res.status(403).json({ ok: false, error: 'Cross-site request blocked.' });
    } else if (origin === 'null' && req.headers.cookie) {
      return res.status(403).json({ ok: false, error: 'Cross-site request blocked.' });
    }
    next();
  });
}

// ---- account export / deletion (self-service; the admin tool uses the same data shape) ----
function routes(app, A, H) {
  const { requireUser, bad, limiter, db: _db } = H;
  const db = require('./db'); const AU = require('./admin-users');
  const exportFor = (id) => {
    const base = AU.exportData(id); const q = (sql, ...a) => { try { return db.prepare(sql).all(id, ...a); } catch { return []; } };
    return { ...base, skill_achievements: q('SELECT ach_id, unlocked_at FROM ach2_unlocks WHERE user_id=?'), skill_quest_claims: q('SELECT * FROM quest2_claims WHERE user_id=?'),
      avatar_parts: q('SELECT part, created_at FROM avatar_parts_owned WHERE user_id=?'), store_orders: q('SELECT ref, product_id, usd_cents, provider, status, created_at FROM store_orders WHERE user_id=? ORDER BY id'),
      note: 'This file contains the data we hold about your account. Your password is stored only as a salted hash and is not included.' };
  };
  app.get('/api/me/export', requireUser, limiter('acct-export', 5, 3600e3), (req, res) => {
    const data = exportFor(req.user.id);
    res.setHeader('Content-Disposition', `attachment; filename="gaming-hub-data-${String(req.user.username).replace(/[^\w-]/g, '_')}.json"`);
    res.setHeader('Cache-Control', 'no-store'); res.json(data);
  });
  app.post('/api/me/delete', requireUser, limiter('acct-delete', 5, 3600e3), (req, res, next) => { (async () => {
    const b = req.body || {}; const u = db.prepare('SELECT id, username, pass_hash FROM users WHERE id=?').get(req.user.id);
    if (!u) return bad(res, 404, 'Account not found.');
    if (String(b.confirm || '') !== u.username) return bad(res, 400, `Type your username (${u.username}) to confirm.`);
    if (!(await require('./pwhash').verify(String(b.password || ''), u.pass_hash))) return bad(res, 401, 'Password is wrong.');
    const r = db.transaction(() => {
      for (const t of ['activity', 'notifications', 'user_ip_log', 'points_ledger', 'user_items', 'avatar_parts_owned', 'ach2_unlocks', 'quest2_assign', 'quest2_claims', 'checkins', 'follows']) {
        try { const col = t === 'follows' ? null : 'user_id'; if (col) db.prepare(`DELETE FROM ${t} WHERE user_id=?`).run(u.id); else db.prepare('DELETE FROM follows WHERE follower_id=? OR followee_id=?').run(u.id, u.id); } catch { /* table may not exist on older DBs */ }
      }
      return db.prepare('DELETE FROM users WHERE id=?').run(u.id);
    })();
    try { require('./results').clearCache(); } catch {}
    res.append('Set-Cookie', 'gh_sess=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    res.json({ ok: !!r.changes, deleted: true, note: 'Your profile, runs and related data were removed. Locked giveaway results keep only the username as an immutable record.' });
  })().catch(next); });
}
module.exports = { install, routes, cspFor, HUB, GAME };
