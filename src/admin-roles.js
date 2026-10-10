'use strict';
// v7 item 23: admin roles + permission matrix (owner > admin > moderator) and staff appointment.
// Thin adapter over src/admin-sec.js (per-account admin users + requireRole, owned by the site/auth work):
//   - identity + role come from ADMSEC (req.admin = { id, username, role }); if an older admin-sec without accounts is
//     loaded, the single signed-in admin is treated as the owner (legacy fallback), so nothing here hard-depends on it.
//   - perm(key) = authenticated (moderator+) AND role >= the matrix minimum for key. The matrix lives in settings
//     ('admin_perms'); owner-only and admin-minimum ("locked") entries can't be lowered by anyone.
//   - invites: owner makes a one-time link for a role; the invitee picks a username + password, then signs in normally
//     and enrols their authenticator app (admin-sec handles 2FA). Only a hash of the token is stored.
const crypto = require('crypto');
const db = require('./db');
const now = () => Date.now();
let ADMSEC = null; try { ADMSEC = require('./admin-sec'); } catch { ADMSEC = null; }

const RANK = { moderator: 1, admin: 2, owner: 3 };
const atLeast = (role, min) => (RANK[role] || 0) >= (RANK[min] || 99);
// key: [label, group, default minimum role, lock] lock: 'owner' = always owner-only, 'admin' = never below admin
const PERMS = {
  'dashboard.view': ['See the dashboard', 'General', 'moderator'],
  'giveaways.view': ['See giveaways, entrants and standings', 'Giveaways', 'moderator'],
  'giveaways.edit': ['Create and edit giveaways (builder, drafts, templates)', 'Giveaways', 'admin'],
  'giveaways.publish': ['Publish, pause, end early, extend, cancel, archive', 'Giveaways', 'admin'],
  'winners.review': ['Confirm / disqualify winners, mark claims, announce winners', 'Giveaways', 'admin'],
  'users.view': ['Search players and open profiles', 'Players', 'moderator'],
  'users.pii': ['See IP + device history, birth date and contact details', 'Players', 'admin', 'admin'],
  'users.moderate': ['Suspend, shadow-ban, clear flagged runs, add notes', 'Players', 'moderator'],
  'users.ban': ['Ban / unban permanently', 'Players', 'admin'],
  'users.edit': ['Edit profiles, grant / revoke points, items and badges', 'Players', 'admin'],
  'users.reset_password': ['Make one-time password reset links / codes', 'Players', 'admin'],
  'users.delete': ['Delete accounts', 'Players', 'admin', 'admin'],
  'users.export': ['Export a player\'s data', 'Players', 'admin', 'admin'],
  'moderation.queue': ['Fair-play queue and player reports', 'Moderation', 'moderator'],
  'actionlog.view': ['See the admin action log', 'Moderation', 'admin'],
  'games.profiles': ['Edit Game Rules Profiles and import the game catalog', 'Giveaways', 'admin'],
  'events.manage': ['Specials and limited-time events', 'Live ops', 'admin'],
  'seasons.manage': ['Seasons and reward tracks', 'Live ops', 'admin'],
  'shop.manage': ['Shop rotations, pins, sales, retiring items', 'Live ops', 'admin'],
  'badges.manage': ['Create and edit badges', 'Live ops', 'admin'],
  'badges.award': ['Award / revoke badges', 'Live ops', 'admin'],
  'announcements.post': ['Site banner and notification broadcasts', 'Live ops', 'admin'],
  'analytics.view': ['Analytics', 'General', 'admin'],
  'settings.manage': ['Site settings, maintenance mode, legal pages', 'General', 'admin', 'admin'],
  'staff.manage': ['Appoint / remove admins and moderators', 'Owner only', 'owner', 'owner'],
  'ownership.transfer': ['Transfer ownership', 'Owner only', 'owner', 'owner'],
  'billing.view': ['Billing, sponsor quotes and bookings', 'Owner only', 'owner', 'owner'],
};
const getS = (k, d) => { try { const r = db.prepare('SELECT value FROM settings WHERE key=?').get(k); return r ? JSON.parse(r.value) : d; } catch { return d; } };
const setS = (k, v) => db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at').run(k, JSON.stringify(v), now());
function matrix() {
  const o = getS('admin_perms', {}); const out = {};
  for (const [k, [label, group, def, lock]] of Object.entries(PERMS)) {
    let min = RANK[o[k]] ? o[k] : def;
    if (lock === 'owner') min = 'owner'; if (lock === 'admin' && RANK[min] < RANK.admin) min = 'admin';
    out[k] = { key: k, label, group, min, default: def, locked: lock || null };
  }
  return out;
}
function setMatrix(changes) {
  const o = getS('admin_perms', {}); const m = matrix();
  for (const [k, v] of Object.entries(changes || {})) {
    if (!m[k] || !RANK[v] || m[k].locked === 'owner') continue;
    if (m[k].locked === 'admin' && RANK[v] < RANK.admin) continue;
    if (v === 'owner' && !m[k].locked) o[k] = 'owner'; else o[k] = v;
  }
  setS('admin_perms', o); return matrix();
}
const can = (role, key) => { const m = matrix()[key]; return !!m && atLeast(role, m.min); };
const permsFor = (role) => Object.fromEntries(Object.keys(PERMS).map(k => [k, can(role, k)]));

// ---------- identity ----------
const legacy = !ADMSEC || typeof ADMSEC.requireRole !== 'function';
const authMw = legacy ? (ADMSEC ? ADMSEC.requireAdmin : (req, res) => res.status(401).json({ ok: false, error: 'Admin login required.' })) : ADMSEC.requireRole('moderator');
function who(req) {
  if (req.admin && req.admin.role) return req.admin;
  return { id: 0, username: 'owner', role: 'owner', legacy: true }; // single-password admin = the owner
}
// express middleware: authenticated + allowed by the matrix
function perm(key) {
  return [authMw, (req, res, next) => {
    const w = who(req); req.admin = req.admin || w;
    if (!can(w.role, key)) return res.status(403).json({ ok: false, error: `Your role (${w.role}) can't do this. Needs: ${matrix()[key] ? matrix()[key].label : key}.`, perm: key, role: w.role });
    next();
  }];
}

// ---------- admin action log (every write in the v7 admin backends) ----------
db.exec(`CREATE TABLE IF NOT EXISTS admin_actions (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, actor TEXT NOT NULL, role TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL, target TEXT NOT NULL DEFAULT '', detail TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS idx_admin_actions_at ON admin_actions(at);
CREATE TABLE IF NOT EXISTS admin_invites (id INTEGER PRIMARY KEY AUTOINCREMENT, token_hash TEXT NOT NULL UNIQUE, role TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER, used_by TEXT, revoked_at INTEGER);`);
function act(req, action, target = '', detail = '') {
  const w = req && req.admin ? req.admin : (req && req.actor) || { username: 'system', role: '' };
  db.prepare('INSERT INTO admin_actions (at, actor, role, action, target, detail) VALUES (?,?,?,?,?,?)')
    .run(now(), String(w.username || 'admin'), String(w.role || ''), action, String(target).slice(0, 120), typeof detail === 'string' ? detail.slice(0, 500) : JSON.stringify(detail).slice(0, 500));
  if (Math.random() < 0.01) db.prepare('DELETE FROM admin_actions WHERE at < ?').run(now() - 365 * 864e5);
}

// ---------- staff (accounts live in admin-sec; these wrap them) ----------
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const accounts = () => (ADMSEC && ADMSEC.accounts) || null;
function staffList() { const a = accounts(); return a ? a.list() : [{ id: 0, username: 'owner', display_name: 'Owner', role: 'owner', legacy: true }]; }
function makeInvite(req, role, note = '', hours = 72) {
  if (!['admin', 'moderator'].includes(role)) return { ok: false, error: 'Invites are for admin or moderator.' };
  const token = crypto.randomBytes(24).toString('base64url'); const t = now();
  const info = db.prepare('INSERT INTO admin_invites (token_hash, role, note, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?)')
    .run(sha(token), role, String(note).slice(0, 120), who(req).username, t, t + Math.max(1, Math.min(24 * 14, hours)) * 3600e3);
  return { ok: true, id: info.lastInsertRowid, token, role, expires_at: t + hours * 3600e3 };
}
const inviteByToken = (token) => db.prepare('SELECT * FROM admin_invites WHERE token_hash=?').get(sha(token));
function inviteState(inv) { if (!inv) return 'missing'; if (inv.revoked_at) return 'revoked'; if (inv.used_at) return 'used'; if (inv.expires_at < now()) return 'expired'; return 'open'; }
async function acceptInvite(token, { username, password, display_name }) {
  const inv = inviteByToken(token); const st = inviteState(inv);
  if (st !== 'open') return { ok: false, error: `This invite link is ${st}. Ask the owner for a new one.` };
  const a = accounts(); if (!a || !a.create) return { ok: false, error: 'Per-account admin sign-in is not available on this server yet.' };
  const r = await a.create({ username, role: inv.role, password, display_name }, null);
  if (!r.ok) return r;
  const claim = db.prepare('UPDATE admin_invites SET used_at=?, used_by=? WHERE id=? AND used_at IS NULL').run(now(), r.account.username, inv.id);
  if (!claim.changes) { a.remove(r.account.id); return { ok: false, error: 'This invite was just used.' }; }
  try { db.prepare('UPDATE admin_users SET must_change=0, created_by=(SELECT id FROM admin_users WHERE role=\'owner\' LIMIT 1) WHERE id=?').run(r.account.id); } catch {}
  db.prepare('INSERT INTO admin_actions (at, actor, role, action, target, detail) VALUES (?,?,?,?,?,?)').run(now(), r.account.username, inv.role, 'invite.accepted', r.account.username, `invite #${inv.id} (${inv.role})`);
  return { ok: true, username: r.account.username, role: inv.role };
}
// owner hands the crown to an existing admin; the old owner becomes an admin. Both are signed out.
function transferOwnership(req, targetId, confirmName) {
  const a = accounts(); if (!a) return { ok: false, error: 'Per-account admin sign-in is not available on this server yet.' };
  if (typeof a.transfer === 'function') return a.transfer(who(req).id, targetId, confirmName);
  const me = who(req); const target = a.get(+targetId);
  if (!target) return { ok: false, error: 'No such admin.' };
  if (target.id === me.id) return { ok: false, error: 'You are already the owner.' };
  if (target.role !== 'admin') return { ok: false, error: 'Ownership can only go to an existing admin (promote them to admin first).' };
  if (target.disabled) return { ok: false, error: 'That account is disabled.' };
  if (String(confirmName || '').toLowerCase() !== target.username.toLowerCase()) return { ok: false, error: `Type the new owner's username (${target.username}) to confirm.` };
  db.transaction(() => {
    db.prepare("UPDATE admin_users SET role='owner', pw_ver=pw_ver+1 WHERE id=?").run(target.id);
    db.prepare("UPDATE admin_users SET role='admin', pw_ver=pw_ver+1 WHERE id=?").run(me.id);
    db.prepare('DELETE FROM admin_sessions WHERE admin_id IN (?,?)').run(target.id, me.id);
  })();
  return { ok: true, owner: target.username };
}

module.exports = { RANK, PERMS, atLeast, matrix, setMatrix, can, permsFor, perm, who, act, authMw, legacy, staffList, makeInvite, inviteByToken, inviteState, acceptInvite, transferOwnership, getS, setS, ADMSEC: () => ADMSEC };
