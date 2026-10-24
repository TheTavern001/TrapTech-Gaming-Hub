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
// Never hash with undefined before reporting missing required secrets.
const seedSecret = SESSION_SECRET || RUN_SECRET;
const IP_SALT = process.env.IP_SALT || derive('ip-salt') || (seedSecret ? crypto.createHmac('sha256', seedSecret).update('ip-salt').digest('base64url') : undefined);
const missing = [];
if (!process.env.ADMIN_PASSWORD) missing.push('ADMIN_PASSWORD');
if (!SESSION_SECRET || !RUN_SECRET) missing.push('SECRET (or SESSION_SECRET + RUN_SECRET)');
if (missing.length) { console.error(`Missing required environment variable(s): ${missing.join(', ')}. Set them in the host's env settings (or .env for local dev).`); process.exit(1); }
if (process.env.NODE_ENV === 'production' && process.env.ADMIN_PASSWORD.length < 10) console.warn('WARNING: ADMIN_PASSWORD is shorter than 10 characters - use a long random password in production.');

// SQLite location: DB_PATH (full file path) > DATA_DIR/hub.db > ./data/hub.db
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');

// Game catalog. Every game is playable and scored through the same signed run-token flow.
// v7: every game is ENDLESS (a run lasts until the player fails) and no score has a hard cap. Anti-cheat therefore uses
// per-second RATE limits against SERVER-measured run time instead of fixed caps (src/anticheat.js, src/results.js):
//   normal ceiling  score <= perSec * t + ramp * t^2 / 2 + grace      (t = server-measured seconds)
//   hard reject     score >  2 x that ceiling                         (physically impossible)
//   ramp > 0 only for games whose honest scoring rate rises over a run (bigger waves / table limits).
//   max = MAX_SCORE (a sanity bound far above any real run, not a game cap). coins <= 2 * coinsPerSec * t + 20.
// Rates and tiers are derived from tools/score-sim.js (docs/score-ranges.json).
// tiers = Bronze / Silver / Gold score thresholds used by the achievement system.
const MAX_SCORE = 1_000_000_000_000; // sanity bound only (1e12); endless runs have no game cap
const GAMES = [
  { id: 'jetpack-dash', title: 'Jetpack Dash', category: 'Arcade', tags: ['Arcade', 'High Score', '1-Player'], playable: true, unit: 'pts', module: 'jetpack.js', cls: 'JetpackDash',
    art: '/assets/cards/v5/jetpack-dash.webp', artTall: '/assets/cards/v5/jetpack-dash-tall.webp',
    desc: 'Jetpack through a research lab, dodge zappers, missiles and lasers, build your multiplier and chase a six-figure score.',
    howto: 'Hold anywhere (or Space) to fire your jetpack and rise; let go to fall. Dodge zappers (some rotate), missiles (a red ! shows their height before they fly in) and charging lasers. Fly 250 m without a hit to raise your multiplier, up to x10. Grab coin trails, pass zappers closely for bonus points, and pick up a shield to survive one hit.',
    scoring: 'Score = 625 x multiplier for every 25 m flown + 25 x multiplier per coin + 250 x multiplier per close call. The multiplier rises by 1 every 250 m without a hit (max x10) and drops by 3 when a shield breaks.',
    ac: { perSec: 15000, ramp: 0, grace: 10000, max: MAX_SCORE, coinsPerSec: 12 }, tiers: [12000, 150000, 600000] },
  { id: 'drift-rush', title: 'Drift Rush', category: 'Racing', tags: ['Racing', 'Endless'], playable: true, unit: 'pts', module: 'games/drift-rush.js', cls: 'DriftRush',
    art: '/assets/cards/v5/drift-rush.webp', artTall: '/assets/cards/v5/drift-rush-tall.webp',
    desc: 'Weave through highway traffic at golden hour, slide through sharp bends and bank big drift and near-miss combos.',
    howto: 'Hold the left or right side of the screen to steer (arrow keys or A/D on a keyboard); the further from the centre you hold, the harder you turn. Slide through bends to build drift points, then straighten up to bank them. Passing traffic closely scores a near-miss bonus and raises your multiplier (up to x3). Grab blue nitro canisters for a speed boost. Crashing into traffic, cones or barrels costs one of 3 hearts and drops the points you were holding; oil makes you skid and running wide slows you down. Chevron signs warn you before sharp bends. Every 1,500 m checkpoint repairs a heart. Change the camera view in Settings.',
    scoring: 'Score = meters driven + banked drift and near-miss points (multiplier up to x3). The run ends when your last heart is gone.',
    ac: { perSec: 240, ramp: 0, grace: 200, max: MAX_SCORE, coinsPerSec: 4 }, tiers: [1300, 3750, 6000] },
  { id: 'plinko', title: 'Plinko', category: 'Casual', tags: ['Casual', 'Skill Drop'], playable: true, unit: 'pts', module: 'games/plinko.js', cls: 'Plinko',
    art: '/assets/cards/v5/plinko.webp', artTall: '/assets/cards/v5/plinko-tall.webp',
    desc: 'Aim your drop, nudge the chip and hit the big slots to earn more chips. How long can you keep dropping?',
    howto: 'You get 10 free chips per run. Drag along the top to aim and release to drop. While a chip falls, tap left or right of it to nudge it (3 nudges per chip). Golden pegs multiply that chip\'s points (x2, then x4).',
    scoring: 'Score = slot points x golden-peg multiplier for every chip, with no limit on chips. Points only, nothing to buy.',
    ac: { perSec: 700, ramp: 0, grace: 900, max: MAX_SCORE, coinsPerSec: 2 }, tiers: [830, 4100, 6450] },
  { id: 'spin-to-win', title: 'Spin to Win', category: 'Casino', tags: ['Casino', 'Timing'], playable: true, unit: 'pts', module: 'games/spin-to-win.js', cls: 'SpinToWin',
    art: '/assets/cards/v5/spin-to-win.webp', artTall: '/assets/cards/v5/spin-to-win-tall.webp',
    desc: 'Charge the power meter and stop the wheel on the jackpot. Timing beats luck, and the wheel never stops.',
    howto: 'Hold to charge the power meter and release to spin. The wheel always travels the same distance for the same power, so read the wheel and time your release. You have 3 lives: landing on BUST costs one. BONUS gives a life back (max 5) and x2 doubles your next spin. Every 5 spins the wheel reshuffles, the meter gets faster and another BUST wedge appears. Spin until your lives run out.',
    scoring: 'Score = total points from all your spins. No spin limit. Points only, no real money.',
    ac: { perSec: 700, ramp: 0, grace: 2000, max: MAX_SCORE, coinsPerSec: 1 }, tiers: [4100, 14050, 19150] },
  { id: 'memory-match', title: 'Memory Match', category: 'Puzzle', tags: ['Puzzle', 'Memory'], playable: true, unit: 'pts', module: 'games/memory-match.js', cls: 'MemoryMatch',
    art: '/assets/cards/v5/memory-match.webp', artTall: '/assets/cards/v5/memory-match-tall.webp', desc: 'Flip cards, find pairs, beat the board clock. Endless boards, each one with less time.',
    howto: 'Memorize the cards, then tap two at a time to find pairs. Every board has its own clock, and each new board gives you a little less time per pair. Chain matches without a miss to raise your combo (up to x5). Clear the board before its clock runs out to deal the next one; if the clock hits zero the run ends. Boards never run out.',
    scoring: 'Score = 100 x combo per pair + 10 per second left on the board clock + 50 x board number per clear. Replay-verified on the server.',
    ac: { perSec: 1100, ramp: 0, grace: 500, max: MAX_SCORE, coinsPerSec: 2 }, tiers: [2650, 62150, 110800] },
  { id: 'high-score', title: 'High Score', category: 'Arcade', tags: ['Arcade', 'Reflex'], playable: true, unit: 'pts', module: 'games/high-score.js', cls: 'HighScore',
    art: '/assets/cards/v5/high-score.webp', artTall: '/assets/cards/v5/high-score-tall.webp', desc: 'A quick-fire neon reflex challenge built for leaderboard bragging rights.',
    howto: 'Tap the glowing targets before they shrink away. Hit dead center for bonus points, gold targets are worth double, and never tap the red bombs. Missing a target or hitting a bomb costs a life (3 lives, a heart every 100 hits). Targets keep getting smaller, faster and more numerous for as long as you last.',
    scoring: 'Score = (10 + up to 15 accuracy bonus) x combo multiplier (up to x5) per target.',
    ac: { perSec: 1100, ramp: 0, grace: 300, max: MAX_SCORE, coinsPerSec: 4 }, tiers: [780, 11300, 18200] },
  { id: 'blazed-roulette', title: 'Blazed Roulette', category: 'Casino', tags: ['Casino', 'Featured'], featured: true, playable: true, unit: 'chips', module: 'games/blazed-roulette.js', cls: 'BlazedRoulette',
    art: '/assets/cards/v5/blazed-roulette.webp', artTall: '/assets/cards/v5/blazed-roulette-tall.webp', desc: 'Play roulette inside a lush grow room. Time the ball drop, beat the rising table minimum and keep your stack alive.',
    howto: 'Every run starts with 1,000 free practice chips and no spin limit. Pick a chip size and tap bets, then tap DROP when the glowing landing zone covers the pockets you want: the ball lands inside that zone. The table minimum and maximum rise every spin and the landing zone slowly widens. The run ends when your chips can no longer cover the table minimum.',
    scoring: 'Score = total chips won on winning spins (your winnings, not your stack). Chips are points only and have no cash value.',
    ac: { perSec: 300, ramp: 40, grace: 1500, max: MAX_SCORE, coinsPerSec: 1 }, tiers: [3350, 49750, 765100] },
  { id: 'terp-tapper', title: 'Terp Tapper', category: 'Arcade', tags: ['Arcade', 'Rhythm', 'Featured'], featured: true, playable: true, unit: 'pts', module: 'games/terp-tapper.js', cls: 'TerpTapper',
    art: '/assets/cards/v5/terp-tapper.webp', artTall: '/assets/cards/v5/terp-tapper-tall.webp', desc: 'Tap fast, combo harder, top the board. A four-lane neon rhythm tapper.',
    howto: 'Orbs fall down four lanes. Tap the lane (or press D F J K / arrow keys) as each orb crosses the line. Perfect timing scores the most, and every 10-hit combo raises your multiplier (up to x4). Missing an orb costs one of your 5 lives (a 100-hit combo heals one). The tempo keeps rising and chords get denser for as long as you survive.',
    scoring: 'Score = 100 perfect / 60 great / 30 good x combo multiplier per orb.',
    ac: { perSec: 4000, ramp: 0, grace: 500, max: MAX_SCORE, coinsPerSec: 2 }, tiers: [10300, 94000, 334550] },
  // v5 additions
  { id: 'munchies-snake', title: 'Neon Munchies', category: 'Arcade', tags: ['Arcade', 'Endless', 'Multiplayer-style', 'New'], playable: true, unit: 'pts', module: 'games/munchies-snake.js', cls: 'MunchiesSnake',
    art: '/assets/cards/v5/munchies-snake.webp', artTall: '/assets/cards/v5/munchies-snake-tall.webp', desc: 'An infinite neon snake arena. Eat, grow huge, and cut off the rival snakes to steal their glow.',
    howto: 'Drag anywhere (or use the arrow keys) to steer: the snake follows your finger. Hold a second finger or Space to boost (boosting burns a little length). Eat glowing pellets and snacks to grow. If a rival snake\'s head hits your body it bursts into food for you, but if your head hits a rival or the arena wall, the run ends. There is no win state: rivals keep coming and keep getting bigger.',
    scoring: 'Score = 10 per pellet, 50 per snack, 250 per golden brownie, 20 per orb dropped by a rival you cut off. No cap.',
    ac: { perSec: 400, ramp: 0, grace: 1000, max: MAX_SCORE, coinsPerSec: 1 }, tiers: [220, 5550, 11600] },
  { id: 'brick-breaker', title: 'Brick Breaker', category: 'Arcade', tags: ['Arcade', 'Classic', 'Endless'], playable: true, unit: 'pts', module: 'games/brick-breaker.js', cls: 'BrickBreaker',
    art: '/assets/cards/v5/brick-breaker.webp', artTall: '/assets/cards/v5/brick-breaker-tall.webp', desc: 'An endless wall of glass bricks keeps sliding down. Smash it back before it reaches your paddle.',
    howto: 'Drag (or use the arrow keys) to move the paddle and tap to launch. Where the ball hits the paddle sets its angle. The wall never ends: a new procedural row slides in from the top every few seconds and the whole wall creeps down. Steel bricks take 2 hits, gold bricks are worth 5x, and capsules drop multiball, wide paddle and laser power-ups. If the wall reaches the red line, or you lose all your balls, the run ends.',
    scoring: 'Score = 10 per brick (50 for gold, 20 for steel) x wave bonus (+20% every 10 rows, up to x5) x chain bonus (up to x4). No cap.',
    ac: { perSec: 1200, ramp: 0, grace: 1500, max: MAX_SCORE, coinsPerSec: 2 }, tiers: [1150, 14850, 51650] },
  { id: 'sky-hopper', title: 'Sky Hopper', category: 'Arcade', tags: ['Arcade', 'One-Tap', 'New'], playable: true, unit: 'pts', module: 'games/sky-hopper.js', cls: 'SkyHopper',
    art: '/assets/cards/v5/sky-hopper.webp', artTall: '/assets/cards/v5/sky-hopper-tall.webp', desc: 'One-tap flyer over the night city. Thread the gaps between the towers.',
    howto: 'Tap (or press Space) to boost up; stop tapping to fall. Fly through the gaps between the towers. The gaps get tighter, the speed rises and later gaps start to slide up and down. One hit ends the run.',
    scoring: 'Score = towers passed. Coins in the gaps count toward your coin total.',
    ac: { perSec: 1.6, ramp: 0, grace: 5, max: MAX_SCORE, coinsPerSec: 1.5 }, tiers: [5, 59, 130] },
  // v7 additions (all endless)
  { id: 'void-swarm', title: 'Void Swarm', category: 'Arcade', tags: ['Arcade', 'Shooter', 'Endless', 'New'], playable: true, unit: 'pts', module: 'games/void-swarm.js', cls: 'VoidSwarm',
    art: '/assets/cards/v7/void-swarm.svg', artTall: '/assets/cards/v7/void-swarm-tall.svg', desc: 'Endless space shooter. Alien drone swarms fly in formation and dive at you. Blast them, grab power-ups, survive.',
    howto: 'Drag anywhere to fly your fighter (it fires automatically). Drone swarms fly into formation, then peel off and dive at you. Shoot divers for double points. Capsules give a spread shot, rapid fire, a shield or an extra life. Every 5th wave a mothership arrives. You have 3 lives; the waves never end and get faster and meaner.',
    scoring: 'Score = 50 / 80 / 150 per drone type (x2 while diving) x wave bonus (+10% per wave, up to x5) + 2,000 per mothership + 100 x wave for each wave cleared. No cap.',
    ac: { perSec: 700, ramp: 10, grace: 3000, max: MAX_SCORE, coinsPerSec: 1.5 }, tiers: [17650, 238750, 632750] },
  { id: 'stack', title: 'Stack', category: 'Arcade', tags: ['Arcade', 'One-Tap', 'Timing', 'New'], playable: true, unit: 'pts', module: 'games/stack.js', cls: 'Stack',
    art: '/assets/cards/v7/stack.svg', artTall: '/assets/cards/v7/stack-tall.svg', desc: 'Drop sliding glass slabs onto the tower. Nail perfect drops and climb forever.',
    howto: 'A slab slides across the top of the tower. Tap (or press Space) to drop it. Whatever hangs over the edge is sliced off, so the next slab is smaller. Land 3 perfect drops in a row and the slab grows back. The slabs speed up as the tower climbs. Miss the tower completely and the run ends.',
    scoring: 'Score = 10 per slab + a perfect bonus of 10 x your perfect streak (up to +100). No cap: the tower never ends.',
    ac: { perSec: 300, ramp: 0, grace: 200, max: MAX_SCORE, coinsPerSec: 1.5 }, tiers: [210, 2250, 5600] },
  { id: 'grow-guard', title: 'Grow Guard', category: 'Strategy', tags: ['Strategy', 'Lane Defense', 'Endless', 'New'], playable: true, unit: 'pts', module: 'games/grow-guard.js', cls: 'GrowGuard',
    art: '/assets/cards/v7/grow-guard.svg', artTall: '/assets/cards/v7/grow-guard-tall.svg', desc: 'Defend your grow room from endless waves of pests with bug-fighting gadgets.',
    howto: 'Pests crawl in from the right along 5 rows. Collect falling light drops (tap them), then tap a gadget card and tap a tile to place it: Ladybug Launchers shoot, Sticky Traps block, Neem Misters slow a whole row, UV Zappers hit hard and Solar Panels make extra light. A pest that reaches the plants on the left costs a plant; lose all 3 plants and the run ends. Waves never stop and get bigger and tougher.',
    scoring: 'Score = points per pest (aphid 10, mite 15, gnat 20, caterpillar 30, beetle 60) + 100 x wave number for every wave you clear.',
    ac: { perSec: 140, ramp: 1.2, grace: 600, max: MAX_SCORE, coinsPerSec: 1 }, tiers: [7950, 42650, 63050] },
  { id: 'sling-smash', title: 'Sling Smash', category: 'Physics', tags: ['Physics', 'Slingshot', 'Endless', 'New'], playable: true, unit: 'pts', module: 'games/sling-smash.js', cls: 'SlingSmash',
    art: '/assets/cards/v7/sling-smash.svg', artTall: '/assets/cards/v7/sling-smash-tall.svg', desc: 'Pull back the slingshot and topple towers of wood, glass and stone to knock out the Glitch Bots.',
    howto: 'Drag back from the slingshot to aim (the dotted arc shows the first part of the flight) and let go to fire a steel ball. Knock out every Glitch Bot in the tower to clear it. Each cleared tower refunds a ball plus one for every ball you did not need. Towers get taller, stronger and windier forever. Run out of balls with bots still standing and the run ends.',
    scoring: 'Score = 500 per Glitch Bot, 10 per wood / 20 per glass / 40 per stone block destroyed, + 1,000 per tower cleared x tower number bonus (up to x5) for unused balls.',
    ac: { perSec: 1500, ramp: 0, grace: 3000, max: MAX_SCORE, coinsPerSec: 1 }, tiers: [1750, 27400, 51400] },
  { id: 'haze-defense', title: 'Haze Defense', category: 'Strategy', tags: ['Strategy', 'Tower Defense', 'Endless', 'New'], playable: true, unit: 'pts', module: 'games/haze-defense.js', cls: 'HazeDefense',
    art: '/assets/cards/v7/haze-defense.svg', artTall: '/assets/cards/v7/haze-defense-tall.svg', desc: 'Build neon turrets along the track and pop the drifting smoke orbs before they slip through.',
    howto: 'Smoke orbs drift along the glowing track. Tap a gadget at the bottom, then tap an empty pad beside the track to build it: Dart Coils shoot fast, Fan Blasters push and pop groups, Prism Lasers burn through layers and Frost Misters slow everything near them. Tap a built turret to upgrade it. Big orbs split into smaller ones when popped. Each orb that escapes costs lives; at 0 lives the run ends. Waves never stop.',
    scoring: 'Score = 1 per layer popped (x wave tier) + 50 x wave number for every wave cleared. Cash is separate and only buys turrets.',
    ac: { perSec: 160, ramp: 1.4, grace: 600, max: MAX_SCORE, coinsPerSec: 1 }, tiers: [6950, 42800, 67800] },
];
// v7: retired games. Not in the catalog, can't be started or linked, but old runs/challenges still resolve a title and
// their final board is archived (src/games-v7.js -> leaderboard_archive, GET /api/games/archive/:id).
const RETIRED = [
  // 2026-10-24: Jetpack Dash moved from meters to points (v9). Meter-scored runs were moved to this id and archived.
  { id: 'jetpack-dash-m', title: 'Jetpack Dash (classic, meters)', retired: true, playable: false, replacedBy: 'jetpack-dash', unit: 'm', art: '/assets/cards/v5/jetpack-dash.webp', ac: { perSec: 30, ramp: 0, grace: 25, max: 10_000_000, coinsPerSec: 12 }, tiers: [440, 3400, 5050] },
  { id: 'stack-2048', title: 'Stack 2048 (retired)', retired: true, playable: false, replacedBy: 'stack', unit: 'pts', art: '/assets/cards/v7/stack.svg', ac: { perSec: 150, ramp: 0, grace: 400, max: 10_000_000, coinsPerSec: 1 }, tiers: [2500, 8000, 20000] },
];
// v7 (item 21): pure-chance games stay playable "just for fun" but can never be linked to (or count for) a giveaway.
// Every giveaway-eligible game is skill-based, endless and uncapped.
// Reese, Oct 10 2026: EVERY game must be giveaway-eligible (100%). The three pure-chance games (Plinko, Spin to Win,
// Blazed Roulette) are retired from the catalog: their boards are archived (src/games-v7.js), old runs/challenges keep
// resolving a title, and open giveaways/tournaments linked to them move to Stack. Skill rebuilds can return later as new games.
const CHANCE_RETIRED = ['plinko', 'spin-to-win', 'blazed-roulette'];
for (const id of CHANCE_RETIRED) { const i = GAMES.findIndex(g => g.id === id); if (i >= 0) { const [g] = GAMES.splice(i, 1); RETIRED.push({ ...g, title: g.title + ' (retired)', retired: true, playable: false, replacedBy: 'stack' }); } }
const JUST_FOR_FUN = new Set(); // no just-for-fun games any more
// v7 anti-cheat level per game (src/ac-levels.js, docs/ANTI-CHEAT.md). Every game gets L1 + L2; L3 = event log checked
// against the game rules; L4 = the server re-simulates the run from the seed + input log and computes the real score.
const AC_LEVEL = { 'sky-hopper': 2, stack: 4, 'memory-match': 4 }; // everything else: 3
for (const g of GAMES) if (!g.retired) g.acLevel = AC_LEVEL[g.id] || 3;
for (const g of GAMES) g.giveaway = !JUST_FOR_FUN.has(g.id);

// [games-lib hook] library games (src/games-lib.js) join run/score/leaderboard lookups only, not the core catalog list
const LIB_GAMES = require('./games-lib').games;

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
  GAME_MAP: Object.fromEntries([...GAMES, ...LIB_GAMES].map(g => [g.id, g])), LIB_GAMES, // [games-lib hook]
  RETIRED, MAX_SCORE, JUST_FOR_FUN,
  giveawayEligible: (id) => !!([...GAMES, ...LIB_GAMES].find(g => g.id === id) || {}).giveaway, // [games-lib hook]
  // any game id ever used, including retired ones (titles/caps for historical runs)
  gameInfo: (id) => GAMES.find(g => g.id === id) || RETIRED.find(g => g.id === id) || LIB_GAMES.find(g => g.id === id) || null, // [games-lib hook]
  // Day boundaries for "days played" streak achievements
  TZ: process.env.HUB_TZ || 'America/New_York',
  // v7: endless runs can be long, so a run token stays valid for 12 h (was 2 h)
  RUN_TOKEN_TTL_MS: 12 * 60 * 60 * 1000,
  // v7: per-second rate ceiling for a run of t server-measured seconds (see the catalog comment above)
  capOf: (ac, t) => Math.min(ac.max, Math.floor(ac.perSec * t + 0.5 * (ac.ramp || 0) * t * t + ac.grace)),
  hardCapOf: (ac, t) => Math.min(ac.max, Math.floor(2 * (ac.perSec * t + 0.5 * (ac.ramp || 0) * t * t) + ac.grace * 2)),
  SESSION_TTL_MS: 30 * 24 * 60 * 60 * 1000,
};
