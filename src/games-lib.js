'use strict';
// Games Library registry (The Gaming Hub). Static HTML5 games under public/games-lib/<slug>/, scored through the normal
// signed run flow (/api/run/start + /api/score) via public/games-lib/adapter.js. Hooked into src/config.js (GAME_MAP only,
// so the core catalog, achievements and boards of the main app are untouched) and src/server.js (GET /api/games-lib).
// Columns: slug, hub title, reference (INTERNAL ONLY, never shown to players), category, tier, competition, honest
// points/sec ceiling, giveaway eligible, scoring text, recommended event length, source key (see SOURCES).
const CATS = ['Endless Runners', 'Driving', 'Physics & Destruction', 'Tower Defense', 'Survival & Horde', 'Arcade Shooters', 'Puzzle & Brain', 'Reflex & Skill', 'Combat', 'Sports', 'Specialty', 'Cannabis'];
const SOURCES = {
  built: { kind: 'built', source: 'Original Hub build (public/games-lib/kit.js engine)', licence: 'MIT (Trap Tech Solutions), original code, synthesized WebAudio SFX, vector art' },
  trex: { kind: 'vendored', source: 'github.com/wayou/t-rex-runner (extracted from Chromium neterror resources)', licence: 'BSD-3-Clause (code + sprites + sounds, Chromium Authors); LICENSE kept' },
};
const T = (slug, title, ref, cat, tier, comp, rate, give, scoring, evlen, src) => ({ slug, title, ref, cat, tier, comp, rate, give, scoring, evlen, src: src || 'built' });
const LIST = [
  // ---- batch 1: A+ ----
  T('sky-flap', 'Neon Flapper', 'Flappy Bird', 0, 'A+', 'endless', 2, true, '1 point per gate passed', '3 days'),
  T('block-drop', 'Block Drop', 'Tetris', 6, 'A+', 'endless', 220, true, 'Lines 100/300/500/800 x level + soft drop', '3-7 days'),
  T('maze-muncher', 'Maze Muncher', 'Pac-Man', 10, 'A+', 'endless', 260, true, 'Dots 10, power 50, ghosts 200-1600, mazes repeat faster', '3-7 days'),
  T('alien-rows', 'Alien Rows', 'Space Invaders', 5, 'A+', 'endless', 140, true, 'Aliens 10-30, saucer 100-300, wave bonus', '3 days'),
  T('cloud-hopper', 'Cloud Hopper', 'Doodle Jump', 0, 'A+', 'endless', 60, true, 'Height climbed + pickups', '3 days'),
  T('road-hopper', 'Road Hopper', 'Crossy Road', 0, 'A+', 'endless', 8, true, '1 per furthest row + coins 5', '3 days'),
  T('dino-dash', 'Desert Dash', 'Chrome T-Rex Runner', 0, 'A+', 'endless', 25, true, 'Distance (Chromium meter)', '1-3 days', 'trex'),
  T('neon-snake', 'Neon Serpent', 'Snake', 10, 'A+', 'endless', 60, true, 'Food 10 x speed level, gold 50', '3 days'),
  T('brick-blitz', 'Brick Blitz', 'Breakout', 10, 'A+', 'endless', 260, true, 'Bricks 10-50 x combo, wall bonus', '3 days'),
  T('rock-buster', 'Rock Buster', 'Asteroids', 5, 'A+', 'endless', 180, true, 'Rocks 20/50/100, UFO 300', '3 days'),
  T('star-swarm', 'Star Swarm', 'Galaga', 5, 'A+', 'endless', 200, true, 'Bugs 50-160 (diving x2), stage bonus', '3 days'),
  T('rail-rush', 'Rail Rush', 'Subway Surfers', 0, 'A+', 'endless', 60, true, 'Distance + coins 10', '3 days'),
  T('ruin-runner', 'Ruin Runner', 'Temple Run 2', 0, 'A+', 'endless', 60, true, 'Distance + gems 10', '3 days'),
  T('hill-hauler', 'Hill Hauler', 'Hill Climb Racing', 1, 'A+', 'endless', 40, true, 'Distance in m + coins 5', '3 days'),
  T('wanted-run', 'Most Wanted Run', 'Smashy Road: Wanted 2', 1, 'A+', 'endless', 60, true, 'Survival time x heat + wrecked cops 50', '3 days'),
  T('sling-siege', 'Sling Siege', 'Angry Birds 2', 2, 'A+', 'campaign', 400, true, 'Blocks 10-50, targets 500, shots left 1000', '7 days'),
  T('lawn-guard', 'Lawn Guard', 'Plants vs. Zombies', 3, 'A+', 'strategy', 60, true, 'Zombies 10-50, wave bonus 100 x wave', '7 days'),
  T('pop-defense', 'Pop Defense', 'Bloons TD 6', 3, 'A+', 'strategy', 120, true, 'Layer pops 1, wave bonus 25 x wave', '7 days'),
  T('cube-horde', 'Cube Horde', 'Zombie Cubes', 4, 'A+', 'endless', 120, true, 'Kills 10-50 x combo, wave bonus', '3 days'),
  T('grid-wars', 'Grid Wars', 'Geometry Wars', 4, 'A+', 'endless', 400, true, 'Enemies 25-150 x multiplier', '3 days'),
  // ---- batch 2: A tier + Cannabis ----
  T('jet-blaster', 'Jet Blaster', 'Jetpack Joyride', 0, 'A', 'endless', 40, true, 'Distance m + coins 5', '3 days'),
  T('roof-runner', 'Roof Runner', 'Canabalt', 0, 'A', 'endless', 40, true, 'Distance m', '3 days'),
  T('helix-drop', 'Helix Drop', 'Helix Jump', 7, 'A', 'endless', 40, true, 'Floors passed with combo, fireball smashes', '3 days'),
  T('hex-spin', 'Hex Spin', 'Super Hexagon', 7, 'A', 'endless', 12, true, 'Survival time in 0.1s', '3 days'),
  T('color-hop', 'Color Hop', 'Color Switch', 7, 'A', 'endless', 3, true, 'Stars collected', '3 days'),
  T('zig-path', 'Zig Path', 'ZigZag', 7, 'A', 'endless', 12, true, 'Turns + gems 5', '3 days'),
  T('lane-racer', 'Lane Racer', 'Traffic Racer', 1, 'A', 'endless', 40, true, 'Distance + near misses 20', '3 days'),
  T('drift-king', 'Drift King', 'Drift Boss', 1, 'A', 'endless', 25, true, 'Distance', '3 days'),
  T('missile-guard', 'Missile Guard', 'Missile Command', 5, 'A', 'endless', 150, true, 'Warheads 25, wave bonus cities x100 + ammo x5', '3 days'),
  T('bug-blaster', 'Bug Blaster', 'Centipede', 5, 'A', 'endless', 200, true, 'Head 100, body 10, spider 300-900, mushroom 1', '3 days'),
  T('bubble-pop', 'Bubble Pop', 'Bubble Shooter', 6, 'A', 'endless', 200, true, '10 per match bubble, 20 x drops (x up to 4), clear 1000', '3-7 days'),
  T('mine-sweep', 'Mine Sweep', 'Minesweeper', 6, 'A', 'campaign', 120, true, '1 per cell + board clear speed bonus', '7 days'),
  T('knife-toss', 'Knife Toss', 'Knife Hit', 7, 'A', 'endless', 80, true, 'Knife 10, apple 50, stage 100 x stage', '3 days'),
  T('mole-whack', 'Mole Whack', 'Whac-A-Mole', 7, 'A', 'short-session', 120, true, 'Critter 10, gold 50, combo x5 (60s)', '1-3 days'),
  T('grow-op', 'Grow Op', 'Cannabis grow sim (Weed Firm / Hempire style)', 11, 'C', 'short-session', 60, true, 'Harvest 40-150 by ripeness x health, pests 5 (3 min)', '3 days'),
  T('trim-rush', 'Trim Rush', 'Cannabis trimming speed game', 11, 'C', 'short-session', 120, true, 'Leaf 10-30 combo, clean trim bonus; bud slice -3s (60s)', '1-3 days'),
  T('strain-crush', 'Strain Crush', 'Strain match-3 (Candy Crush style)', 11, 'C', 'short-session', 400, true, '10 per gem x cascade chain (3 min)', '3 days'),
  T('bud-bar', 'Bud Bar', 'Dispensary tapper (Tapper style)', 11, 'C', 'endless', 80, true, 'Serve 50, empties 25', '3 days'),
  T('green-dash', 'Green Dash', 'Delivery runner', 11, 'C', 'endless', 60, true, 'Distance + deliveries 100', '3 days'),
];
const games = LIST.map(x => {
  const s = SOURCES[x.src];
  return {
    id: 'gl-' + x.slug, slug: x.slug, title: x.title, ref_internal: x.ref, category: CATS[x.cat], lib: true, playable: true, unit: 'pts',
    url: `/games-lib/${x.slug}/index.html`, art: `/games-lib/${x.slug}/thumb.jpg`, tier: x.tier, competition: x.comp, endless: x.comp === 'endless',
    giveaway: x.give, just_for_fun: !x.give, scoring: x.scoring, event_length: x.evlen, acLevel: 2, ac_level: 'L2 session checks',
    // rate ceiling: normal = perSec*t + grace (flagged above), hard reject at 2x (src/anticheat.js + cfg.capOf)
    ac: { perSec: x.rate, ramp: 0, grace: Math.max(50, x.rate * 20), max: 1e12, coinsPerSec: 1 },
    tiers: [x.rate * 20, x.rate * 90, x.rate * 240].map(Math.round),
    source: s.source, licence: s.licence, build: s.kind, attempts: 'unlimited', leaderboard: 'best run', winner_rule: 'highest single-run score; ties to the earliest run',
  };
});
const EXTERNAL = []; // "Just for fun" external links (not vendored), see docs/GAMES-LIB.md
function mount(app) {
  app.get('/api/games-lib', (req, res) => res.json({ ok: true, categories: CATS, games: games.map(({ ref_internal, ...g }) => g), external: EXTERNAL }));
}
module.exports = { games, CATS, SOURCES, EXTERNAL, mount };
