# Library game status (rewritten 2026-10-17 ~9:20 PM ET; updated 2026-10-23)

> **Latest verification (2026-10-22/23):** `tools/e2e-games-lib.js` on all 74 games live at the time (desktop + iPhone
> emulation, legit score accepted, forged score rejected, no console errors): 71 pass; Rail Rush passes after the CSP fix;
> open items are Cube Horde (~180k triangles, over the 150k phone budget) and Throttle Rider (mobile start under software
> WebGL, needs a real-phone check). Alien Rows and Hex Stack are now retired, leaving **72 live library games**. Every library
> game now has an on-screen pause button (Resume / Settings / Exit). See docs/AAA-FULL-AUDIT.md.

Branch: v8-games-upgrade (never main). Classification key:
- REBUILT: new gameplay + art.  ART-REBUILT: new rendering/art on the same core loop.
- ART-UPGRADED: original scenery and/or original sprites/characters added (drawn in code, no third-party assets beyond the Kenney CC0 already credited); mechanic unchanged.
- JUICE-ONLY: layout fix + shared juice layer (particles, hit-stop, vignette, procedural music); no new art.
Signed-in verified = POST /api/run/start + score submit returned ok:true on a local server with a test account (these are NOT held/verified runs: `verified:false` is the server's anti-cheat flag for bot runs).
Caveats: fill-game sprites/scenery were verified by 390x780 Playwright screenshots; fps measured only under software GL. test-game-source-mechanics cannot run (truncated audit JSON); no achievement-reward test file exists; CORRECTION: invite-only giveaway audience IS implemented (src/brands.js etc.); tools/test-audience-v8.js = 26 passed / 0 failed on the rc tree built from systems HEAD 6ec12d0. The earlier 'not implemented' claim came from a stale local clone.

| Game | Audit tier | Status (honest) | Signed-in submit verified |
|---|---|---|---|
| block-drop | 2 / REPLACE | ART-UPGRADED (overlay: bud-bot mascot + pixel sparks, in game.js) - overlays verified by 390x780 screenshot, 0 page errors; signed-in score submit last run before overlays | yes (ok:true, local test account) |
| maze-muncher | 3 / UPGRADE ART | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| alien-rows | 2 / REPLACE | **RETIRED 2026-10-23** (owner: same loop as Star Swarm; scores archived, giveaways moved) | - |
| cloud-hopper | 3 / UPGRADE ART | ART-UPGRADED (overlay art.js: balloon, birds, sparkles) - overlays verified by 390x780 screenshot, 0 page errors; signed-in score submit last run before overlays | yes (ok:true, local test account) |
| road-hopper | 3 / UPGRADE ART | JUICE-ONLY (sky props tried, not visible from the top-down camera; reverted) - overlays verified by 390x780 screenshot, 0 page errors; signed-in score submit last run before overlays | yes (ok:true, local test account) |
| bud-merge | 1 / REPLACE | REBUILT (gameplay + art) | yes (ok:true, local test account) |
| hex-stack | 2 / REPLACE | **RETIRED 2026-10-23** (owner: same loop as Block Drop; scores archived, giveaways moved) | - |
| dino-dash | 1 / REPLACE | REBUILT (gameplay + art) | yes (ok:true, local test account) |
| rock-buster | 2 / REPLACE | ART-UPGRADED (overlay art.js: freighter + tumbling astronaut) - overlays verified by 390x780 screenshot, 0 page errors; signed-in score submit last run before overlays | yes (ok:true, local test account) |
| star-swarm | 2 / REPLACE | ART-UPGRADED (overlay art.js: ringed planet, comets, station) - overlays verified by 390x780 screenshot, 0 page errors; signed-in score submit last run before overlays | yes (ok:true, local test account) |
| rail-rush | 4 / KEEP+polish | JUICE-ONLY (canyon framing hides sky; props not added) - overlays verified by 390x780 screenshot, 0 page errors; signed-in score submit last run before overlays | yes (ok:true, local test account) |
| hill-hauler | 2 / REPLACE | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| wanted-run | 3 / UPGRADE ART | JUICE-ONLY (sky/heli props tried, not visible; reverted) - overlays verified by 390x780 screenshot, 0 page errors; signed-in score submit last run before overlays | yes (ok:true, local test account) |
| pop-defense | 3 / UPGRADE ART | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| cube-horde | 2 / REPLACE | REBUILT (gameplay + art) | yes (ok:true, local test account) |
| arrow-hero | 2 / REPLACE | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| grid-wars | 2 / REPLACE | ART-UPGRADED (overlay art.js: sentinel pylons + radar ripple) - overlays verified by 390x780 screenshot, 0 page errors; signed-in score submit last run before overlays | yes (ok:true, local test account) |
| moon-swarm | 2 / REPLACE | ART-UPGRADED (overlay art.js: owl, fog, fireflies) - overlays verified by 390x780 screenshot, 0 page errors; signed-in score submit last run before overlays | yes (ok:true, local test account) |
| throttle-rider | 4 / KEEP+polish | ART-UPGRADED (small: procedural clouds + hot-air balloon at horizon via sky3d.js) - overlays verified by 390x780 screenshot, 0 page errors; signed-in score submit last run before overlays | yes (ok:true, local test account) |
| goo-tower | 2 / REPLACE | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| keep-guard | 2 / REPLACE | REBUILT (gameplay + art) | yes (ok:true, local test account) |
| node-siege | 2 / REPLACE | REBUILT (gameplay + art) | yes (ok:true, local test account) |
| orb-coil | 4 / KEEP+polish | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| neon-flipper | 4 / KEEP+polish | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| light-cycle | 3 / UPGRADE ART | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| roof-runner | 2 / REPLACE | REBUILT (gameplay + art) | yes (ok:true, local test account) |
| helix-drop | 3 / UPGRADE ART | ART-REBUILT (new render/art, same core mechanic) | yes (ok:true, local test account) |
| hex-spin | 3 / UPGRADE ART | ART-REBUILT (new render/art, same core mechanic) | yes (ok:true, local test account) |
| color-hop | 3 / UPGRADE ART | ART-REBUILT (new render/art, same core mechanic) | yes (ok:true, local test account) |
| zig-path | 2 / REPLACE | REBUILT (gameplay + art) | yes (ok:true, local test account) |
| missile-guard | 3 / UPGRADE ART | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| bug-blaster | 2 / REPLACE | REBUILT (gameplay + art) | yes (ok:true, local test account) |
| bubble-pop | 3 / UPGRADE ART | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| mine-sweep | 1 / REPLACE | REBUILT (gameplay + art) | yes (ok:true, local test account) |
| knife-toss | 3 / UPGRADE ART | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| mole-whack | 3 / UPGRADE ART | ART-REBUILT (new render/art, same core mechanic) | yes (ok:true, local test account) |
| grow-op | 2 / REPLACE | REBUILT (gameplay + art) | yes (ok:true, local test account) |
| trim-rush | 2 / REPLACE | REBUILT (gameplay + art) | yes (ok:true, local test account) |
| strain-crush | 3 / UPGRADE ART | ART-REBUILT (new render/art, same core mechanic) | yes (ok:true, local test account) |
| bud-bar | 3 / UPGRADE ART | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| green-dash | 2 / REPLACE | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| roll-up | 3 / UPGRADE ART | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| smoke-rings | 2 / REPLACE | ART-UPGRADED (overlay art.js: lava lamp, bonsai, smoke) - overlays verified by 390x780 screenshot, 0 page errors; signed-in score submit last run before overlays | yes (ok:true, local test account) |
| bud-sort | 3 / UPGRADE ART | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| pest-patrol | 3 / UPGRADE ART | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| cup-toss | 4 / KEEP+polish | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| beat-tiles | 2 / REPLACE | ART-UPGRADED (overlay art.js: stage lights, notes, speakers) - overlays verified by 390x780 screenshot, 0 page errors; signed-in score submit last run before overlays | yes (ok:true, local test account) |
| moon-lander | 3 / UPGRADE ART | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| pin-strike | 4 / KEEP+polish | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| bullseye | 4 / KEEP+polish | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| spot-kick | 4 / KEEP+polish | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| glow-echo | 2 / REPLACE | ART-UPGRADED (overlay art.js: 4 echo ghosts + equalizer) - overlays verified by 390x780 screenshot, 0 page errors; signed-in score submit last run before overlays | yes (ok:true, local test account) |
| knockout | 4 / KEEP+polish | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| putt-party | 3 / UPGRADE ART | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| cue-club | 4 / KEEP+polish | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| long-ball | 4 / KEEP+polish | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| rally-court | 4 / KEEP+polish | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| ice-snipe | 4 / KEEP+polish | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| reel-deal | 4 / KEEP+polish | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| hoop-streak | 4 / KEEP+polish | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| kickflip-city | 3 / UPGRADE ART | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| tile-twin | 3 / UPGRADE ART | ART-REBUILT (new render/art, same core mechanic) | yes (ok:true, local test account) |
| tunnel-hop | 3 / UPGRADE ART | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| no-brakes | 3 / UPGRADE ART | ART-REBUILT (new render/art, same core mechanic) | yes (ok:true, local test account) |
| cab-rush | 2 / REPLACE | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| dirt-dash | 2 / REPLACE | REBUILT (gameplay + art) | yes (ok:true, local test account) |
| road-brawl | 2 / REPLACE | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| derby-smash | 2 / REPLACE | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| dunk-flick | 2 / REPLACE | REBUILT (gameplay + art) | yes (ok:true, local test account) |
| duck-shot | 2 / REPLACE | REBUILT (gameplay + art) | yes (ok:true, local test account) |
| paper-toss | 3 / UPGRADE ART | ART-REBUILT (new render/art, same core mechanic) | yes (ok:true, local test account) |
| skee-roll | 4 / KEEP+polish | ART-REBUILT (new render/art, same core mechanic) | yes (ok:true, local test account) |
| neon-circuit | 3 / UPGRADE ART | ART-UPGRADED (new scenery and/or original sprites; mechanic unchanged) | yes (ok:true, local test account) |
| rift-survival | 2 / REPLACE | REBUILT (gameplay + art) | yes (ok:true, local test account) |
| wreck-ride | - | ARCHIVED (retired alias, not playable) | n/a (retired) |
| rig-rally | - | ARCHIVED (retired alias, not playable) | n/a (retired) |
| drift-king | - | ARCHIVED (retired alias, not playable) | n/a (retired) |
| dune-glide | - | ARCHIVED (retired alias, not playable) | n/a (retired) |
| egg-roll | - | ARCHIVED (retired alias, not playable) | n/a (retired) |
| monster-crush | - | ARCHIVED (retired alias, not playable) | n/a (retired) |
| brick-breaker (core) | 3 / UPGRADE ART | CORE - other executor | n/a |
| drift-rush (core) | 3 / UPGRADE ART | CORE - other executor | n/a |
| grow-guard (core) | 3 / UPGRADE ART | CORE - other executor | n/a |
| haze-defense (core) | 3 / UPGRADE ART | CORE - other executor | n/a |
| high-score (core) | 3 / UPGRADE ART | CORE - other executor | n/a |
| jetpack-dash (core) | 3 / UPGRADE ART | CORE - other executor | n/a |
| memory-match (core) | 3 / UPGRADE ART | CORE - other executor | n/a |
| munchies-snake (core) | 3 / UPGRADE ART | CORE - other executor | n/a |
| sky-hopper (core) | 3 / UPGRADE ART | CORE - other executor | n/a |
| sling-smash (core) | 3 / UPGRADE ART | CORE - other executor | n/a |
| stack (core) | 3 / UPGRADE ART | CORE - other executor | n/a |
| terp-tapper (core) | 3 / UPGRADE ART | CORE - other executor | n/a |
| void-swarm (core) | 3 / UPGRADE ART | CORE - other executor | n/a |

---
## PROGRESS NOTES (updated 4:59 PM ET Sat Oct 17) - honest classification
Remote head v8-games-upgrade = e742f81 (verified via connector list_commits). All local edits below are already pushed.

### Shared juice layer (kit.js, pushed bc4379c): MAJOR UPGRADE (FX/audio only, NO new art)
Opt-in allowlist of 64 games: sparks+rings on bursts, hit-stop, vignette, fade-in, procedural music bed. Gameplay untouched.
### Real art / gameplay rebuilds this session (pushed, Playwright 390x780, bot-played, no page errors)
- REBUILT (art+layout): color-hop, drift-king (+ fair 0.5s start), helix-drop (3D tower, landing-side fix), hex-spin, zig-path (art + fixed a fatal gap in the start path), no-brakes (carart), paper-toss (office scene), mole-whack (4 rows, new critters), skee-roll (arcade lane), strain-crush (full height 8x13, new gems), tile-twin (scaled full height)
- cloud-hopper: already Kenney CC0 art; fill fix + juice only (MAJOR UPGRADE = juice, not rebuilt). tunnel-hop: gradient tiles/runner sprite/glow + juice (partial art upgrade).
- rift-survival registry+catalog text fixed (8f5f36b).
- index.html viewport meta pushed for ~47 games.
### STILL LAYOUT-ONLY + JUICE (no new art): ~30 fill games (cue-club, bullseye, bubble-pop, etc.), cube-horde, goo-tower, green-dash, road-brawl, cab-rush, derby-smash, hill-hauler, wreck-ride, rig-rally, neon-circuit, pop-defense.
### Signed-in score-submit check (local server, throwaway DB): 22 ok earlier; rest PENDING (see /tmp/auth_results*.txt)
### TODO: wreck-ride/rig-rally/neon-circuit scripted play; cube-horde/goo-tower/vehicle art; remaining signed-in checks.

### 5:10PM: signed-in verification run paused (killed) to free browser for cube-horde rebuild. Results so far in /tmp/auth_results.txt (+2). Resume later with TODO list.

### 5:30PM cube-horde REBUILT (zombie-cubes-style: weapons/grenades/barrels/boss/upgrades), signed-in submit verified ok (pushed 447d188). Resumed signed-in sweep -> /tmp/auth_results3.txt

### 5:58PM signed-in sweep result (local server, qa_tester_1): 68 of 74 recorded games ok:true (points awarded, no rejection). 
- NOT ok = 6 RETIRED duplicate slugs (registry playable=false, server answers 'That game is not playable yet.' by design): drift-king, dune-glide, egg-roll, monster-crush, rig-rally, wreck-ride (aliases of hill-hauler / drift-rush). => my drift-king rebuild + wreck-ride/rig-rally checks are moot: those pages are archived; hill-hauler is the live game.
- 4 timed-out/unparsed (re-run pending): helix-drop, hex-stack, strain-crush, zig-path. duck-shot recorded earlier.
- cube-horde: grep confirms NO external assets (no Image/GLTF/Audio/fetch); all geometry code-built, SFX WebAudio. Credits recorded in cube-horde/CREDITS.md.
- 5:5xPM re-run ok:true: helix-drop, zig-path (+strain-crush/hex-stack see below)

## 6:20 PM ET note
- goo-tower: art-upgraded (vivid glossy green goo, glowing strands, glow halo); Playwright 390x780 ok, 0 errors; pushed a4c78ef.
- Signed-in submit ok:true: helix-drop, zig-path, strain-crush, hex-stack (bot scored 0, submit accepted), duck-shot (30140). Sweep now 73/74 ok + 6 retired (not playable by design).
- STILL layout+juice only (no new art): green-dash, road-brawl, cab-rush, derby-smash, hill-hauler, neon-circuit, pop-defense, ~30 fill games.

## 6:25 PM ET note (vehicle batch, pushed 5fc8dab)
- green-dash: art-upgraded: new original delivery-scooter sprite (cargo box, rider, helmet) + city roadside (shops, awnings, lamps). 390x780 ok, 0 errors.
- road-brawl: art-upgraded: desert roadside (cacti, rocks). 390x780 ok, 0 errors.
- cab-rush: art-upgraded (modest): street-light glow pools at intersections via topcar.js. 390x780 ok. Bot scored 0 (swipe bot doesn't do fares) so play loop only smoke-tested.
- derby-smash: art-upgraded (modest): crowd stands + floodlights outside the arena (only at arena edge, not visible in mid-arena shot). 390x780 ok.
- Honest: cab-rush/derby-smash changes are environment-only; cars are still the shared CarArt sprites.

## 6:45 PM ET note (pushed ee37e06)
- cab-rush / derby-smash: carart.js taxi kind now has checker side stripes + lit TAXI roof-sign box + plate; derby kind has rust/dents/scratches, roll-cage bars, big numbered roundel (per-colour seed). Sprite sheet screenshot checked; both games load with 0 errors. Still the shared CarArt module (sprites are kind-specific, not per-game files).
- neon-circuit: art-upgraded: new rear-view synthwave car sprite (traffic + player w/ wings, tail lights, thrusters). 390x780 ok. Bot: lane taps, game runs/no errors but score stays 0 (score only from energy cells; bot doesn't aim) - weak scripted check.
- hill-hauler: scripted play (hold GAS 25s) reached score 549 then game over, 0 errors. NO new art added (existing Kenney coins + code-drawn buggy/terrain already rich) - still counts as layout+juice.
- pop-defense: layered balloons (inner-layer balloons peek out, star on high layers). Wave-1 only in my screenshot, so new look NOT visually verified; no errors.

## 7:00 PM ET note
- pop-defense: balloons VISUALLY VERIFIED at wave 15 via test hook (g.wave/g.wt): layered balloons + stars render, 0 errors.
- cab-rush / derby-smash: in-play screenshots at 390x780 confirmed (taxi checker/roof sign; derby crowd stands + numbered car), 0 errors.
- hill-hauler: art-upgraded: snow-cap mountains, parallax pine forest, birds, grass/flowers/rocks/fence props, buggy w/ number roundel, spare tire, bull bar, light bar, mud. In-play screenshot ok, 0 errors.

## 7:25 PM ET note (fill games 1-4 art-upgraded, pushed)
- cue-club: woven felt texture, spotlight, brass pocket rings, rail wood grain. bullseye: sun rays, mow stripes, hay bales, flags. bud-bar: pendant lamps w/ glow, bottle shelves, brass rails, wood grain. bubble-pop: aurora, stars, neon skyline. All 390x780 screenshot-verified, 0 errors. (Backdrop/environment art only; gameplay objects unchanged.)

## 7:50 PM ET note (fill games 5-8 art-upgraded, pushed)
- bud-sort (pipes, valves, hazard-stripe floor, lamps), cup-toss (string lights, brick wall, felt grain), hoop-streak (hanging jumbotron, plank grain, key paint, logo), ice-snipe (banners, scoreboard cube, haze). 390x780 screenshots ok, 0 errors. Backdrop/environment art; gameplay objects unchanged.

## 8:10 PM ET note (fill games 9-10 art-upgraded, pushed)
- kickflip-city: scrolling graffiti wall, hydrants, paving seams, curb highlight. knife-toss: plank wall w/ knots, stage curtains, spotlight cone, sawdust floor. 390x780 ok, 0 errors.
- First 10 fill games done: cue-club, bullseye, bubble-pop, bud-bar, bud-sort, cup-toss, hoop-streak, ice-snipe, kickflip-city, knife-toss. (All environment/backdrop art; sprites/gameplay objects unchanged.)
- Remaining fill games (~20): knockout, light-cycle, long-ball, maze-muncher, missile-guard, moon-lander, neon-flipper, orb-coil, pest-patrol, pin-strike, putt-party, rally-court, reel-deal, roll-up, spot-kick, arrow-hero, ...

## 8:40 PM ET note (fill batch A pushed 8b00c99 + next)
- Added a Kit.run draw-hook overlay (original code) to: knockout (crowd camera flashes, swinging ring bell, arena lights), light-cycle (neon pylons, patrol drone), long-ball (blimp, dancing leaf mascot), maze-muncher (drifting leaf sprites, vignette - scenery only), missile-guard (helicopter, radar dish), moon-lander (rover, satellite), neon-flipper (animated drain-guardian alien), orb-coil (butterflies, fireflies). All 390x780 screenshot-verified, 0 errors.

## 9:05 PM ET note (fill batch B pushed 11c4856 + follow-up)
- Overlay sprites/scenery added & screenshot-verified (0 errors): pin-strike (animated overhead pin monitor, neon strips), putt-party (gnome, bees, dandelion fluff), rally-court (umpire chair+umpire, ball kid), reel-deal (seagull, jellyfish, sea turtle), roll-up (brass lighter w/ flame, bud jar, paper pack), spot-kick (referee, photographers w/ flashes, corner flag), arrow-hero (torch flames, bats, cobwebs), pest-patrol (grow lamp cone, moths, gecko).



---
## Final stretch notes (Oct 17, 2026, ~8:50 PM ET)
- Pushed: block-drop 8951c54; rock-buster+grid-wars 4068d3b; star-swarm+moon-swarm d8a9dbb; glow-echo+beat-tiles 6d4b892; smoke-rings+cloud-hopper 2b6c169; throttle-rider+sky3d.js 618a499. The 8 overlay games ship art.js + index.html loading it before game.js (game.js unchanged).
- road-hopper, wanted-run, rail-rush: no visible upgrade shipped (tried; not visible/obstructive); still JUICE-ONLY.
- RC check (reconstructed tree, NOT exact remote head): Node 20.19.2 + Dockerfile command (heap 72MB flags) starts; server RSS 105 MB idle -> 117 MB after smoke + 300 page requests (<128 MB). Signed-in HTTP smoke: 80/80 library pages + scripts load and parse (9 ES modules node --check OK). Core: 13 listed, 13 playable, 8 module+card OK; the 5 'missing' core card images were an rc-tree artifact: /assets/cards/v7/*.svg exist on the branch, but 4 games' files (void-swarm, grow-guard, sling-smash, haze-defense, both sizes) were corrupt (tool-truncation marker inside the base64) and are now replaced with original vector cards (f6c5c68, 34a535c); stack.svg/stack-tall.svg were valid. All 106 card/art URLs from /api/games and /api/games-lib return 200.
- Not run in a browser: signed-in full-page load of every game (only the 13 changed this turn were screenshotted).
