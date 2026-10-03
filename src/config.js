'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// Minimal .env loader (no dependency)
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
loadEnv(path.join(ROOT, '.env'));

// Secrets come from environment variables (a local .env file is only a convenience for development).
// In production you can set a single SECRET and the individual secrets are derived from it, or set
// SESSION_SECRET / RUN_SECRET / IP_SALT individually (individual values win).
const crypto = require('crypto');
const derive = (label) => process.env.SECRET ? crypto.createHmac('sha256', process.env.SECRET).update(label).digest('base64url') : undefined;
const SESSION_SECRET = process.env.SESSION_SECRET || derive('session');
const RUN_SECRET = process.env.RUN_SECRET || derive('run-token');
const IP_SALT = process.env.IP_SALT || derive('ip-salt') || 'salt';
const missing = [];
if (!process.env.ADMIN_PASSWORD) missing.push('ADMIN_PASSWORD');
if (!SESSION_SECRET || !RUN_SECRET) missing.push('SECRET (or SESSION_SECRET + RUN_SECRET)');
if (missing.length) { console.error(`Missing required environment variable(s): ${missing.join(', ')}. Set them in the host's env settings (or .env for local dev).`); process.exit(1); }
if (process.env.NODE_ENV === 'production' && process.env.ADMIN_PASSWORD.length < 10) console.warn('WARNING: ADMIN_PASSWORD is shorter than 10 characters - use a long random password in production.');

// SQLite location: DB_PATH (full file path) > DATA_DIR/hub.db > ./data/hub.db
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');

const GAMES = [
  { id: 'jetpack-dash', title: 'Jetpack Dash', category: 'Arcade', tags: ['Arcade', 'High Score', '1-Player'], playable: true,
    art: '/assets/cards/jetpack-dash.webp', artTall: '/assets/cards/jetpack-dash-tall.webp',
    desc: 'Fly as far as you can, dodge zappers, saws and rockets, collect coins and beat your high score!' },
  { id: 'drift-rush', title: 'Drift Rush', category: 'Racing', tags: ['Racing', 'Time Trial'], playable: false,
    art: '/assets/cards/drift-rush.webp', artTall: '/assets/cards/drift-rush-tall.webp', desc: 'Slide through neon corners and chase the perfect drift line.' },
  { id: 'plinko', title: 'Plinko', category: 'Casual', tags: ['Casual', 'Luck'], playable: false,
    art: '/assets/cards/plinko.webp', artTall: '/assets/cards/plinko-tall.webp', desc: 'Drop the chip, bounce the pegs, hit the jackpot slot.' },
  { id: 'spin-to-win', title: 'Spin to Win', category: 'Casino', tags: ['Casino', 'Luck'], playable: false,
    art: '/assets/cards/spin-to-win.webp', artTall: '/assets/cards/spin-to-win-tall.webp', desc: 'Spin the prize wheel for bonus entries and rewards.' },
  { id: 'memory-match', title: 'Memory Match', category: 'Puzzle', tags: ['Puzzle', 'Memory'], playable: false,
    art: '/assets/cards/memory-match.webp', desc: 'Flip cards, find pairs, beat the clock.' },
  { id: 'high-score', title: 'High Score', category: 'Arcade', tags: ['Arcade'], playable: false,
    art: '/assets/cards/high-score.webp', desc: 'A quick-fire arcade challenge built for leaderboard bragging rights.' },
  { id: 'blazed-roulette', title: 'Blazed Roulette', category: 'Casino', tags: ['Casino', 'Featured'], featured: true, playable: false,
    art: '/assets/cards/blazed-roulette.webp', desc: 'Place your chips and let the wheel decide.' },
  { id: 'terp-tapper', title: 'Terp Tapper', category: 'Arcade', tags: ['Arcade', 'Featured'], featured: true, playable: false,
    art: '/assets/cards/terp-tapper.webp', desc: 'Tap fast, combo harder, top the board.' },
];

module.exports = {
  ROOT,
  PORT: parseInt(process.env.PORT || '8787', 10),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  SESSION_SECRET,
  RUN_SECRET,
  IP_SALT,
  DATA_DIR,
  DB_PATH: process.env.DB_PATH || path.join(DATA_DIR, 'hub.db'),
  GAMES,
  GAME_MAP: Object.fromEntries(GAMES.map(g => [g.id, g])),
  // Anti-cheat: the game's top speed is 24 m/s; allow 30 m/s of server-measured elapsed time + grace.
  MAX_METERS_PER_SEC: 30,
  SCORE_GRACE: 25,
  MAX_COINS_PER_SEC: 12,
  RUN_TOKEN_TTL_MS: 2 * 60 * 60 * 1000,
  SESSION_TTL_MS: 30 * 24 * 60 * 60 * 1000,
};
