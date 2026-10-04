'use strict';
// v7 item 23: player management backend (search / filter / sort, full profile, every moderation action),
// sign-in IP + device history (partially masked, owner/admin only), one-time password reset links/codes (handed to the
// player on Potato - there is no email), notes, player reports, data export.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');
const cfg = require('./config');
const N = require('./notify');
const RO = require('./admin-roles');
const now = () => Date.now();
const D = 864e5;
const addCol = (t, c, def) => { if (!db.prepare(`PRAGMA table_info(${t})`).all().some(x => x.name === c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`); };
addCol('users', 'shadow_banned', 'INTEGER NOT NULL DEFAULT 0');
addCol('users', 'suspended_until', 'INTEGER');
addCol('users', 'ban_reason', "TEXT NOT NULL DEFAULT ''");
db.exec(`
CREATE TABLE IF NOT EXISTS user_ip_log (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, ip_hash TEXT NOT NULL, ip_masked TEXT NOT NULL, device TEXT NOT NULL,
  ua TEXT NOT NULL DEFAULT '', first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL, hits INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (user_id, ip_hash, device));
CREATE INDEX IF NOT EXISTS idx_ipl_hash ON user_ip_log(ip_hash);
CREATE TABLE IF NOT EXISTS user_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, author TEXT NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS pw_resets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE, code_hash TEXT NOT NULL,
  created_by TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER, tries INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL, kind TEXT NOT NULL, target_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  ref TEXT NOT NULL DEFAULT '', reason TEXT NOT NULL, details TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'open', created_at INTEGER NOT NULL, handled_by TEXT, handled_at INTEGER, resolution TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at);
`);
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const hm = (s) => crypto.createHmac('sha256', cfg.IP_SALT + ':ipl').update(String(s)).digest('hex').slice(0, 20);

// ---------- IP + device history (light: at most one write per player + network + device every 10 minutes) ----------
let TRUST_CF = process.env.TRUST_CF_IP === '1' || (process.env.NODE_ENV === 'production' && process.env.TRUST_CF_IP !== '0');
function clientIp(req) {
  const cf = String(req.headers['cf-connecting-ip'] || '').trim();
  if (TRUST_CF && /^[0-9a-fA-F:.]{3,45}$/.test(cf)) return cf;
  return String((req.socket && req.socket.remoteAddress) || req.ip || '').replace(/^::ffff:/, '');
}
const maskIp = (ip) => ip.includes('.') ? ip.split('.').slice(0, 3).join('.') + '.x' : ip.split(':').slice(0, 3).join(':') + ':x:x';
function device(ua) {
  ua = String(ua || ''); const os = /iPhone|iPad/.test(ua) ? (/iPad/.test(ua) ? 'iPad' : 'iPhone') : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Other';
  const br = /Potato/i.test(ua) ? 'Potato in-app' : /; wv\)/.test(ua) ? 'WebView' : /EdgA?\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : /HeadlessChrome/.test(ua) ? 'Headless' : 'Browser';
  return `${os} ${br}`;
}
const seen = new Map();
function uidFromReq(req) {
  const ck = String(req.headers.cookie || ''); const m = /(?:^|;\s*)gh_sess=([^;]+)/.exec(ck); let tok = m ? decodeURIComponent(m[1]) : String(req.headers['x-session'] || '');
  if (!tok || !tok.includes('.')) return null; const [p, s] = tok.split('.');
  const good = crypto.createHmac('sha256', cfg.SESSION_SECRET).update(p).digest('base64url');
  if (s.length !== good.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(good))) return null;
  try { const o = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')); return o && o.e > now() ? o.u : null; } catch { return null; }
}
const upIp = db.prepare(`INSERT INTO user_ip_log (user_id, ip_hash, ip_masked, device, ua, first_seen, last_seen, hits) VALUES (?,?,?,?,?,?,?,1)
  ON CONFLICT(user_id, ip_hash, device) DO UPDATE SET last_seen=excluded.last_seen, hits=hits+1, ua=excluded.ua`);
function track(req, res, next) {
  if (req.method === 'OPTIONS' || !req.path.startsWith('/api/')) return next();
  try {
    const uid = uidFromReq(req); if (!uid) return next();
    const ip = clientIp(req); const dev = device(req.headers['user-agent']); const k = `${uid}|${ip}|${dev}`; const t = now();
    if ((seen.get(k) || 0) > t - 10 * 60e3) return next();
    seen.delete(k); seen.set(k, t); if (seen.size > 4000) seen.delete(seen.keys().next().value);
    upIp.run(uid, hm(ip), maskIp(ip), dev, String(req.headers['user-agent'] || '').slice(0, 160), t, t);
  } catch (e) { /* never block a request on tracking */ }
  next();
}
// after a successful sign-in / sign-up the session cookie is new, so record that request too
function trackLogin(req, uid) { try { const ip = clientIp(req); const t = now(); upIp.run(uid, hm(ip), maskIp(ip), device(req.headers['user-agent']), String(req.headers['user-agent'] || '').slice(0, 160), t, t); } catch {} }

// ---------- list / profile ----------
const SORTS = { created: 'u.created_at', last_seen: 'COALESCE(u.last_seen,0)', runs: 'runs', best: 'best', wins: 'wins', points: 'points', username: 'u.username COLLATE NOCASE', flags: 'flags' };
function list(q = {}) {
  const where = []; const p = {};
  const s = String(q.q || '').trim().slice(0, 40); if (s) { where.push('(u.username LIKE @q OR u.potato LIKE @q OR u.ref_code = @qe)'); p.q = `%${s}%`; p.qe = s.toUpperCase(); }
  const f = String(q.filter || 'all'); const t = now();
  if (f === 'banned') where.push('u.banned=1 AND (u.suspended_until IS NULL OR u.suspended_until < @t)');
  if (f === 'suspended') where.push('u.suspended_until IS NOT NULL AND u.suspended_until >= @t');
  if (f === 'shadow') where.push('u.shadow_banned=1');
  if (f === 'flagged') where.push("EXISTS (SELECT 1 FROM run_flags rf WHERE rf.user_id=u.id AND rf.status='open')");
  if (f === 'demo') where.push('u.is_demo=1');
  if (f === 'real') where.push('u.is_demo=0');
  if (f === 'new7') where.push('u.created_at >= @t7');
  if (f === 'active7') where.push('u.last_seen >= @t7');
  if (f === 'winners') where.push('EXISTS (SELECT 1 FROM giveaway_confirm c WHERE c.user_id=u.id)');
  if (f === 'reported') where.push("EXISTS (SELECT 1 FROM reports r WHERE r.target_user_id=u.id AND r.status='open')");
  if (f === 'nopotato') where.push("u.potato=''");
  p.t = t; p.t7 = t - 7 * D;
  const sort = SORTS[q.sort] || SORTS.created; const dir = q.dir === 'asc' ? 'ASC' : 'DESC';
  const per = Math.max(10, Math.min(200, parseInt(q.per, 10) || 50)); const page = Math.max(1, parseInt(q.page, 10) || 1);
  const W = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) AS c FROM users u ${W}`).get(p).c;
  const rows = db.prepare(`SELECT u.id, u.username, u.created_at, u.last_seen, u.banned, u.is_demo, u.shadow_banned, u.suspended_until, u.potato,
      (SELECT COUNT(*) FROM runs r WHERE r.user_id=u.id) AS runs, (SELECT MAX(score) FROM runs r WHERE r.user_id=u.id) AS best,
      (SELECT COUNT(*) FROM giveaway_confirm w WHERE w.user_id=u.id) + (SELECT COUNT(*) FROM winners w2 WHERE w2.user_id=u.id AND NOT EXISTS (SELECT 1 FROM giveaway_confirm c2 WHERE c2.user_id=u.id AND c2.giveaway_id=w2.giveaway_id)) AS wins,
      (SELECT COALESCE(SUM(amount),0) FROM points_ledger pl WHERE pl.user_id=u.id) AS points,
      (SELECT COUNT(*) FROM run_flags rf WHERE rf.user_id=u.id AND rf.status='open') AS flags
    FROM users u ${W} ORDER BY ${sort} ${dir}, u.id DESC LIMIT ${per} OFFSET ${(page - 1) * per}`).all(p)
    .map(r => ({ ...r, status: statusOf(r, t) }));
  return { total, page, per, pages: Math.max(1, Math.ceil(total / per)), rows, counts: counts(t) };
}
function counts(t = now()) {
  const one = (sql, ...a) => db.prepare(sql).get(...a).c;
  return { all: one('SELECT COUNT(*) c FROM users'), banned: one('SELECT COUNT(*) c FROM users WHERE banned=1 AND (suspended_until IS NULL OR suspended_until < ?)', t), suspended: one('SELECT COUNT(*) c FROM users WHERE suspended_until >= ?', t),
    shadow: one('SELECT COUNT(*) c FROM users WHERE shadow_banned=1'), flagged: one("SELECT COUNT(DISTINCT user_id) c FROM run_flags WHERE status='open'"), new7: one('SELECT COUNT(*) c FROM users WHERE created_at >= ?', t - 7 * D),
    reported: one("SELECT COUNT(DISTINCT target_user_id) c FROM reports WHERE status='open'") };
}
const statusOf = (u, t = now()) => u.suspended_until && u.suspended_until >= t ? 'suspended' : u.banned ? 'banned' : u.shadow_banned ? 'shadow' : 'ok';
function profile(id, perms) {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(id); if (!u) return null;
  const t = now(); const SH = (() => { try { return require('./shop'); } catch { return null; } })();
  let balance = 0; try { balance = SH ? SH.sync(u.id) : 0; } catch {}
  const ach = require('./achievements');
  const bests = db.prepare('SELECT game_id, MAX(score) AS best, COUNT(*) AS runs, MAX(created_at) AS last_at FROM runs WHERE user_id=? GROUP BY game_id ORDER BY runs DESC').all(u.id)
    .map(b => ({ ...b, title: (cfg.gameInfo ? cfg.gameInfo(b.game_id) : cfg.GAME_MAP[b.game_id] || {})?.title || b.game_id }));
  const out = {
    account: { id: u.id, username: u.username, created_at: u.created_at, last_seen: u.last_seen, status: statusOf(u, t), banned: !!u.banned, ban_reason: u.ban_reason, suspended_until: u.suspended_until, shadow_banned: !!u.shadow_banned,
      is_demo: !!u.is_demo, ref_code: u.ref_code, referred_by: u.referred_by ? (db.prepare('SELECT username FROM users WHERE id=?').get(u.referred_by) || {}).username : null,
      level: (() => { try { return require('./progress').levelFor(require('./progress').xpFor(u.id)); } catch { return null; } })(),
      cos: { banner: u.eq_banner, frame: u.eq_frame, title: u.eq_title, badge: u.eq_badge, color: u.eq_color, effect: u.eq_effect } },
    stats: { runs: bests.reduce((s, b) => s + b.runs, 0), games: bests.length, achievements: db.prepare('SELECT COUNT(*) AS c FROM user_achievements WHERE user_id=?').get(u.id).c, points: balance,
      followers: db.prepare('SELECT COUNT(*) AS c FROM follows WHERE followee_id=?').get(u.id).c, following: db.prepare('SELECT COUNT(*) AS c FROM follows WHERE follower_id=?').get(u.id).c },
    bests, recent: db.prepare('SELECT id, game_id, score, duration_ms, created_at, held, verify, created_at - started_at AS elapsed_ms FROM runs WHERE user_id=? ORDER BY id DESC LIMIT 50').all(u.id),
    flags: db.prepare('SELECT run_id, game_id, score, reasons, severity, status, created_at, note FROM run_flags WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(u.id).map(f => ({ ...f, reasons: JSON.parse(f.reasons || '[]') })),
    ledger: db.prepare('SELECT amount, reason, ref, created_at FROM points_ledger WHERE user_id=? AND amount<>0 ORDER BY created_at DESC, id DESC LIMIT 100').all(u.id),
    inventory: db.prepare('SELECT item_id, price, acquired_at FROM user_items WHERE user_id=? ORDER BY acquired_at DESC').all(u.id).map(i => ({ ...i, name: (SH && SH.BY_ID[i.item_id] || {}).name || i.item_id, type: (SH && SH.BY_ID[i.item_id] || {}).type || '' })),
    badges: db.prepare('SELECT badge_id, granted_by, note, created_at FROM badge_grants WHERE user_id=? ORDER BY created_at DESC').all(u.id).map(b => ({ ...b, name: (ach.ADMIN_BY[b.badge_id] || {}).name || b.badge_id })),
    achievements: db.prepare('SELECT ach_id, unlocked_at FROM user_achievements WHERE user_id=? ORDER BY unlocked_at DESC LIMIT 30').all(u.id).map(a => ({ ...a, name: (ach.BY_ID[a.ach_id] || {}).name || a.ach_id, tier: (ach.BY_ID[a.ach_id] || {}).tier })),
    brand: { channels: db.prepare('SELECT c.id, c.name, c.slug FROM channel_follows f JOIN channels c ON c.id=f.channel_id WHERE f.user_id=?').all(u.id), brand_id: u.brand_id || null },
    referrals: (() => { const inv = db.prepare('SELECT id, username, created_at, (SELECT COUNT(*) FROM runs r WHERE r.user_id=x.id) AS runs FROM users x WHERE referred_by=? ORDER BY created_at DESC LIMIT 100').all(u.id);
      return { invited: inv.length, played: inv.filter(x => x.runs > 0).length, list: inv }; })(),
    entries: db.prepare('SELECT g.id, g.title, e.joined_at, e.left_at, g.end_at, g.finalized_at FROM giveaway_entries e JOIN giveaways g ON g.id=e.giveaway_id WHERE e.user_id=? ORDER BY e.joined_at DESC LIMIT 50').all(u.id),
    wins: db.prepare(`SELECT g.id, g.title, c.place, c.created_at, 'confirmed' AS state FROM giveaway_confirm c JOIN giveaways g ON g.id=c.giveaway_id WHERE c.user_id=?
      UNION ALL SELECT g.id, g.title, NULL, w.drawn_at, w.method FROM winners w JOIN giveaways g ON g.id=w.giveaway_id WHERE w.user_id=? AND NOT EXISTS (SELECT 1 FROM giveaway_confirm c WHERE c.giveaway_id=w.giveaway_id AND c.user_id=w.user_id)
      ORDER BY 4 DESC LIMIT 50`).all(u.id, u.id),
    reports: db.prepare('SELECT r.id, r.kind, r.reason, r.details, r.status, r.created_at, x.username AS reporter FROM reports r LEFT JOIN users x ON x.id=r.reporter_id WHERE r.target_user_id=? ORDER BY r.created_at DESC LIMIT 30').all(u.id),
    notes: db.prepare('SELECT id, author, text, created_at FROM user_notes WHERE user_id=? ORDER BY created_at DESC').all(u.id),
    actions: db.prepare("SELECT at, actor, role, action, detail FROM admin_actions WHERE target=? ORDER BY id DESC LIMIT 50").all('user:' + u.id),
    resets: db.prepare('SELECT created_by, created_at, expires_at, used_at FROM pw_resets WHERE user_id=? ORDER BY id DESC LIMIT 5').all(u.id),
  };
  if (perms['users.pii']) {
    out.pii = { potato: u.potato, birth_date: u.birth_date, region: u.region || '',
      ips: db.prepare('SELECT ip_masked, ip_hash, device, first_seen, last_seen, hits FROM user_ip_log WHERE user_id=? ORDER BY last_seen DESC LIMIT 50').all(u.id).map(r => ({ ...r, ip_hash: r.ip_hash.slice(0, 8),
        shared_with: db.prepare('SELECT DISTINCT x.username FROM user_ip_log l JOIN users x ON x.id=l.user_id WHERE l.ip_hash=? AND l.user_id<>? LIMIT 5').all(r.ip_hash, u.id).map(z => z.username) })),
      devices: db.prepare('SELECT device, MIN(first_seen) AS first_seen, MAX(last_seen) AS last_seen, SUM(hits) AS hits FROM user_ip_log WHERE user_id=? GROUP BY device ORDER BY last_seen DESC').all(u.id),
      run_ips: db.prepare('SELECT ip_hash, COUNT(*) AS runs, MAX(created_at) AS last FROM runs WHERE user_id=? AND ip_hash IS NOT NULL GROUP BY ip_hash ORDER BY last DESC LIMIT 10').all(u.id).map(r => ({ ...r, ip_hash: String(r.ip_hash).slice(0, 8) })) };
  } else out.pii = null;
  return out;
}

// ---------- actions ----------
const A_ = (req, id, action, detail = '') => RO.act(req, action, 'user:' + id, detail);
function resetLink(req, id) {
  const u = db.prepare('SELECT id, username FROM users WHERE id=?').get(id); if (!u) return { ok: false, error: 'Player not found.' };
  const token = crypto.randomBytes(24).toString('base64url');
  const code = Array.from(crypto.randomBytes(8)).map(b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join(''); const t = now();
  db.prepare('UPDATE pw_resets SET expires_at=? WHERE user_id=? AND used_at IS NULL AND expires_at > ?').run(t, u.id, t); // only the newest one works
  db.prepare('INSERT INTO pw_resets (user_id, token_hash, code_hash, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?)').run(u.id, sha(token), sha(u.id + ':' + code), RO.who(req).username, t, t + D);
  A_(req, u.id, 'user.reset_password', 'one-time link + code (24 h)');
  return { ok: true, username: u.username, path: `/reset-password?token=${token}`, code: code.slice(0, 4) + '-' + code.slice(4), expires_at: t + D,
    potato_message: `Hi ${u.username}, here is your one-time Gaming Hub password reset. Open {LINK} or go to /reset-password and enter code ${code.slice(0, 4)}-${code.slice(4)} with your username. It works once and expires in 24 hours. We will never ask for your password.` };
}
function redeemReset({ token, username, code, password }) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 200) return { ok: false, status: 400, error: 'New password must be at least 8 characters.' };
  const t = now(); let row = null;
  if (token) row = db.prepare('SELECT * FROM pw_resets WHERE token_hash=?').get(sha(String(token).slice(0, 100)));
  else if (username && code) {
    const u = db.prepare('SELECT id FROM users WHERE username=?').get(String(username).trim().slice(0, 40)); if (!u) return { ok: false, status: 400, error: 'That code is not valid.' };
    row = db.prepare('SELECT * FROM pw_resets WHERE user_id=? AND used_at IS NULL AND expires_at > ? ORDER BY id DESC LIMIT 1').get(u.id, t);
    if (row) { db.prepare('UPDATE pw_resets SET tries=tries+1 WHERE id=?').run(row.id); if (row.tries >= 5) return { ok: false, status: 429, error: 'Too many wrong codes. Ask an admin for a new one.' };
      if (sha(u.id + ':' + String(code).toUpperCase().replace(/[^A-Z0-9]/g, '')) !== row.code_hash) return { ok: false, status: 400, error: 'That code is not valid.' }; }
  }
  if (!row || row.used_at || row.expires_at < t) return { ok: false, status: 400, error: 'This reset link or code is invalid, used or expired. Ask an admin for a new one.' };
  const claim = db.prepare('UPDATE pw_resets SET used_at=? WHERE id=? AND used_at IS NULL').run(t, row.id); if (!claim.changes) return { ok: false, status: 400, error: 'Already used.' };
  db.prepare('UPDATE users SET pass_hash=? WHERE id=?').run(bcrypt.hashSync(password, 10), row.user_id);
  db.prepare('INSERT INTO admin_actions (at, actor, role, action, target, detail) VALUES (?,?,?,?,?,?)').run(t, 'player', '', 'user.password_reset_used', 'user:' + row.user_id, '');
  return { ok: true, username: db.prepare('SELECT username FROM users WHERE id=?').get(row.user_id).username };
}
const USER_RE = /^[A-Za-z0-9_.-]{3,20}$/;
function edit(req, id, b) {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(id); if (!u) return { ok: false, error: 'Player not found.' };
  const upd = {}; const changes = [];
  if (b.username !== undefined && b.username !== u.username) {
    const n = String(b.username).trim(); if (!USER_RE.test(n)) return { ok: false, error: 'Username must be 3-20 characters: letters, numbers, _ . -' };
    if (db.prepare('SELECT 1 FROM users WHERE username=? AND id<>?').get(n, id)) return { ok: false, error: 'That username is taken.' };
    upd.username = n; changes.push(`username ${u.username} -> ${n}`);
  }
  if (b.potato !== undefined) { const p = String(b.potato).trim().replace(/^@/, ''); if (p && !/^[A-Za-z0-9_]{3,32}$/.test(p)) return { ok: false, error: 'Potato usernames use letters, numbers and _ (3-32).' }; if (p !== u.potato) { upd.potato = p; changes.push('potato'); } }
  if (b.region !== undefined) { const r = String(b.region).toUpperCase(); if (r && !require('./admin-giveaways').REGIONS.includes(r)) return { ok: false, error: 'Unknown state.' }; upd.region = r; changes.push('region'); }
  if (b.birth_date !== undefined && b.birth_date !== u.birth_date) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.birth_date))) return { ok: false, error: 'Birth date must be YYYY-MM-DD.' }; upd.birth_date = b.birth_date; changes.push('birth date'); }
  if (b.reset_cosmetics) for (const k of ['eq_title', 'eq_banner', 'eq_frame', 'eq_badge']) upd[k] = '';
  if (b.reset_cosmetics) changes.push('cosmetics reset');
  if (!Object.keys(upd).length) return { ok: true, changed: [] };
  db.prepare(`UPDATE users SET ${Object.keys(upd).map(k => `${k}=@${k}`).join(',')} WHERE id=@id`).run({ ...upd, id });
  A_(req, id, 'user.edit', changes.join(', ')); return { ok: true, changed: changes };
}
function points(req, id, amount, reason) {
  amount = Math.round(Number(amount)); if (!Number.isFinite(amount) || !amount || Math.abs(amount) > 1e6) return { ok: false, error: 'Enter a points amount (+ to grant, - to remove), max 1,000,000.' };
  reason = String(reason || '').trim().slice(0, 80); if (!reason) return { ok: false, error: 'A reason is required (it is shown in the player\'s points history).' };
  if (!db.prepare('SELECT 1 FROM users WHERE id=?').get(id)) return { ok: false, error: 'Player not found.' };
  db.prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?,?,?,?,?)').run(id, amount, 'admin', `${now()}-${crypto.randomBytes(3).toString('hex')}: ${reason}`, now());
  if (amount > 0) N.notify(id, 'system', `+${amount.toLocaleString('en-US')} Hub Points`, `From the Trap Tech team: ${reason}. Points are cosmetic only.`, '/shop', 'coins');
  A_(req, id, 'user.points', `${amount > 0 ? '+' : ''}${amount} (${reason})`);
  let bal = 0; try { bal = require('./shop').balance(id); } catch {} return { ok: true, balance: bal };
}
function item(req, id, itemId, on) {
  let SH; try { SH = require('./shop'); } catch { return { ok: false, error: 'Shop is not available.' }; }
  const it = SH.BY_ID[itemId]; if (!it) return { ok: false, error: 'Unknown item.' };
  if (on) { const r = db.prepare('INSERT OR IGNORE INTO user_items (user_id, item_id, price, acquired_at) VALUES (?,?,0,?)').run(id, it.id, now()); if (!r.changes) return { ok: false, error: 'Player already owns it.' }; N.notify(id, 'system', `You received ${it.name}`, 'A gift from the Trap Tech team. Equip it from your profile.', '/achievements', 'gift'); }
  else { const r = db.prepare('DELETE FROM user_items WHERE user_id=? AND item_id=?').run(id, it.id); if (!r.changes) return { ok: false, error: 'Player does not own it.' };
    const col = { banner: 'eq_banner', frame: 'eq_frame', title: 'eq_title', color: 'eq_color', effect: 'eq_effect', badge: 'eq_badge' }[it.type]; if (col) db.prepare(`UPDATE users SET ${col}='' WHERE id=? AND ${col} IN (?,?)`).run(id, it.id, 'shop:' + it.id); }
  A_(req, id, on ? 'user.item_grant' : 'user.item_revoke', it.id); return { ok: true };
}
function ban(req, id, on, reason = '') {
  const u = db.prepare('SELECT id, username FROM users WHERE id=?').get(id); if (!u) return { ok: false, error: 'Player not found.' };
  db.prepare('UPDATE users SET banned=?, suspended_until=NULL, ban_reason=? WHERE id=?').run(on ? 1 : 0, on ? String(reason).slice(0, 200) : '', id);
  A_(req, id, on ? 'user.ban' : 'user.unban', reason); return { ok: true };
}
function suspend(req, id, hours, reason = '') {
  hours = Number(hours); if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 365) return { ok: false, error: 'Suspend for 1 hour to 365 days.' };
  if (!String(reason || '').trim()) return { ok: false, error: 'A reason is required.' };
  const until = now() + hours * 3600e3;
  const r = db.prepare('UPDATE users SET banned=1, suspended_until=?, ban_reason=? WHERE id=?').run(until, String(reason).slice(0, 200), id); if (!r.changes) return { ok: false, error: 'Player not found.' };
  A_(req, id, 'user.suspend', `${hours} h: ${reason}`); return { ok: true, until };
}
function unsuspendExpired() { return db.prepare('UPDATE users SET banned=0, suspended_until=NULL WHERE suspended_until IS NOT NULL AND suspended_until < ?').run(now()).changes; }
function shadow(req, id, on) { const r = db.prepare('UPDATE users SET shadow_banned=? WHERE id=?').run(on ? 1 : 0, id); if (!r.changes) return { ok: false, error: 'Player not found.' }; A_(req, id, on ? 'user.shadow_ban' : 'user.shadow_unban'); return { ok: true }; }
function clearFlags(req, id, action = 'clear') {
  const AC = require('./anticheat'); const open = db.prepare("SELECT run_id FROM run_flags WHERE user_id=? AND status IN ('open','note')").all(id);
  for (const f of open) AC.review(f.run_id, action === 'confirm' ? 'confirm' : 'clear', RO.who(req).username, 'bulk from player profile');
  A_(req, id, action === 'confirm' ? 'user.flags_confirmed' : 'user.flags_cleared', `${open.length} runs`); return { ok: true, count: open.length };
}
function remove(req, id, confirmName) {
  const u = db.prepare('SELECT id, username FROM users WHERE id=?').get(id); if (!u) return { ok: false, error: 'Player not found.' };
  if (String(confirmName || '') !== u.username) return { ok: false, error: `Type the username (${u.username}) to confirm.` };
  db.prepare('DELETE FROM activity WHERE user_id=?').run(id);
  // locked final standings keep the username (immutable record); the user id is unlinked by the FK
  db.prepare('DELETE FROM users WHERE id=?').run(id);
  A_(req, id, 'user.delete', u.username); return { ok: true };
}
function exportData(id) {
  const u = db.prepare('SELECT id, username, created_at, last_seen, potato, birth_date, region, ref_code, banned, shadow_banned, suspended_until, eq_banner, eq_frame, eq_title, eq_badge, eq_color, eq_effect FROM users WHERE id=?').get(id); if (!u) return null;
  const q = (sql) => db.prepare(sql).all(id);
  return { exported_at: new Date().toISOString(), operator: 'Trap Tech Solutions', account: u,
    runs: q('SELECT id, game_id, score, coins, duration_ms, started_at, created_at FROM runs WHERE user_id=? ORDER BY id'), achievements: q('SELECT ach_id, unlocked_at FROM user_achievements WHERE user_id=?'),
    points: q('SELECT amount, reason, ref, created_at FROM points_ledger WHERE user_id=? ORDER BY id'), items: q('SELECT item_id, price, acquired_at FROM user_items WHERE user_id=?'),
    badges: q('SELECT badge_id, created_at, note FROM badge_grants WHERE user_id=?'), giveaway_entries: q('SELECT giveaway_id, joined_at, left_at FROM giveaway_entries WHERE user_id=?'),
    wins: q('SELECT giveaway_id, place, created_at FROM giveaway_confirm WHERE user_id=?'), follows: q('SELECT followee_id, created_at FROM follows WHERE follower_id=?'),
    checkins: q('SELECT day, created_at FROM checkins WHERE user_id=?'), quests: q('SELECT day, idx, created_at FROM quest_claims WHERE user_id=?'),
    notifications: q('SELECT type, title, created_at FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 500'),
    sign_ins: q('SELECT ip_masked, device, first_seen, last_seen, hits FROM user_ip_log WHERE user_id=?') };
}
function addNote(req, id, text) {
  text = String(text || '').trim().slice(0, 2000); if (!text) return { ok: false, error: 'Write a note first.' };
  if (!db.prepare('SELECT 1 FROM users WHERE id=?').get(id)) return { ok: false, error: 'Player not found.' };
  db.prepare('INSERT INTO user_notes (user_id, author, text, created_at) VALUES (?,?,?,?)').run(id, RO.who(req).username, text, now()); A_(req, id, 'user.note', text.slice(0, 80)); return { ok: true };
}
// ---------- player reports ----------
const REPORT_REASONS = ['cheating', 'offensive name', 'harassment', 'spam', 'multiple accounts', 'other'];
function fileReport(user, b) {
  const kind = ['user', 'run', 'post'].includes(b.kind) ? b.kind : 'user'; const reason = REPORT_REASONS.includes(b.reason) ? b.reason : 'other';
  let target = null;
  if (b.username) target = db.prepare('SELECT id FROM users WHERE username=?').get(String(b.username).slice(0, 40));
  if (!target && kind === 'run' && b.ref) { const r = db.prepare('SELECT user_id AS id FROM runs WHERE id=?').get(parseInt(b.ref, 10) || 0); if (r) target = r; }
  if (!target) return { ok: false, error: 'Player not found.' };
  if (target.id === user.id) return { ok: false, error: 'You can\'t report yourself.' };
  if (db.prepare("SELECT 1 FROM reports WHERE reporter_id=? AND target_user_id=? AND status='open'").get(user.id, target.id)) return { ok: true, duplicate: true };
  db.prepare('INSERT INTO reports (reporter_id, kind, target_user_id, ref, reason, details, created_at) VALUES (?,?,?,?,?,?,?)').run(user.id, kind, target.id, String(b.ref || '').slice(0, 40), reason, String(b.details || '').slice(0, 500), now());
  return { ok: true };
}
function reports(status = 'open') {
  return db.prepare(`SELECT r.*, t.username AS target, x.username AS reporter, (SELECT COUNT(*) FROM reports z WHERE z.target_user_id=r.target_user_id) AS total_against
    FROM reports r LEFT JOIN users t ON t.id=r.target_user_id LEFT JOIN users x ON x.id=r.reporter_id WHERE r.status=? ORDER BY r.created_at DESC LIMIT 200`).all(status);
}
function handleReport(req, id, status, resolution) {
  if (!['actioned', 'dismissed', 'open'].includes(status)) return { ok: false, error: 'Unknown status.' };
  const r = db.prepare('UPDATE reports SET status=?, handled_by=?, handled_at=?, resolution=? WHERE id=?').run(status, RO.who(req).username, now(), String(resolution || '').slice(0, 300), id);
  if (!r.changes) return { ok: false, error: 'Report not found.' };
  RO.act(req, 'report.' + status, 'report:' + id, resolution || ''); return { ok: true };
}
module.exports = { track, trackLogin, list, profile, resetLink, redeemReset, edit, points, item, ban, suspend, unsuspendExpired, shadow, clearFlags, remove, exportData, addNote, fileReport, reports, handleReport, REPORT_REASONS, device, maskIp, statusOf };
