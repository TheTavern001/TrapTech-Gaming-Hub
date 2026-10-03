// DB growth estimate for the Deplexo 250 MB disk budget: copies the DB and adds synthetic data
// (default 1,000 players / 100,000 runs, with a run token per run, ~40 achievements and ~20 notifications
// per player, an activity row per 20 runs), then prints file size, gzip backup size and bytes per run.
// Usage: [TOKENS=0] node tools/deplexo/db-growth.js [src.db] [players] [runs]   (TOKENS=0: run tokens pruned, the default steady state)
'use strict';
const fs = require('fs'); const zlib = require('zlib'); const crypto = require('crypto');
const Database = require('better-sqlite3');
const [src = 'data/hub.db', P = 1000, N = 100000] = process.argv.slice(2);
const out = '/tmp/hub-growth.db'; for (const s of ['', '-wal', '-shm']) fs.rmSync(out + s, { force: true });
(async () => {
  await new Database(src, { readonly: true }).backup(out);
  const db = new Database(out); db.pragma('journal_mode = WAL');
  const size = () => fs.statSync(out).size;
  const before = size();
  const hex = (n) => crypto.randomBytes(n).toString('hex');
  const games = ['jetpack-dash', 'drift-rush', 'plinko', 'memory-match', 'high-score', 'terp-tapper', 'stack-2048', 'munchies-snake', 'brick-breaker', 'sky-hopper'];
  const t0 = Date.now() - 90 * 864e5; const hash = '$2a$10$' + hex(26).slice(0, 53);
  const insU = db.prepare("INSERT INTO users (username, pass_hash, created_at, last_seen, birth_date, ref_code) VALUES (?,?,?,?,?,?)");
  const insT = db.prepare("INSERT INTO run_tokens (rid,user_id,game_id,started_at,used_at,status,ip_hash,seed) VALUES (?,?,?,?,?,'accepted',?,?)");
  const insR = db.prepare('INSERT INTO runs (user_id,game_id,score,coins,duration_ms,started_at,created_at,ip_hash,ua_hash,seed,verify,held) VALUES (?,?,?,?,?,?,?,?,?,?,?,0)');
  const insA = db.prepare('INSERT OR IGNORE INTO user_achievements (user_id, ach_id, unlocked_at) VALUES (?,?,?)');
  const insN = db.prepare("INSERT INTO notifications (user_id, type, title, body, link, icon, created_at) VALUES (?,?,?,?,?,?,?)");
  const insAct = db.prepare("INSERT INTO activity (type,message,user_id,ref_id,created_at) VALUES ('highscore',?,?,?,?)");
  const ids = [];
  db.transaction(() => {
    for (let i = 0; i < P; i++) {
      const id = insU.run('growth_' + i + '_' + hex(3), hash, t0, Date.now(), '1990-01-01', hex(4)).lastInsertRowid; ids.push(id);
      for (let a = 0; a < 40; a++) insA.run(id, 'ach-' + a, t0 + a * 1e6);
      for (let n = 0; n < 20; n++) insN.run(id, 'achievement', 'Achievement unlocked: Gold Pilot', 'You reached 3,000 m in Jetpack Dash. Keep flying!', '/achievements', 'trophy', t0 + n * 1e6);
    }
  })();
  const chunk = 10000;
  for (let c = 0; c < N; c += chunk) db.transaction(() => {
    for (let k = c; k < Math.min(N, c + chunk); k++) {
      const u = ids[(Math.random() * ids.length) | 0]; const g = games[k % games.length]; const st = t0 + k * 60e3; const seed = hex(8); const ip = hex(8);
      if (process.env.TOKENS !== '0') insT.run(hex(16), u, g, st, st + 60e3, ip, seed);
      const id = insR.run(u, g, (Math.random() * 5000) | 0, (Math.random() * 50) | 0, 30e3 + ((Math.random() * 120e3) | 0), st, st + 60e3, ip, hex(6), seed, '').lastInsertRowid;
      if (k % 20 === 0) insAct.run(`growth_x set a new high score in ${g}`, u, id, st + 60e3);
    }
  })();
  db.pragma('wal_checkpoint(TRUNCATE)'); db.close();
  const after = size(); const gz = zlib.gzipSync(fs.readFileSync(out), { level: 6 }).length;
  const MB = (b) => (b / 1048576).toFixed(1) + ' MB';
  console.log(JSON.stringify({ players: +P, runs: +N, db_before: MB(before), db_after: MB(after), added: MB(after - before), bytes_per_run_incl_token_and_indexes: Math.round((after - before - P * 0) / N), backup_gz: MB(gz), five_backups: MB(gz * 5) }, null, 1));
})();
