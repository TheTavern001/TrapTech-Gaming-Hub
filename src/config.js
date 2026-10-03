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

// Game catalog. Every game is playable and scored through the same signed run-token flow.
// ac = per-game anti-cheat plausibility caps, checked against SERVER-measured run time:
//   score <= perSec * elapsedSeconds + grace   and   score <= max (absolute cap for runs with a fixed number of drops/spins)
//   coins <= coinsPerSec * elapsedSeconds + 10
// tiers = Bronze / Silver / Gold score thresholds used by the achievement system.
const GAMES = [
  { id: 'jetpack-dash', title: 'Jetpack Dash', category: 'Arcade', tags: ['Arcade', 'High Score', '1-Player'], playable: true, unit: 'm', module: 'jetpack.js', cls: 'JetpackDash',
    art: '/assets/cards/jetpack-dash.webp', artTall: '/assets/cards/jetpack-dash-tall.webp',
    desc: 'Fly as far as you can, dodge zappers, saws and rockets, collect coins and beat your high score!',
    howto: 'Hold the screen, mouse button or Space to fire your jetpack; let go to drop. Dodge zappers, buzz saws and rockets (watch for the ! warning). Grab shields to survive one hit.',
    scoring: 'Score = meters flown in one run.',
    ac: { perSec: 30, grace: 25, max: 10_000_000, coinsPerSec: 12 }, tiers: [500, 1500, 3000] },
  { id: 'drift-rush', title: 'Drift Rush', category: 'Racing', tags: ['Racing', 'Time Trial'], playable: true, unit: 'pts', module: 'games/drift-rush.js', cls: 'DriftRush',
    art: '/assets/cards/drift-rush.webp', artTall: '/assets/cards/drift-rush-tall.webp',
    desc: 'Slide through neon corners and chase the perfect drift line before the clock runs out.',
    howto: 'Hold the left or right side of the screen (or arrow keys / A-D) to steer. Slide hard to start a drift and build a combo; bank it by straightening out. Leaving the road or hitting a cone loses the drift you were holding. Cross checkpoints for extra time; grab nitro orbs for a burst of speed.',
    scoring: 'Score = meters driven + banked drift points. The run ends when the timer hits zero.',
    ac: { perSec: 240, grace: 200, max: 10_000_000, coinsPerSec: 4 }, tiers: [2500, 6000, 11000] },
  { id: 'plinko', title: 'Plinko', category: 'Casual', tags: ['Casual', 'Skill Drop'], playable: true, unit: 'pts', module: 'games/plinko.js', cls: 'Plinko',
    art: '/assets/cards/plinko.webp', artTall: '/assets/cards/plinko-tall.webp',
    desc: 'Aim your drop, nudge the chip through the pegs and steer it into the big slots.',
    howto: 'You get 10 free chips per run. Drag along the top to aim and release to drop. While a chip falls, tap left or right of it to nudge it (3 nudges per chip). Golden pegs multiply that chip\'s points (x2, then x4).',
    scoring: 'Score = sum of slot points x golden-peg multiplier for your 10 chips. Points only, nothing to buy.',
    ac: { perSec: 700, grace: 900, max: 8000, coinsPerSec: 2 }, tiers: [900, 2000, 3500] },
  { id: 'spin-to-win', title: 'Spin to Win', category: 'Casino', tags: ['Casino', 'Timing'], playable: true, unit: 'pts', module: 'games/spin-to-win.js', cls: 'SpinToWin',
    art: '/assets/cards/spin-to-win.webp', artTall: '/assets/cards/spin-to-win-tall.webp',
    desc: 'Charge the power meter and stop the wheel on the jackpot. Timing beats luck.',
    howto: 'You get 5 free spins per run. Hold to charge the power meter and release to spin. The wheel always travels the same distance for the same power, so learn the timing and aim for the big segments. x2 doubles your next spin, BONUS gives an extra spin (max 8 spins), BUST scores 0.',
    scoring: 'Score = total points from your spins. Points only, no real money.',
    ac: { perSec: 700, grace: 2000, max: 16000, coinsPerSec: 1 }, tiers: [1200, 3000, 6000] },
  { id: 'memory-match', title: 'Memory Match', category: 'Puzzle', tags: ['Puzzle', 'Memory'], playable: true, unit: 'pts', module: 'games/memory-match.js', cls: 'MemoryMatch',
    art: '/assets/cards/memory-match.webp', desc: 'Flip cards, find pairs, beat the clock. Chain matches for combo points.',
    howto: 'Tap two cards to flip them. Matching pairs stay open. Chain matches without a miss to raise your combo (up to x5). Clear the board to move to a bigger level and earn extra time.',
    scoring: 'Score = 100 x combo per pair + 10 per second left when you clear a level. The run ends when time runs out.',
    ac: { perSec: 1100, grace: 500, max: 10_000_000, coinsPerSec: 2 }, tiers: [2000, 5000, 9000] },
  { id: 'high-score', title: 'High Score', category: 'Arcade', tags: ['Arcade', 'Reflex'], playable: true, unit: 'pts', module: 'games/high-score.js', cls: 'HighScore',
    art: '/assets/cards/high-score.webp', desc: 'A quick-fire neon reflex challenge built for leaderboard bragging rights.',
    howto: 'Tap the glowing targets before they shrink away. Hit dead center for bonus points, gold targets are worth double, and never tap the red bombs. Missing a target or hitting a bomb costs a life (3 lives). Tapping empty space breaks your combo.',
    scoring: 'Score = (10 + up to 15 accuracy bonus) x combo multiplier (up to x5) per target.',
    ac: { perSec: 900, grace: 300, max: 10_000_000, coinsPerSec: 4 }, tiers: [1500, 4000, 8000] },
  { id: 'blazed-roulette', title: 'Blazed Roulette', category: 'Casino', tags: ['Casino', 'Featured'], featured: true, playable: true, unit: 'chips', module: 'games/blazed-roulette.js', cls: 'BlazedRoulette',
    art: '/assets/cards/blazed-roulette.webp', desc: 'Place your free chips, time the ball drop and grow your stack in 8 spins.',
    howto: 'Every run starts with 1,000 free practice chips and 8 spins. Pick a chip size and tap bets (up to 100 per spin, 10 max on green 0). Then tap DROP when the glowing landing zone covers the pockets you want: the ball lands inside that zone.',
    scoring: 'Score = chips left after 8 spins (or when you run out). Chips are points only and have no cash value.',
    ac: { perSec: 120, grace: 1000, max: 3800, coinsPerSec: 1 }, tiers: [1300, 1800, 2500] },
  { id: 'terp-tapper', title: 'Terp Tapper', category: 'Arcade', tags: ['Arcade', 'Rhythm', 'Featured'], featured: true, playable: true, unit: 'pts', module: 'games/terp-tapper.js', cls: 'TerpTapper',
    art: '/assets/cards/terp-tapper.webp', desc: 'Tap fast, combo harder, top the board. A four-lane neon rhythm tapper.',
    howto: 'Orbs fall down four lanes. Tap the lane (or press D F J K / arrow keys) as each orb crosses the line. Perfect timing scores the most, and every 10-hit combo raises your multiplier (up to x4). Missing an orb costs one of your 5 lives, and the tempo keeps rising.',
    scoring: 'Score = 100 perfect / 60 great / 30 good x combo multiplier per orb.',
    ac: { perSec: 3000, grace: 500, max: 10_000_000, coinsPerSec: 2 }, tiers: [3000, 9000, 20000] },
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
  // Day boundaries for "days played" streak achievements
  TZ: process.env.HUB_TZ || 'America/New_York',
  RUN_TOKEN_TTL_MS: 2 * 60 * 60 * 1000,
  SESSION_TTL_MS: 30 * 24 * 60 * 60 * 1000,
};
