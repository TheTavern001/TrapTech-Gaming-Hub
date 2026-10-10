// v7 Phase 9: count rows in a DB (used before/after booting v7 on a v6 database). node tools/v6-migrate-check.js <db>
const D = require('better-sqlite3'); const db = new D(process.argv[2], { readonly: true });
const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name);
const out = { tables: t.length, users: 0 }; for (const n of ['users', 'runs', 'user_achievements', 'giveaways', 'channels', 'sponsor_requests', 'store_orders', 'avatar_parts_owned']) if (t.includes(n)) out[n] = db.prepare(`SELECT COUNT(*) c FROM ${n}`).get().c;
const u = db.prepare("SELECT id, username, created_at FROM users WHERE username='TheBudTender001'").get(); out.budtender = u || null;
if (u) { out.budtender_runs = db.prepare('SELECT COUNT(*) c FROM runs WHERE user_id=?').get(u.id).c; try { out.budtender_avatar = db.prepare('SELECT avatar FROM users WHERE id=?').get(u.id).avatar; } catch { out.budtender_avatar = 'n/a (v6)'; } }
console.log(JSON.stringify(out));
