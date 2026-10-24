'use strict';
// v7 games: retire Stack 2048 cleanly (replaced by the endless "Stack").
//  * The final Stack 2048 leaderboard is snapshotted once into leaderboard_archive (rank, player, best, runs, first/last run).
//  * Its runs stay in the runs table (profiles, share cards and locked giveaway results keep working) but no longer count on
//    the active global board (src/boards.js filters to catalog games).
//  * Open/upcoming giveaways linked to it are re-linked (it is removed; if it was the only game, "stack" takes its place),
//    tournaments that have not ended switch to "stack", and pending/accepted challenges on it are expired.
//  * The migration is idempotent (guarded by settings key v7_retired:<id>), so it is safe on every boot and on a live DB.
// Routes: GET /api/games/archive (retired games + archive sizes), GET /api/games/archive/:id (archived board).
const db = require('./db');
const cfg = require('./config');

db.exec(`CREATE TABLE IF NOT EXISTS leaderboard_archive (
  game_id TEXT NOT NULL, rank INTEGER NOT NULL, user_id INTEGER, username TEXT NOT NULL, score INTEGER NOT NULL,
  runs INTEGER NOT NULL, first_at INTEGER, last_at INTEGER, archived_at INTEGER NOT NULL, PRIMARY KEY (game_id, rank))`);

function retire(old, t = Date.now()) {
  const key = 'v7_retired:' + old.id;
  if (db.prepare('SELECT 1 FROM settings WHERE key=?').get(key)) return { already: true };
  const out = { archived: 0, relinked: 0, replaced: 0, tournaments: 0, challenges: 0 };
  db.transaction(() => {
    const rows = db.prepare(`SELECT u.id AS user_id, u.username, MAX(r.score) AS score, COUNT(*) AS runs, MIN(r.created_at) AS first_at, MAX(r.created_at) AS last_at
      FROM runs r JOIN users u ON u.id = r.user_id WHERE r.game_id = ? AND r.held = 0 AND u.banned = 0 GROUP BY u.id ORDER BY score DESC, last_at ASC`).all(old.id);
    const ins = db.prepare('INSERT OR REPLACE INTO leaderboard_archive (game_id, rank, user_id, username, score, runs, first_at, last_at, archived_at) VALUES (?,?,?,?,?,?,?,?,?)');
    rows.forEach((r, i) => ins.run(old.id, i + 1, r.user_id, r.username, r.score, r.runs, r.first_at, r.last_at, t)); out.archived = rows.length;
    const gws = db.prepare(`SELECT g.id FROM giveaways g JOIN giveaway_games gg ON gg.giveaway_id = g.id WHERE gg.game_id = ? AND g.finalized_at IS NULL AND g.end_at > ?`).all(old.id, t);
    for (const g of gws) {
      db.prepare('DELETE FROM giveaway_games WHERE giveaway_id=? AND game_id=?').run(g.id, old.id); out.relinked++;
      if (!db.prepare('SELECT 1 FROM giveaway_games WHERE giveaway_id=?').get(g.id)) { db.prepare('INSERT OR IGNORE INTO giveaway_games (giveaway_id, game_id) VALUES (?,?)').run(g.id, old.replacedBy); out.replaced++; }
    }
    out.tournaments = db.prepare('UPDATE tournaments SET game_id=? WHERE game_id=? AND end_at > ?').run(old.replacedBy, old.id, t).changes;
    out.challenges = db.prepare("UPDATE challenges SET status='expired' WHERE game_id=? AND status IN ('pending','accepted')").run(old.id).changes;
    db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?,?,?)').run(key, JSON.stringify(out), t);
  })();
  if (out.archived || out.relinked || out.tournaments || out.challenges) console.log(`v7: retired ${old.id}`, JSON.stringify(out));
  return out;
}
// v9 (2026-10-24): Jetpack Dash became Bud Escape (same id, new game: vehicles, harvest arms, drones, missions). Once, on the
// first boot of this version, move every classic Jetpack Dash run to the retired id 'jetpack-dash-m' (its board is archived by
// retire() below) and expire pending Jetpack challenges, so the live board starts fresh and the two games are never ranked together.
(function budEscapeCutover() {
  const key = 'v9_bud_escape'; if (db.prepare('SELECT 1 FROM settings WHERE key=?').get(key)) return;
  const t = Date.now(); const out = {};
  db.transaction(() => {
    out.runs = db.prepare("UPDATE runs SET game_id='jetpack-dash-m' WHERE game_id='jetpack-dash'").run().changes;
    out.challenges = db.prepare("UPDATE challenges SET status='expired' WHERE game_id='jetpack-dash' AND status IN ('pending','accepted')").run().changes;
    db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?,?,?)').run(key, JSON.stringify(out), t);
  })();
  if (out.runs || out.challenges) console.log('v9: Bud Escape cutover', JSON.stringify(out));
})();
for (const g of cfg.RETIRED) retire(g);
// library titles retired in src/games-lib.js (OWNER_RETIRED) get the same archive + giveaway/tournament relink
for (const g of cfg.LIB_GAMES) if (g.retired && g.replacedBy) retire(g);

// v7 item 21: chance games are "just for fun". Unlink them from every giveaway that is still open (runs on every boot, cheap and
// idempotent); a giveaway left with no game gets Bud Escape so it stays playable. Finalized giveaways keep their history.
function unlinkFun(t = Date.now()) {
  const fun = [...cfg.JUST_FOR_FUN]; if (!fun.length) return 0; const ph = fun.map(() => '?').join(',');
  const rows = db.prepare(`SELECT gg.giveaway_id AS gid, gg.game_id FROM giveaway_games gg JOIN giveaways g ON g.id = gg.giveaway_id WHERE gg.game_id IN (${ph}) AND g.finalized_at IS NULL AND g.end_at > ?`).all(...fun, t);
  if (!rows.length) return 0;
  db.transaction(() => {
    for (const r of rows) db.prepare('DELETE FROM giveaway_games WHERE giveaway_id=? AND game_id=?').run(r.gid, r.game_id);
    for (const gid of new Set(rows.map(r => r.gid))) {
      const left = db.prepare('SELECT game_id FROM giveaway_games WHERE giveaway_id=? ORDER BY rowid').all(gid).map(x => x.game_id);
      if (!left.length) { db.prepare('INSERT OR IGNORE INTO giveaway_games (giveaway_id, game_id) VALUES (?,?)').run(gid, 'jetpack-dash'); left.push('jetpack-dash'); }
      db.prepare('UPDATE giveaways SET game_id=? WHERE id=?').run(left[0], gid);
    }
  })();
  console.log(`v7: unlinked ${rows.length} just-for-fun game link(s) from open giveaways`); return rows.length;
}
unlinkFun();

module.exports = (app) => {
  app.get('/api/games/archive', (req, res) => res.json({ ok: true, games: cfg.RETIRED.map(g => ({ id: g.id, title: g.title, replaced_by: g.replacedBy,
    players: db.prepare('SELECT COUNT(*) AS c FROM leaderboard_archive WHERE game_id=?').get(g.id).c,
    archived_at: (db.prepare('SELECT MAX(archived_at) AS t FROM leaderboard_archive WHERE game_id=?').get(g.id) || {}).t || null })) }));
  app.get('/api/games/archive/:id', (req, res) => {
    const g = cfg.RETIRED.find(x => x.id === req.params.id); if (!g) return res.status(404).json({ ok: false, error: 'No archived board for that game.' });
    const limit = Math.min(Math.max(parseInt(req.query.limit || '100', 10) || 100, 1), 1000);
    const rows = db.prepare('SELECT rank, username, score, runs, first_at, last_at FROM leaderboard_archive WHERE game_id=? ORDER BY rank LIMIT ?').all(g.id, limit);
    res.json({ ok: true, game: { id: g.id, title: g.title, replaced_by: g.replacedBy }, rows });
  });
};
module.exports.retire = retire; module.exports.unlinkFun = unlinkFun;
