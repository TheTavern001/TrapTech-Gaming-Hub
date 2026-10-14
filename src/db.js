'use strict';
const fs = require('fs');
const path = require('path');
const { DB_PATH } = require('./config');

try { fs.mkdirSync(path.dirname(DB_PATH), { recursive: true }); fs.accessSync(path.dirname(DB_PATH), fs.constants.W_OK); } catch (e) {
  console.error(`FATAL: database directory ${path.dirname(DB_PATH)} is not writable by uid ${process.getuid && process.getuid()} (${e.code || e.message}). ` +
    'Mount the persistent volume there (Deplexo: /data) and set DATA_DIR to it; the container root filesystem is read-only.');
  process.exit(1);
}
// SQLite spill/temp files go next to the database (the persistent volume), not to RAM or a small tmpfs.
// Must be set before SQLite initialises, i.e. before better-sqlite3 is loaded.
if (!process.env.SQLITE_TMPDIR) {
  const t = path.join(path.dirname(DB_PATH), 'tmp');
  try { fs.mkdirSync(t, { recursive: true }); fs.accessSync(t, fs.constants.W_OK); process.env.SQLITE_TMPDIR = t; } catch { /* falls back to TMPDIR / /tmp */ }
}
const Database = require('better-sqlite3');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
// Low-memory tuning (Deplexo free plan: 128 MB RAM). Page cache is bounded, no mmap of the DB file, temp b-trees
// (big ORDER BY / GROUP BY sorts) spill to files instead of RAM, and the WAL is checkpointed + truncated regularly.
db.pragma(`cache_size = -${Math.max(256, Number(process.env.SQLITE_CACHE_KB || 2048))}`); // KiB
db.pragma('mmap_size = 0');
db.pragma('temp_store = FILE');
db.pragma('wal_autocheckpoint = 500');          // pages (~2 MB)
db.pragma('journal_size_limit = 4194304');      // truncate the WAL back to <= 4 MB after checkpoints
db.pragma(`soft_heap_limit = ${16 * 1048576}`); // SQLite releases cache memory when it goes above 16 MB

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen INTEGER,
  banned INTEGER NOT NULL DEFAULT 0,
  is_demo INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS run_tokens (
  rid TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  used_at INTEGER,
  status TEXT,
  reason TEXT,
  ip_hash TEXT
);
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  coins INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  ip_hash TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_runs_game_time ON runs(game_id, created_at);
CREATE INDEX IF NOT EXISTS idx_runs_user ON runs(user_id, created_at);
CREATE TABLE IF NOT EXISTS giveaway_checklist_done (
  giveaway_id INTEGER NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  checked_at INTEGER NOT NULL,
  PRIMARY KEY (giveaway_id, user_id, step_id)
);
CREATE TABLE IF NOT EXISTS giveaways (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  host TEXT NOT NULL DEFAULT '',
  prize TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  entry_method TEXT NOT NULL DEFAULT 'play',
  game_id TEXT NOT NULL DEFAULT 'jetpack-dash',
  rules TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS winners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  giveaway_id INTEGER NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  score INTEGER,
  drawn_at INTEGER NOT NULL,
  UNIQUE(giveaway_id, user_id)
);
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT NOT NULL,
  contact_name TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL DEFAULT '',
  package TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT NOT NULL DEFAULT '',
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  ip_hash TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  user_id INTEGER,
  ref_id INTEGER,
  created_at INTEGER NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_activity_time ON activity(created_at);
-- v2: a giveaway can count several games
CREATE TABLE IF NOT EXISTS giveaway_games (
  giveaway_id INTEGER NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  PRIMARY KEY (giveaway_id, game_id)
);
CREATE INDEX IF NOT EXISTS idx_gg_game ON giveaway_games(game_id);
-- v2: admin-editable settings (hosting packages, ...), JSON values
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
-- v2: achievements unlocked (evaluated server-side only)
CREATE TABLE IF NOT EXISTS user_achievements (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ach_id TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, ach_id)
);
CREATE INDEX IF NOT EXISTS idx_ua_ach ON user_achievements(ach_id);
-- v2: community reactions ("hype")
CREATE TABLE IF NOT EXISTS reactions (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, item_key)
);
CREATE INDEX IF NOT EXISTS idx_reactions_item ON reactions(item_key);
CREATE INDEX IF NOT EXISTS idx_runs_user_game ON runs(user_id, game_id, created_at);
-- v3: daily check-ins (login streak), daily quest claims, follows, notifications, tournaments, shares
CREATE TABLE IF NOT EXISTS checkins (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, day)
);
CREATE TABLE IF NOT EXISTS quest_claims (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  idx INTEGER NOT NULL,
  xp INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, day, idx)
);
CREATE TABLE IF NOT EXISTS follows (
  follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (follower_id, followee_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- NULL = broadcast to everyone
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'bell',
  created_at INTEGER NOT NULL,
  read_at INTEGER,
  is_demo INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at);
CREATE TABLE IF NOT EXISTS tournaments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  game_id TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'timed',   -- timed | bracket
  description TEXT NOT NULL DEFAULT '',
  prize TEXT NOT NULL DEFAULT '',
  start_at INTEGER NOT NULL,
  qual_end_at INTEGER,                    -- bracket: end of the qualifying window
  round_ms INTEGER,                       -- bracket: length of each knockout round
  end_at INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS shares (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  ref TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, kind, ref)
);
`);

// v2 column migrations (idempotent)
function addCol(table, col, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
}
addCol('giveaways', 'tier', "TEXT NOT NULL DEFAULT ''");
addCol('giveaways', 'brand_color', "TEXT NOT NULL DEFAULT ''");
addCol('giveaways', 'featured', 'INTEGER NOT NULL DEFAULT 0');
addCol('giveaways', 'min_score', 'INTEGER NOT NULL DEFAULT 0');
addCol('giveaways', 'prize_tiers', "TEXT NOT NULL DEFAULT ''");
addCol('giveaways', 'brand_logo', "TEXT NOT NULL DEFAULT ''");
addCol('users', 'eq_banner', "TEXT NOT NULL DEFAULT ''");
addCol('users', 'eq_frame', "TEXT NOT NULL DEFAULT ''");
addCol('users', 'eq_title', "TEXT NOT NULL DEFAULT ''");
addCol('users', 'eq_badge', "TEXT NOT NULL DEFAULT ''");
addCol('bookings', 'package_snapshot', "TEXT NOT NULL DEFAULT ''");
// v5 booking: business type, email and/or Potato username, licensed-business confirmation (cannabis sellers only), add-ons
addCol('bookings', 'business_type', "TEXT NOT NULL DEFAULT ''");
addCol('bookings', 'email', "TEXT NOT NULL DEFAULT ''");
addCol('bookings', 'potato', "TEXT NOT NULL DEFAULT ''");
addCol('bookings', 'licensed_confirmed', 'INTEGER NOT NULL DEFAULT 0');
addCol('bookings', 'addons', "TEXT NOT NULL DEFAULT ''");
// v3
addCol('users', 'ref_code', "TEXT");
addCol('users', 'referred_by', 'INTEGER');
addCol('users', 'birth_date', "TEXT NOT NULL DEFAULT ''");
// Every account session has a server-side revocation epoch. Legacy tokens
// lacking the version are intentionally rejected after this security update.
addCol('users', 'session_version', 'INTEGER NOT NULL DEFAULT 0');
addCol('users', 'notif_seen_at', 'INTEGER NOT NULL DEFAULT 0');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_ref ON users(ref_code)');
// v4: deterministic winners, locked final standings, verifiable draws, winner review + audit
addCol('giveaways', 'win_method', "TEXT NOT NULL DEFAULT 'score'"); // score | random
addCol('giveaways', 'winner_count', 'INTEGER NOT NULL DEFAULT 0'); // 0 = auto (number of prize tiers, min 1)
addCol('giveaways', 'finalized_at', 'INTEGER');
addCol('giveaways', 'draw_seed', 'TEXT');      // secret until finalization (revealed afterwards)
addCol('giveaways', 'draw_commit', 'TEXT');    // sha256(draw_seed), published from creation
addCol('giveaways', 'entrants_hash', 'TEXT');  // sha256 of the canonical final entrant list
addCol('runs', 'ua_hash', 'TEXT');
db.exec(`
CREATE INDEX IF NOT EXISTS idx_runs_ip ON runs(ip_hash);
CREATE TABLE IF NOT EXISTS giveaway_results (
  giveaway_id INTEGER NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username TEXT NOT NULL,
  score INTEGER NOT NULL,
  best_run_id INTEGER,
  reached_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  draw_key TEXT,               -- random giveaways: HMAC-SHA256(seed, entrants_hash:username), sorted ascending = draw order
  draw_pos INTEGER,
  locked_at INTEGER NOT NULL,
  PRIMARY KEY (giveaway_id, rank)
);
CREATE INDEX IF NOT EXISTS idx_gres_user ON giveaway_results(giveaway_id, user_id);
-- the snapshot is immutable: no edits of the locked fields, no deletes while the giveaway exists
CREATE TRIGGER IF NOT EXISTS gres_no_update BEFORE UPDATE OF giveaway_id, rank, username, score, best_run_id, reached_at, attempts, draw_key, draw_pos, locked_at ON giveaway_results
BEGIN SELECT RAISE(ABORT, 'final standings are locked'); END;
CREATE TRIGGER IF NOT EXISTS gres_no_delete BEFORE DELETE ON giveaway_results WHEN EXISTS (SELECT 1 FROM giveaways WHERE id = OLD.giveaway_id)
BEGIN SELECT RAISE(ABORT, 'final standings are locked'); END;
CREATE TABLE IF NOT EXISTS giveaway_dq (
  giveaway_id INTEGER NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (giveaway_id, user_id)
);
CREATE TABLE IF NOT EXISTS giveaway_confirm (
  giveaway_id INTEGER NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (giveaway_id, user_id)
);
CREATE TABLE IF NOT EXISTS giveaway_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  giveaway_id INTEGER NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  username TEXT,
  detail TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_gaudit ON giveaway_audit(giveaway_id, id);
`);
// ---------- v5 ----------
db.exec(`
CREATE TABLE IF NOT EXISTS channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  logo TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  link_url TEXT NOT NULL DEFAULT '',
  link_label TEXT NOT NULL DEFAULT '',
  tier TEXT NOT NULL DEFAULT 'basic',
  business_type TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS channel_follows (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, channel_id)
);
CREATE TABLE IF NOT EXISTS giveaway_entries (
  giveaway_id INTEGER NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at INTEGER NOT NULL,
  left_at INTEGER,
  PRIMARY KEY (giveaway_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_gentries_user ON giveaway_entries(user_id, left_at);
CREATE TABLE IF NOT EXISTS link_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  ref_id INTEGER NOT NULL,
  placement TEXT NOT NULL DEFAULT '',
  user_id INTEGER,
  ip_hash TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clicks ON link_clicks(kind, ref_id);
CREATE TABLE IF NOT EXISTS points_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, reason, ref)
);
CREATE INDEX IF NOT EXISTS idx_points_user ON points_ledger(user_id);
CREATE TABLE IF NOT EXISTS user_items (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  acquired_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, item_id)
);
CREATE TABLE IF NOT EXISTS badge_grants (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL,
  granted_by TEXT NOT NULL DEFAULT 'admin',
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, badge_id)
);
CREATE TABLE IF NOT EXISTS badge_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT NOT NULL DEFAULT '',
  badge_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'admin',
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_user INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  target_score INTEGER NOT NULL,
  from_run_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  responded_at INTEGER,
  expires_at INTEGER NOT NULL,
  result_run_id INTEGER,
  result_score INTEGER,
  winner_id INTEGER
);
CREATE INDEX IF NOT EXISTS idx_chal_to ON challenges(to_user, status);
CREATE INDEX IF NOT EXISTS idx_chal_from ON challenges(from_user, status);
CREATE TABLE IF NOT EXISTS run_flags (
  run_id INTEGER PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  game_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  reasons TEXT NOT NULL,
  severity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL,
  reviewed_by TEXT,
  reviewed_at INTEGER,
  note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_flags_status ON run_flags(status, created_at);
`);
addCol('giveaways', 'channel_id', 'INTEGER');
addCol('giveaways', 'require_join', 'INTEGER NOT NULL DEFAULT 0');
addCol('giveaways', 'elig_min_runs7', 'INTEGER NOT NULL DEFAULT 0');
addCol('giveaways', 'elig_min_xp7', 'INTEGER NOT NULL DEFAULT 0');
addCol('giveaways', 'elig_account_age_days', 'INTEGER NOT NULL DEFAULT 0');
addCol('giveaways', 'elig_max_active', 'INTEGER NOT NULL DEFAULT 0');
addCol('giveaways', 'elig_win_cooldown_days', 'INTEGER NOT NULL DEFAULT 0');
addCol('giveaways', 'elig_brand_month', 'INTEGER NOT NULL DEFAULT 0');
addCol('giveaways', 'elig_followers_only', 'INTEGER NOT NULL DEFAULT 0');
addCol('giveaways', 'weight_mode', "TEXT NOT NULL DEFAULT ''");
addCol('giveaways', 'link_url', "TEXT NOT NULL DEFAULT ''");
addCol('giveaways', 'link_label', "TEXT NOT NULL DEFAULT ''");
addCol('users', 'potato', "TEXT NOT NULL DEFAULT ''");
addCol('users', 'eq_color', "TEXT NOT NULL DEFAULT ''");
addCol('users', 'eq_effect', "TEXT NOT NULL DEFAULT ''");
addCol('runs', 'seed', "TEXT NOT NULL DEFAULT ''");
addCol('runs', 'verify', "TEXT NOT NULL DEFAULT ''");
addCol('runs', 'held', 'INTEGER NOT NULL DEFAULT 0');
addCol('run_tokens', 'seed', "TEXT NOT NULL DEFAULT ''");
db.exec('CREATE INDEX IF NOT EXISTS idx_runs_held ON runs(held) WHERE held<>0');
addCol('giveaway_results', 'weight', 'INTEGER');
addCol('users', 'shadow_banned', 'INTEGER NOT NULL DEFAULT 0'); // v7 admin: hidden from leaderboards + giveaway standings (src/admin-users.js)
// Potato username for winner contact: backfill from the hub username where it is a valid Potato handle
db.prepare("UPDATE users SET potato=username WHERE potato='' AND username NOT GLOB '*[^A-Za-z0-9_]*' AND length(username) >= 3").run();
// every pre-v2 giveaway keeps its single linked game
db.exec('INSERT OR IGNORE INTO giveaway_games (giveaway_id, game_id) SELECT id, game_id FROM giveaways');

// periodic maintenance: checkpoint + truncate the WAL, refresh planner stats
const maint = setInterval(() => { try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) { console.error('[db] checkpoint', e.message); } }, 10 * 60e3); maint.unref();
// Disk budget: run tokens only matter until they are submitted or expire (RUN_TOKEN_TTL_MS = 2 h). Accepted and never-used
// tokens older than RUN_TOKEN_KEEP_DAYS (default 3; 0 = keep forever) are deleted; rejected ones are kept for the admin
// anti-cheat review. Replaying such an old token now gets "Unknown run." instead of "already submitted"/"expired".
const TOKEN_KEEP_MS = Math.max(0, Number(process.env.RUN_TOKEN_KEEP_DAYS ?? 3)) * 864e5;
function pruneTokens() {
  if (!TOKEN_KEEP_MS) return 0;
  try { return db.prepare("DELETE FROM run_tokens WHERE started_at < ? AND (status IS NULL OR status = 'accepted')").run(Date.now() - TOKEN_KEEP_MS).changes; }
  catch (e) { console.error('[db] prune run_tokens', e.message); return 0; }
}
const opt = setInterval(() => { pruneTokens(); try { db.pragma('optimize'); } catch {} }, 6 * 3600e3); opt.unref();
setTimeout(pruneTokens, 60e3).unref();
db.pruneTokens = pruneTokens;

module.exports = db;
