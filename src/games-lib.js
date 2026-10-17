'use strict';
// Games Library registry (The Gaming Hub). Static HTML5 games under public/games-lib/<slug>/, scored through the normal
// signed run flow (/api/run/start + /api/score) via public/games-lib/adapter.js.
const CATS = ['Endless Runners', 'Driving', 'Physics & Destruction', 'Tower Defense', 'Survival & Horde', 'Arcade Shooters', 'Puzzle & Brain', 'Reflex & Skill', 'Combat', 'Sports', 'Specialty', 'Cannabis'];
const SOURCES = {
  built: { kind: 'built', source: 'Original Hub build (public/games-lib/kit.js engine)', licence: 'MIT (Trap Tech Solutions), original code, synthesized WebAudio SFX, vector art' },
  m2048: { kind: 'vendored', source: 'github.com/gabrielecirulli/2048', licence: 'MIT (Gabriele Cirulli); LICENSE kept; Clear Sans font Apache-2.0' },
  hextris: { kind: 'vendored', source: 'github.com/Hextris/hextris', licence: 'GPL-3.0 (client code, source served unminified); LICENSE kept' },
  trex: { kind: 'vendored', source: 'github.com/wayou/t-rex-runner (extracted from Chromium neterror resources)', licence: 'BSD-3-Clause (code + sprites + sounds, Chromium Authors); LICENSE kept' },
  opensource: { kind: 'vendored', source: 'Public domain / MIT open-source HTML5 classics', licence: 'MIT or public domain; LICENSE kept where applicable' },
};
const T = (slug, title, ref, cat, tier, comp, rate, give, scoring, evlen, src) => ({ slug, title, ref, cat, tier, comp, rate, give, scoring, evlen, src: src || 'built' });
const LIST = [
  // ---- Core A+ (cleaned) ----
  T('block-drop', 'Block Drop', 'Tetris', 6, 'A+', 'endless', 220, true, 'Lines 100/300/500/800 x level + soft drop', '3-7 days'),
  T('maze-muncher', 'Maze Muncher', 'Pac-Man', 10, 'A+', 'endless', 260, true, 'Dots 10, power 50, ghosts 200-1600, mazes repeat faster', '3-7 days'),
  T('alien-rows', 'Alien Rows', 'Space Invaders', 5, 'A+', 'endless', 140, true, 'Aliens 10-30, saucer 100-300, wave bonus', '3 days'),
  T('cloud-hopper', 'Cloud Hopper', 'Doodle Jump', 0, 'A+', 'endless', 60, true, 'Height climbed + pickups', '3 days'),
  T('road-hopper', 'Road Hopper', 'Crossy Road', 0, 'A+', 'endless', 8, true, '1 per furthest row + coins 5', '3 days'),
  T('bud-merge', 'Bud Merge', '2048', 11, 'A+', 'endless', 60, true, 'Sum of merged tiles (endless, no win stop)', '1-3 days', 'm2048'),
  T('hex-stack', 'Hex Stack', 'Hextris', 6, 'A', 'endless', 80, true, 'Hexes burst x chain (endless, speeds up)', '1-3 days'),
  T('dino-dash', 'Desert Dash', 'Chrome T-Rex Runner', 0, 'A+', 'endless', 25, true, 'Distance run (endless, speeds up)', '1-3 days'),
  T('rock-buster', 'Rock Buster', 'Asteroids', 5, 'A+', 'endless', 180, true, 'Rocks 20/50/100, UFO 300', '3 days'),
  T('star-swarm', 'Star Swarm', 'Galaga', 5, 'A+', 'endless', 200, true, 'Bugs 50-160 (diving x2), stage bonus', '3 days'),
  T('rail-rush', 'Rail Rush', 'Subway Surfers', 0, 'A+', 'endless', 900, true, 'Distance x multiplier (1-5 from coins, x2 power-up) + coins 10 x multiplier, power-ups 25', '3 days'),
  T('hill-hauler', 'Hill Hauler', 'Hill Climb Racing', 1, 'A+', 'endless', 40, true, 'Distance in m + coins 5', '3 days'),
  T('wanted-run', 'Most Wanted Run', 'Smashy Road: Wanted 2', 1, 'A+', 'endless', 60, true, 'Survival time x heat + wrecked cops 50', '3 days'),
  T('pop-defense', 'Pop Defense', 'Bloons TD 6', 3, 'A+', 'endless-waves', 120, true, 'Layer pops 1, wave bonus 25 x wave', '7 days'),
  T('cube-horde', 'Cube Horde', 'Zombie Cubes', 4, 'A+', 'endless', 120, true, 'Kills 10-50 x combo, wave bonus', '3 days'),
  T('arrow-hero', 'Arrow Hero', 'Archero', 4, 'A', 'endless', 400, true, 'Kill 25, boss 1000, room clear 100 x room', '3 days'),
  T('grid-wars', 'Grid Wars', 'Geometry Wars', 4, 'A+', 'endless', 400, true, 'Enemies 25-150 x multiplier', '3 days'),
  // ---- A tier ----
  T('moon-swarm', 'Moon Swarm', 'Vampire Survivors', 4, 'A', 'endless', 150, true, 'Kills 10-80 (enemy tier), uncapped survival', '3 days'),
  T('throttle-rider', 'Throttle Rider', 'Traffic Rider', 1, 'A', 'endless', 60, true, 'Distance + near-miss chains (first-person)', '3 days'),
  T('goo-tower', 'Goo Tower', 'World of Goo', 2, 'A', 'endless', 20, true, 'Peak tower height in m (wind grows)', '3 days'),
  T('keep-guard', 'Keep Guard', 'Kingdom Rush', 3, 'A', 'endless-waves', 120, true, 'Raiders 10-120, wave bonus 50 x wave', '7 days'),
  T('node-siege', 'Node Siege', 'Infinitode 2', 3, 'A', 'endless-waves', 120, true, 'Enemies 10-300, wave bonus 40 x wave (maze building)', '7 days'),
  T('orb-coil', 'Orb Coil', 'Zuma', 6, 'A', 'endless', 150, true, 'Orbs 10 x combo + chain bonus 50 x combo', '3 days'),
  T('neon-flipper', 'Neon Flipper', 'Pinball', 6, 'A', 'endless', 2500, true, 'Bumper 100, sling 10, target 250, lane 500, bank 5000 (all x multiplier up to 6)', '3 days'),
  T('light-cycle', 'Light Cycle', 'Tron light cycles', 7, 'A', 'endless', 600, true, 'Rival derezzed 100 x round, round clear 500 x round, near-miss 2, survival 1 per 10 cells', '3 days'),
  T('roof-runner', 'Roof Runner', 'Canabalt', 0, 'A', 'endless', 40, true, 'Distance m', '3 days'),
  T('helix-drop', 'Helix Drop', 'Helix Jump', 7, 'A', 'endless', 40, true, 'Floors passed with combo, fireball smashes', '3 days'),
  T('hex-spin', 'Hex Spin', 'Super Hexagon', 7, 'A', 'endless', 12, true, 'Survival time in 0.1s', '3 days'),
  T('color-hop', 'Color Hop', 'Color Switch', 7, 'A', 'endless', 3, true, 'Stars collected', '3 days'),
  T('zig-path', 'Zig Path', 'ZigZag', 7, 'A', 'endless', 12, true, 'Turns + gems 5', '3 days'),
  T('missile-guard', 'Missile Guard', 'Missile Command', 5, 'A', 'endless', 150, true, 'Warheads 25, wave bonus cities x100 + ammo x5', '3 days'),
  T('bug-blaster', 'Bug Blaster', 'Centipede', 5, 'A', 'endless', 200, true, 'Head 100, body 10, spider 300-900, mushroom 1', '3 days'),
  T('bubble-pop', 'Bubble Pop', 'Bubble Shooter', 6, 'A', 'endless', 200, true, '10 per match bubble, 20 x drops (x up to 4), clear 1000', '3-7 days'),
  T('mine-sweep', 'Mine Sweep', 'Minesweeper', 6, 'A', 'endless-levels', 120, true, '1 per cell + board clear speed bonus', '7 days'),
  T('knife-toss', 'Knife Toss', 'Knife Hit', 7, 'A', 'endless', 80, true, 'Knife 10, apple 50, stage 100 x stage', '3 days'),
  T('mole-whack', 'Mole Whack', 'Whac-A-Mole', 7, 'A', 'endless', 120, true, 'Critter 10, gold 50, combo x5; hits refill the clock (+0.6s / gold +2s), drain speeds up', '1-3 days'),
  // Cannabis themed
  T('grow-op', 'Grow Op', 'Cannabis grow sim', 11, 'C', 'endless', 60, true, 'Harvest 40-150 by ripeness x health, pests 5; ends when 3 plants die', '3 days'),
  T('trim-rush', 'Trim Rush', 'Cannabis trimming speed game', 11, 'C', 'endless', 120, true, 'Leaf 10-30 combo, clean trim bonus; trims refill the clock, bud slice -3s', '1-3 days'),
  T('strain-crush', 'Strain Crush', 'Strain match-3', 11, 'C', 'endless', 400, true, '10 per gem x cascade chain; matches refill the clock', '3 days'),
  T('bud-bar', 'Bud Bar', 'Dispensary tapper', 11, 'C', 'endless', 80, true, 'Serve 50, empties 25', '3 days'),
  T('green-dash', 'Green Dash', 'Delivery runner', 11, 'C', 'endless', 60, true, 'Distance + deliveries 100', '3 days'),
  T('roll-up', 'Roll Up', 'Cannabis rolling precision', 11, 'C', 'endless', 900, true, 'Step accuracy 0-100 x streak multiplier (up to x5), order bonus 2 x average accuracy', '3 days'),
  T('smoke-rings', 'Smoke Rings', 'Cannabis lounge ring-blowing', 11, 'C', 'endless', 1500, true, 'Hoop 100 (bullseye 200) x combo up to 6, set clear 500 x set', '3 days'),
  T('bud-sort', 'Bud Sort', 'Cannabis conveyor sorting', 11, 'C', 'endless', 260, true, 'Jar 10-20 by timing x combo up to 8', '3 days'),
  T('pest-patrol', 'Pest Patrol', 'Grow-room bug squash', 11, 'C', 'endless', 220, true, 'Mite 10, caterpillar 20, beetle 40 x combo up to 5, wave 100 x wave', '3 days'),
  T('cup-toss', 'Cup Toss', 'Swipe-throw cup pong', 11, 'C', 'endless', 900, true, 'Cup 100 (+50 bounce, +30 rattle) x streak up to 5, rack 500 x rack', '3 days'),
  // B tier + sports / skill
  T('beat-tiles', 'Beat Tiles', 'Piano Tiles', 6, 'B', 'endless', 20, true, 'Tile 1-3 by timing, long-tile hold 1 per 40 px + 3', '3 days'),
  T('moon-lander', 'Moon Lander', 'Lunar Lander', 10, 'B', 'endless', 60, true, 'Landing (50 + softness + upright) x pad 2-5', '3 days'),
  T('pin-strike', 'Pin Strike', 'Bowling', 9, 'B', 'endless', 40, true, 'Pins + real strike/spare bonuses over endless frames', '3 days'),
  T('bullseye', 'Bullseye', 'Archery King', 8, 'B', 'endless', 60, true, 'Arrow ring x10 (+5 X), end bonus 20 x end', '3 days'),
  T('spot-kick', 'Spot Kick', 'Soccer Penalty', 9, 'B', 'endless', 400, true, 'Goal 100-200 by corner x2 ring x streak up to 4', '3 days'),
  T('glow-echo', 'Glow Echo', 'Simon', 6, 'B', 'endless', 160, true, 'Pad 10-20 by answer speed, round 25 x round', '3 days'),
  T('knockout', 'Knockout Ring', 'Punch-Out', 8, 'B', 'endless', 900, true, 'Hits 60-600 (counter x2), dodge 50, KO 1000 x KOs + stamina', '3 days'),
  T('putt-party', 'Putt Party', 'Mini Golf', 9, 'B', 'endless', 400, true, 'Hole 300 + 200 per stroke under par, ace +1000', '3 days'),
  T('cue-club', 'Cue Club', 'Pool', 9, 'B', 'endless', 500, true, 'Pot 100 x pots-this-turn, rack 500 x racks', '3 days'),
  T('long-ball', 'Long Ball', 'Home Run Derby', 9, 'B', 'endless', 2000, true, 'Homer = distance ft x streak mult up to 4', '3 days'),
  T('rally-court', 'Rally Court', 'Tennis Rally', 9, 'B', 'endless', 600, true, 'Return 10 x rally (cap 10) x2 sweet spot, point 200 + 25 x rally', '3 days'),
  T('ice-snipe', 'Ice Snipe', 'Hockey Shootout', 9, 'B', 'endless', 600, true, 'Goal 100-250 by corner x streak up to 4', '3 days'),
  T('reel-deal', 'Reel Deal', 'Fishing Challenge', 9, 'B', 'endless', 600, true, 'Fish = kg x 100 x (1 + rarity x 2)', '3 days'),
  T('hoop-streak', 'Hoop Streak', 'Basketball Shot', 9, 'B', 'endless', 400, true, 'Make 100/150 (2/3 pt) x1.5 swish x2 fire', '3 days'),
  T('kickflip-city', 'Kickflip City', 'Skateboard Tricks', 9, 'B', 'endless', 900, true, 'Combo = trick/grind points x tricks in combo, banked on clean landing', '3 days'),
  T('tile-twin', 'Tile Twin', 'Mahjong Solitaire', 6, 'B', 'endless', 150, true, 'Pair 20 x combo up to 6 + 5 x layout, clear 500 x layout', '3 days'),
  // Remaining runners / driving
  T('tunnel-hop', 'Tunnel Hop', 'Tunnel Runner', 0, 'A', 'endless', 40, true, 'Distance m', '3 days'),
  T('no-brakes', 'No Brakes', 'Faily Brakes', 1, 'A', 'endless', 80, true, 'Distance + cars passed 10', '3 days'),
  T('cab-rush', 'Cab Rush', 'Crazy Taxi', 1, 'A', 'endless', 40, true, 'Fares 50 + speed bonus; time extends per fare', '3 days'),
  T('dirt-dash', 'Dirt Dash', 'Excitebike', 1, 'A', 'endless', 40, true, 'Distance m + clean landings 30', '3 days'),
  T('road-brawl', 'Road Brawl', 'Road Rash', 1, 'A', 'endless', 120, true, 'Distance + takedowns 60-100', '3 days'),
  T('derby-smash', 'Derby Smash', 'Demolition Derby', 1, 'A', 'endless', 200, true, 'Impact damage dealt + wrecks 150', '3 days'),
  T('dunk-flick', 'Dunk Flick', 'Dunk Shot', 7, 'A', 'endless', 25, true, '1 per basket, swish streak +n', '3 days'),
  T('duck-shot', 'Duck Shot', 'Duck Hunt', 7, 'A', 'endless', 400, true, 'Bird 100 + 20 x round, gold +400', '3 days'),
  T('paper-toss', 'Paper Toss', 'Paper Toss', 7, 'A', 'endless', 8, true, '1-5 per basket by wind strength', '1-3 days'),
  T('skee-roll', 'Skee Roll', 'Skee-Ball', 7, 'A', 'endless', 100, true, 'Rings 10-100; 9-ball frames, beat the rising target to continue, frame bonus 50 x frame', '1-3 days'),
  T('neon-circuit', 'Neon Circuit', 'Neon Arcade Racer', 1, 'A', 'endless', 120, true, 'Energy cells 30–125 by combo; near-miss 5', '3 days'),
  T('rift-survival', 'Rift Survival', 'Arena Survival', 4, 'A', 'endless', 180, true, 'Shards 25; wave transition bonus 10 × wave; survival is the primary skill loop', '3 days'),
  // ---- 20 NEW catalog-style titles (idle, merge, stickman, defense, casual) ----
  T('mahjong-meadow', 'Mahjong Meadow', 'Mahjong Solitaire', 6, 'A', 'endless', 140, true, 'Pairs matched x combo + layout clear', '3 days', 'opensource'),
  T('bubble-odyssey', 'Bubble Odyssey', 'Bubble Shooter', 6, 'A', 'endless', 180, true, 'Bubbles cleared x chain + level bonus', '3 days', 'opensource'),
  T('idle-coffee', 'Idle Coffee Empire', 'Idle Tycoon', 10, 'A', 'endless', 40, true, 'Coins earned + upgrades', '3-7 days', 'opensource'),
  T('parking-sim', 'Parking Practice', 'Parking Simulator', 1, 'A', 'endless', 50, true, 'Successful parks + speed + style', '3 days', 'opensource'),
  T('merge-garden', 'Merge Garden', 'Merge Game', 6, 'A', 'endless', 90, true, 'Merges completed + chain bonus', '3 days', 'opensource'),
  T('twin-tiles', 'Twin Tiles', 'Tile Match', 6, 'A', 'endless', 100, true, 'Matches x speed + combo', '1-3 days', 'opensource'),
  T('stickman-jump', 'Stickman Jump', 'Endless Jumper', 0, 'A', 'endless', 35, true, 'Height + platforms + pickups', '3 days', 'opensource'),
  T('zombie-defense', 'Zombie Idle Defense', 'Idle Tower Defense', 3, 'A', 'endless-waves', 130, true, 'Kills + wave bonus + upgrades', '7 days', 'opensource'),
  T('stickman-plane', 'Stickman Airplane', 'Endless Flyer', 0, 'A', 'endless', 45, true, 'Distance + obstacles cleared', '3 days', 'opensource'),
  T('fruit-bounce', 'Fruit Bounce', 'Bounce / Fruit Ninja style', 7, 'A', 'endless', 110, true, 'Fruits sliced x combo', '1-3 days', 'opensource'),
  T('drive-zone', 'Drive Zone', 'Endless Driver', 1, 'A', 'endless', 55, true, 'Distance + near-misses + coins', '3 days', 'opensource'),
  T('block-fit', 'Block Fit', 'Block Puzzle', 6, 'A', 'endless', 70, true, 'Lines cleared + fits', '3 days', 'opensource'),
  T('geometry-parkour', 'Geometry Parkour', 'Parkour Runner', 0, 'A', 'endless', 30, true, 'Distance + obstacles', '3 days', 'opensource'),
  T('ragdoll-express', 'Ragdoll Express', 'Physics Runner', 0, 'A', 'endless', 40, true, 'Distance + flips', '3 days', 'opensource'),
  T('step-box', 'Step Box', 'Platformer', 0, 'A', 'endless', 25, true, 'Boxes stacked + height', '3 days', 'opensource'),
  T('word-tictac', 'Word Tic Tac Toe', 'Word Puzzle', 6, 'B', 'endless', 60, true, 'Words formed + wins', '3 days', 'opensource'),
  T('heart-forge', 'Heart Forge', 'Merge / Idle', 6, 'A', 'endless', 80, true, 'Merges + production', '3-7 days', 'opensource'),
  T('woody-hexa', 'Woody Hexa', 'Hex Puzzle', 6, 'A', 'endless', 75, true, 'Hexes cleared x combo', '3 days', 'opensource'),
  T('boxing-legend', 'Boxing Legend', 'Boxing', 8, 'A', 'endless', 200, true, 'Hits + KOs + stamina', '3 days', 'opensource'),
  T('silent-asylum', 'Silent Asylum', 'Horror Survival', 4, 'A', 'endless', 90, true, 'Survival time + escapes', '3 days', 'opensource'),
  T('wreck-ride', 'Wreck Ride', 'Retired duplicate (historic id kept)', 2, 'A', 'endless', 60, false, 'Distance m + flips 150 + big air 20 + crates 25', '3 days'),
  T('rig-rally', 'Rig Rally', 'Retired duplicate (historic id kept)', 2, 'A', 'endless', 60, false, 'Distance m + coins 5 + stars 50 (build your own rig)', '3 days'),
  T('drift-king', 'Drift King', 'Retired duplicate (historic id kept)', 1, 'A', 'endless', 25, false, 'Distance', '3 days'),
  T('dune-glide', 'Dune Glide', 'Retired duplicate (historic id kept)', 0, 'A', 'endless', 80, false, 'Distance + flips 100 x n + coins 5', '3 days'),
  T('egg-roll', 'Egg Roll', 'Retired duplicate (historic id kept)', 1, 'A', 'endless', 40, false, 'Distance m + coins 5', '3 days'),
  T('monster-crush', 'Monster Crush', 'Retired duplicate (historic id kept)', 1, 'A', 'endless', 120, false, 'Distance + crushed cars 50 + flips', '3 days'),
];
const OWNER_RETIRED = Object.freeze({
  'wreck-ride': 'gl-hill-hauler', 'rig-rally': 'gl-hill-hauler', 'dune-glide': 'gl-hill-hauler', 'egg-roll': 'gl-hill-hauler', 'monster-crush': 'gl-hill-hauler', 'drift-king': 'drift-rush',
});
// Only list games whose playable files actually exist in this build. The registry advertised 20 titles with no
// public/games-lib/<slug>/ folder (404 on click, and they inflated the game count); they come back automatically once built.
const HAS_FILES = (slug) => require('fs').existsSync(require('path').join(__dirname, '..', 'public', 'games-lib', slug, 'index.html'));
const ART_EXT = (slug) => { const d = require('path').join(__dirname, '..', 'public', 'games-lib', slug); const fs = require('fs'); return !fs.existsSync(require('path').join(d, 'thumb.jpg')) && fs.existsSync(require('path').join(d, 'thumb.svg')) ? 'svg' : 'jpg'; };
const games = LIST.filter(x => HAS_FILES(x.slug)).map(x => {
  const s = SOURCES[x.src] || SOURCES.built;
  return {
    id: 'gl-' + x.slug, slug: x.slug, title: x.title, ref_internal: x.ref, category: CATS[x.cat], lib: true,
    playable: !OWNER_RETIRED[x.slug], retired: !!OWNER_RETIRED[x.slug], replacedBy: OWNER_RETIRED[x.slug] || null,
    unit: 'pts',
    url: `/games-lib/${x.slug}/index.html`, art: `/games-lib/${x.slug}/thumb.${ART_EXT(x.slug)}`, tier: x.tier, competition: x.comp, endless: /^endless/.test(x.comp),
    giveaway: !OWNER_RETIRED[x.slug], just_for_fun: false, endless_mode: /^endless/.test(x.comp), scoring: x.scoring, event_length: x.evlen, acLevel: 2, ac_level: 'L2 session checks',
    ac: { perSec: x.rate, ramp: 0, grace: Math.max(50, x.rate * 20), max: 1e12, coinsPerSec: 1 },
    tiers: [x.rate * 20, x.rate * 90, x.rate * 240].map(Math.round),
    source: s.source, licence: s.licence, build: s.kind, attempts: 'unlimited', leaderboard: 'best run', winner_rule: 'highest single-run score in endless mode (uncapped); exactly one winner', tiebreak: ["skill: faster server-timed completion of the same score","skill: stronger server-derived scoring-event efficiency or game metric","exact tie: seeded sudden-death playoff (same game and seed for tied players)"],
  };
});
const EXTERNAL = [];
function mount(app) {
  app.get('/api/games-lib', (req, res) => res.json({ ok: true, categories: CATS, games: games.map(({ ref_internal, ...g }) => g), external: EXTERNAL }));
}
module.exports = { games, CATS, SOURCES, EXTERNAL, mount };
