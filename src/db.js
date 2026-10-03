'use strict';
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { DB_PATH } = require('./config');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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
// v3
addCol('users', 'ref_code', "TEXT");
addCol('users', 'referred_by', 'INTEGER');
addCol('users', 'birth_date', "TEXT NOT NULL DEFAULT ''");
addCol('users', 'notif_seen_at', 'INTEGER NOT NULL DEFAULT 0');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_ref ON users(ref_code)');
// every pre-v2 giveaway keeps its single linked game
db.exec('INSERT OR IGNORE INTO giveaway_games (giveaway_id, game_id) SELECT id, game_id FROM giveaways');

module.exports = db;
