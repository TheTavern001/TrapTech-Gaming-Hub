# Games Library (The Gaming Hub)

> Registry reconciliation for branch `games-lib-integrity-audit`. `src/games-lib.js` is the registry source of truth. This report does not imply browser or mobile tests have passed.

- Source registry entries: **100**
- Public catalog entries: **100**
- New original games on this branch: Neon Circuit and Rift Survival.
- Neon Circuit and Rift Survival use L3 score-event validation with game-specific event-value rules; other library entries remain at L2 until individually reviewed.
- All games still require fresh browser tests, real mobile performance checks, visual review, scoring-integrity validation, and asset-license review before being described as verified.

## Registry

| # | Hub name | Internal reference | Category | Tier | Mode | Build | Scoring model | Points/sec ceiling | Verification |
|---:|---|---|---|---|---|---|---|---:|---|
| 1 | Sky Flap | Flappy Bird | Endless Runners | A+ | endless | built | 1 point per gate passed | 2 | Not freshly verified |
| 2 | Block Drop | Tetris | Puzzle & Brain | A+ | endless | built | Lines 100/300/500/800 x level + soft drop | 220 | Not freshly verified |
| 3 | Maze Muncher | Pac-Man | Specialty | A+ | endless | built | Dots 10, power 50, ghosts 200-1600, mazes repeat faster | 260 | Not freshly verified |
| 4 | Alien Rows | Space Invaders | Arcade Shooters | A+ | endless | built | Aliens 10-30, saucer 100-300, wave bonus | 140 | Not freshly verified |
| 5 | Cloud Hopper | Doodle Jump | Endless Runners | A+ | endless | built | Height climbed + pickups | 60 | Not freshly verified |
| 6 | Road Hopper | Crossy Road | Endless Runners | A+ | endless | built | 1 per furthest row + coins 5 | 8 | Not freshly verified |
| 7 | Bud Merge | 2048 | Cannabis | A+ | endless | vendored | Sum of merged tiles (endless, no win stop) | 60 | Not freshly verified |
| 8 | Hex Stack | Hextris | Puzzle & Brain | A | endless | vendored | Cleared blocks x combo (endless, speeds up) | 80 | Not freshly verified |
| 9 | Desert Dash | Chrome T-Rex Runner | Endless Runners | A+ | endless | vendored | Distance (Chromium meter) | 25 | Not freshly verified |
| 10 | Neon Serpent | Snake | Specialty | A+ | endless | built | Food 10 x speed level, gold 50 | 60 | Not freshly verified |
| 11 | Brick Blitz | Breakout | Specialty | A+ | endless | built | Bricks 10-50 x combo, wall bonus | 260 | Not freshly verified |
| 12 | Rock Buster | Asteroids | Arcade Shooters | A+ | endless | built | Rocks 20/50/100, UFO 300 | 180 | Not freshly verified |
| 13 | Star Swarm | Galaga | Arcade Shooters | A+ | endless | built | Bugs 50-160 (diving x2), stage bonus | 200 | Not freshly verified |
| 14 | Rail Rush | Subway Surfers | Endless Runners | A+ | endless | built | Distance x multiplier (1-5 from coins, x2 power-up) + coins 10 x multiplier, power-ups 25 | 900 | Not freshly verified |
| 15 | Ruin Runner | Temple Run 2 | Endless Runners | A+ | endless | built | Distance + gems 10 | 60 | Not freshly verified |
| 16 | Hill Hauler | Hill Climb Racing | Driving | A+ | endless | built | Distance in m + coins 5 | 40 | Not freshly verified |
| 17 | Most Wanted Run | Smashy Road: Wanted 2 | Driving | A+ | endless | built | Survival time x heat + wrecked cops 50 | 60 | Not freshly verified |
| 18 | Sling Siege | Angry Birds 2 | Physics & Destruction | A+ | endless-levels | built | Blocks 10-50, targets 500, shots left 1000 | 400 | Not freshly verified |
| 19 | Lawn Guard | Plants vs. Zombies | Tower Defense | A+ | endless-waves | built | Zombies 10-50, wave bonus 100 x wave | 60 | Not freshly verified |
| 20 | Pop Defense | Bloons TD 6 | Tower Defense | A+ | endless-waves | built | Layer pops 1, wave bonus 25 x wave | 120 | Not freshly verified |
| 21 | Cube Horde | Zombie Cubes | Survival & Horde | A+ | endless | built | Kills 10-50 x combo, wave bonus | 120 | Not freshly verified |
| 22 | Arrow Hero | Archero | Survival & Horde | A | endless | built | Kill 25, boss 1000, room clear 100 x room | 400 | Not freshly verified |
| 23 | Night Shift | 20 Minutes Till Dawn | Survival & Horde | A | endless | built | Kills 10-500 by monster + wave bonus | 400 | Not freshly verified |
| 24 | Grid Wars | Geometry Wars | Survival & Horde | A+ | endless | built | Enemies 25-150 x multiplier | 400 | Not freshly verified |
| 25 | Jet Blaster | Jetpack Joyride | Endless Runners | A | endless | built | Distance m + coins 5 | 40 | Not freshly verified |
| 26 | Moon Swarm | Vampire Survivors | Survival & Horde | A | endless | built | Kills 10-80 (enemy tier), uncapped survival | 150 | Not freshly verified |
| 27 | Throttle Rider | Traffic Rider | Driving | A | endless | built | Distance + near-miss chains (first-person) | 60 | Not freshly verified |
| 28 | Wreck Ride | Happy Wheels | Physics & Destruction | A | endless | built | Distance m + flips 150 + big air 20 + crates 25 | 60 | Not freshly verified |
| 29 | Rig Rally | Bad Piggies | Physics & Destruction | A | endless | built | Distance m + coins 5 + stars 50 (build your own rig) | 60 | Not freshly verified |
| 30 | Goo Tower | World of Goo | Physics & Destruction | A | endless | built | Peak tower height in m (wind grows) | 20 | Not freshly verified |
| 31 | Keep Guard | Kingdom Rush | Tower Defense | A | endless-waves | built | Raiders 10-120, wave bonus 50 x wave | 120 | Not freshly verified |
| 32 | Node Siege | Infinitode 2 | Tower Defense | A | endless-waves | built | Enemies 10-300, wave bonus 40 x wave (maze building) | 120 | Not freshly verified |
| 33 | Orb Coil | Zuma | Puzzle & Brain | A | endless | built | Orbs 10 x combo + chain bonus 50 x combo | 150 | Not freshly verified |
| 34 | Gem Rush | Bejeweled | Puzzle & Brain | A | endless | built | Jewels 10 x cascade, Flame and Star gem blasts (blitz clock refilled by matches) | 220 | Not freshly verified |
| 35 | Slab Stack | Stack | Reflex & Skill | A | endless | built | Slab 1, perfect drop 1 + combo (max 11) | 25 | Not freshly verified |
| 36 | Neon Flipper | Pinball | Puzzle & Brain | A | endless | built | Bumper 100, sling 10, target 250, lane 500, bank 5000 (all x multiplier up to 6) | 2500 | Not freshly verified |
| 37 | Light Cycle | Tron light cycles | Reflex & Skill | A | endless | built | Rival derezzed 100 x round, round clear 500 x round, near-miss 2, survival 1 per 10 cells | 600 | Not freshly verified |
| 38 | Toad Cross | Frogger | Puzzle & Brain | A | endless | built | Hop forward 10, home 50 + 10 x seconds left, bug 200, level 1000 | 260 | Not freshly verified |
| 39 | Roof Runner | Canabalt | Endless Runners | A | endless | built | Distance m | 40 | Not freshly verified |
| 40 | Helix Drop | Helix Jump | Reflex & Skill | A | endless | built | Floors passed with combo, fireball smashes | 40 | Not freshly verified |
| 41 | Hex Spin | Super Hexagon | Reflex & Skill | A | endless | built | Survival time in 0.1s | 12 | Not freshly verified |
| 42 | Color Hop | Color Switch | Reflex & Skill | A | endless | built | Stars collected | 3 | Not freshly verified |
| 43 | Zig Path | ZigZag | Reflex & Skill | A | endless | built | Turns + gems 5 | 12 | Not freshly verified |
| 44 | Lane Racer | Traffic Racer | Driving | A | endless | built | Distance + near misses 20 x combo (max x5) | 160 | Not freshly verified |
| 45 | Drift King | Drift Boss | Driving | A | endless | built | Distance | 25 | Not freshly verified |
| 46 | Missile Guard | Missile Command | Arcade Shooters | A | endless | built | Warheads 25, wave bonus cities x100 + ammo x5 | 150 | Not freshly verified |
| 47 | Bug Blaster | Centipede | Arcade Shooters | A | endless | built | Head 100, body 10, spider 300-900, mushroom 1 | 200 | Not freshly verified |
| 48 | Bubble Pop | Bubble Shooter | Puzzle & Brain | A | endless | built | 10 per match bubble, 20 x drops (x up to 4), clear 1000 | 200 | Not freshly verified |
| 49 | Mine Sweep | Minesweeper | Puzzle & Brain | A | endless-levels | built | 1 per cell + board clear speed bonus | 120 | Not freshly verified |
| 50 | Knife Toss | Knife Hit | Reflex & Skill | A | endless | built | Knife 10, apple 50, stage 100 x stage | 80 | Not freshly verified |
| 51 | Mole Whack | Whac-A-Mole | Reflex & Skill | A | endless | built | Critter 10, gold 50, combo x5; hits refill the clock (+0.6s / gold +2s), drain speeds up | 120 | Not freshly verified |
| 52 | Grow Op | Cannabis grow sim (Weed Firm / Hempire style) | Cannabis | C | endless | built | Harvest 40-150 by ripeness x health, pests 5; ends when 3 plants die | 60 | Not freshly verified |
| 53 | Trim Rush | Cannabis trimming speed game | Cannabis | C | endless | built | Leaf 10-30 combo, clean trim bonus; trims refill the clock, bud slice -3s | 120 | Not freshly verified |
| 54 | Strain Crush | Strain match-3 (Candy Crush style) | Cannabis | C | endless | built | 10 per gem x cascade chain; matches refill the clock | 400 | Not freshly verified |
| 55 | Bud Bar | Dispensary tapper (Tapper style) | Cannabis | C | endless | built | Serve 50, empties 25 | 80 | Not freshly verified |
| 56 | Green Dash | Delivery runner | Cannabis | C | endless | built | Distance + deliveries 100 | 60 | Not freshly verified |
| 57 | Roll Up | Cannabis rolling precision game (Perfect Slices / timing style) | Cannabis | C | endless | built | Step accuracy 0-100 x streak multiplier (up to x5), order bonus 2 x average accuracy | 900 | Not freshly verified |
| 58 | Smoke Rings | Cannabis lounge ring-blowing skill game (aim + power shot) | Cannabis | C | endless | built | Hoop 100 (bullseye 200) x combo up to 6, set clear 500 x set | 1500 | Not freshly verified |
| 59 | Bud Sort | Cannabis conveyor sorting reflex game | Cannabis | C | endless | built | Jar 10-20 by timing x combo up to 8 | 260 | Not freshly verified |
| 60 | Pest Patrol | Grow-room bug squash (Ant Smasher style) | Cannabis | C | endless | built | Mite 10, caterpillar 20, beetle 40 x combo up to 5, wave 100 x wave; ladybug squash costs a plant | 220 | Not freshly verified |
| 61 | Cup Toss | Swipe-throw cup pong (Cup Pong style) | Cannabis | C | endless | built | Cup 100 (+50 bounce, +30 rattle) x streak up to 5, rack 500 x rack | 900 | Not freshly verified |
| 62 | Beat Tiles | Piano Tiles | Puzzle & Brain | B | endless | built | Tile 1-3 by timing, long-tile hold 1 per 40 px + 3 | 20 | Not freshly verified |
| 63 | Moon Lander | Lunar Lander | Specialty | B | endless | built | Landing (50 + softness + upright) x pad 2-5 | 60 | Not freshly verified |
| 64 | Pin Strike | Bowling | Sports | B | endless | built | Pins + real strike/spare bonuses over endless frames | 40 | Not freshly verified |
| 65 | Bullseye | Archery King (Endless Archery) | Combat | B | endless | built | Arrow ring x10 (+5 X), end bonus 20 x end | 60 | Not freshly verified |
| 66 | Spot Kick | Soccer Penalty Challenge | Sports | B | endless | built | Goal 100-200 by corner x2 ring x streak up to 4 | 400 | Not freshly verified |
| 67 | Glow Echo | Simon | Puzzle & Brain | B | endless | built | Pad 10-20 by answer speed, round 25 x round | 160 | Not freshly verified |
| 68 | Knockout Ring | Punch-Out!! | Combat | B | endless | built | Hits 60-600 (counter x2), dodge 50, KO 1000 x KOs + stamina | 900 | Not freshly verified |
| 69 | Putt Party | Golf Challenge (mini golf) | Sports | B | endless | built | Hole 300 + 200 per stroke under par, ace +1000 | 400 | Not freshly verified |
| 70 | Cue Club | Pool / Billiards | Sports | B | endless | built | Pot 100 x pots-this-turn, rack 500 x racks | 500 | Not freshly verified |
| 71 | Long Ball | Home Run Derby | Sports | B | endless | built | Homer = distance ft x streak mult up to 4 | 2000 | Not freshly verified |
| 72 | Rally Court | Tennis Rally | Sports | B | endless | built | Return 10 x rally (cap 10) x2 sweet spot, point 200 + 25 x rally | 600 | Not freshly verified |
| 73 | Ice Snipe | Hockey Shootout | Sports | B | endless | built | Goal 100-250 by corner x streak up to 4 | 600 | Not freshly verified |
| 74 | Reel Deal | Fishing Challenge | Sports | B | endless | built | Fish = kg x 100 x (1 + rarity x 2) | 600 | Not freshly verified |
| 75 | Hoop Streak | Basketball Shot Challenge | Sports | B | endless | built | Make 100/150 (2/3 pt) x1.5 swish x2 fire | 400 | Not freshly verified |
| 76 | Kickflip City | Skateboard Trick Challenge | Sports | B | endless | built | Combo = trick/grind points x tricks in combo, banked on clean landing | 900 | Not freshly verified |
| 77 | Tile Twin | Mahjong Solitaire | Puzzle & Brain | B | endless | built | Pair 20 x combo up to 6 + 5 x layout, clear 500 x layout | 150 | Not freshly verified |
| 78 | Tunnel Hop | Run (Tunnel runner) | Endless Runners | A | endless | built | Distance m | 40 | Not freshly verified |
| 79 | Hill Glider | Tiny Wings | Endless Runners | A | endless | built | Distance m + perfect slides 25 | 60 | Not freshly verified |
| 80 | Dune Glide | Alto's Adventure | Endless Runners | A | endless | built | Distance + flips 100 x n + coins 5 | 80 | Not freshly verified |
| 81 | Moto Lanes | Traffic Rider | Driving | A | endless | built | Distance + near misses 10 + coins | 60 | Not freshly verified |
| 82 | Egg Roll | Eggy Car | Driving | A | endless | built | Distance m + coins 5 | 40 | Not freshly verified |
| 83 | Monster Crush | Monster truck crusher | Driving | A | endless | built | Distance + crushed cars 50 + flips | 120 | Not freshly verified |
| 84 | Park Getaway | Pako Forever | Driving | A | endless | built | Time 2/s, cash bags 100 x heat, cops wrecked 50-100 x heat | 300 | Not freshly verified |
| 85 | Highway Heist | Pako Highway | Driving | A | endless | built | Distance + cops taken down 150 | 80 | Not freshly verified |
| 86 | No Brakes | Faily Brakes | Driving | A | endless | built | Distance + cars passed 10 | 80 | Not freshly verified |
| 87 | Cab Rush | Crazy Taxi | Driving | A | endless | built | Fares 50 + speed bonus; time extends per fare | 40 | Not freshly verified |
| 88 | Dirt Dash | Excitebike | Driving | A | endless | built | Distance m + clean landings 30 | 40 | Not freshly verified |
| 89 | Road Brawl | Road Rash | Driving | A | endless | built | Distance + takedowns 60-100 | 120 | Not freshly verified |
| 90 | Derby Smash | Demolition derby | Driving | A | endless | built | Impact damage dealt + wrecks 150 | 200 | Not freshly verified |
| 91 | Dunk Flick | Dunk Shot | Reflex & Skill | A | endless | built | 1 per basket, swish streak +n | 25 | Not freshly verified |
| 92 | Hoop Flap | Flappy Dunk | Reflex & Skill | A | endless | built | 1 per hoop, swish 2 x streak | 40 | Not freshly verified |
| 93 | Bat Boy | Baseball Boy | Reflex & Skill | A | endless | built | Hit distance/4, home run 100 | 80 | Not freshly verified |
| 94 | Pen Throw | Pineapple Pen | Reflex & Skill | A | endless | built | Hit 1, perfect center 3 | 10 | Not freshly verified |
| 95 | Duck Shot | Duck Hunt | Reflex & Skill | A | endless | built | Bird 100 + 20 x round, gold +400 | 400 | Not freshly verified |
| 96 | Paper Toss | Paper Toss | Reflex & Skill | A | endless | built | 1-5 per basket by wind strength | 8 | Not freshly verified |
| 97 | Skee Roll | Skee-Ball | Reflex & Skill | A | endless | built | Rings 10-100; 9-ball frames, beat the rising target to continue, frame bonus 50 x frame | 100 | Not freshly verified |
| 98 | Castle Crush | Crush the Castle | Physics & Destruction | A | endless-levels | built | Blocks 5-25, kings 300, castle bonus 500 x stones left + 200 x level | 400 | Not freshly verified |
| 99 | Neon Circuit | Original neon arcade racer | Driving | A | endless | built | Energy cells 25 + near-miss 5; score is awarded during play | 120 | Not freshly verified |
| 100 | Rift Survival | Original arena survival game | Survival & Horde | A | endless | built | Shards 25; wave transition bonus 10 × wave; survival is the primary skill loop | 180 | Not freshly verified |

## Mandatory acceptance gate

1. Desktop and mobile browsers load the game without console errors.
2. Legitimate score submission succeeds and forged score submission is rejected by the server.
3. Pause/resume, visibility changes, orientation, touch controls, restart, and end-of-run work correctly.
4. Profile actual frame time on target phones. Aim for stable 60 FPS; investigate any sustained drop below 50 FPS and reject sustained below-30 FPS.
5. Replace placeholder-looking geometry where it undermines the visual target; use original or commercially cleared models, materials, lighting, animation, VFX, and audio.
6. Capture a representative screenshot and perform side-by-side human review; visual quality must reach at least 7/10 before calling a game finished.
7. Record third-party code, art, sound, font, and trademark permissions. Attribution does not grant commercial rights.
8. Do not label a game giveaway-ready based solely on registry metadata.

## Known defects to reproduce

- Desert Dash (`dino-dash`): previous report flagged broken/undefined FPS instrumentation.
- Rail Rush, Lane Racer, and Moto Lanes: prior handoff reported low FPS; these need new profiling before fixes are declared.
- New games Neon Circuit and Rift Survival are added to the Hub library spotlight and have original SVG cover art; they have not been run in the browser or on a physical phone in this environment.

## Suggested test sequence

```sh
node tools/games-lib-integrity-audit.js
BASE=http://localhost:8795 node tools/e2e-games-lib.js neon-circuit
BASE=http://localhost:8795 node tools/e2e-games-lib.js rift-survival
BASE=http://localhost:8795 node tools/e2e-games-lib.js dino-dash,rail-rush,lane-racer,moto-lanes
```

The audit script is structural only. It does not replace E2E testing, device profiling, visual review, or legal asset review.