'use strict';
// v3 notifications center. user_id NULL = broadcast (new giveaways, tournaments, announcements).
const db = require('./db');
const ins = db.prepare('INSERT INTO notifications (user_id, type, title, body, link, icon, created_at, is_demo) VALUES (?,?,?,?,?,?,?,?)');
function notify(userId, type, title, body = '', link = '', icon = 'bell', at = Date.now(), isDemo = 0) {
  return ins.run(userId ?? null, type, String(title).slice(0, 140), String(body).slice(0, 400), String(link).slice(0, 200), icon, at, isDemo).lastInsertRowid;
}
function listFor(user, limit = 50) {
  const rows = db.prepare(`SELECT id, user_id, type, title, body, link, icon, created_at, read_at FROM notifications
    WHERE (user_id = ? OR (user_id IS NULL AND created_at >= ?)) ORDER BY created_at DESC, id DESC LIMIT ?`).all(user.id, user.created_at - 7 * 864e5, limit);
  const seen = db.prepare('SELECT notif_seen_at FROM users WHERE id=?').get(user.id).notif_seen_at || 0;
  return rows.map(r => ({ ...r, broadcast: r.user_id === null, unread: r.user_id === null ? r.created_at > seen : !r.read_at, user_id: undefined }));
}
function unreadCount(user) {
  const seen = db.prepare('SELECT notif_seen_at FROM users WHERE id=?').get(user.id)?.notif_seen_at || 0;
  return db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id=? AND read_at IS NULL').get(user.id).c
    + db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id IS NULL AND created_at > ? AND created_at >= ?').get(seen, user.created_at - 7 * 864e5).c;
}
function markRead(user, id) {
  const t = Date.now();
  if (id) { db.prepare('UPDATE notifications SET read_at=? WHERE id=? AND user_id=? AND read_at IS NULL').run(t, id, user.id); return; }
  db.prepare('UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL').run(t, user.id);
  db.prepare('UPDATE users SET notif_seen_at=? WHERE id=?').run(t, user.id);
}
module.exports = { notify, listFor, unreadCount, markRead };
