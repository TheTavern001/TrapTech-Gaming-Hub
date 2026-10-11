# Catalog Distinctness Decisions — Candidate Consolidation Plan

Date: 11 October 2026  
Catalog snapshot: 100 entries in `public/games-lib/catalog.json`  
Status: **PROPOSED DISPOSITION — NOT YET APPLIED**. No entries are removed by this document. Final changes require route/score/history dependency checks and play evidence.

## Product rule

A title earns a separate slot only if its main repeated decisions and controls are meaningfully different. Genre labels, themes, camera angles, vehicle skins, character skins, speed tweaks, score multipliers, and obstacle recolours do not by themselves qualify. One title per core loop; other entries must be rebuilt into genuinely distinct experiences or retired.

The target is a curated set of distinct games, not preserving the 100-entry count. Do not merge distinct games merely because they share a genre or library.

## Proposed consolidation decisions for high-risk clusters

| Cluster | Titles | Proposed action | Reason / required check |
|---|---|---|---|
| Highway traffic weaving | Moto Lanes, Throttle Rider, Lane Racer | **KEEP ONE; REBUILD or RETIRE two** | Same `racer3x.js` and near-miss highway loop. Camera and bike/car alone are not enough. Select canonical after side-by-side play. |
| 3D lane runner | Rail Rush, Ruin Runner | **KEEP ONE unless mechanics prove distinct** | Same `runner3x.js`, speed and coin settings, lane-change/jump/slide loop. Verify whether rail ramps/train interaction materially changes the decisions. |
| Shared TD path-defense | Pop Defense, Keep Guard | **REVIEW; likely KEEP ONE unless strategy differs** | Both call `td.js`; inspect map/path, tower targeting, economy, enemy counterplay, upgrades and wave design. Different art is not sufficient. |
| Top-down vehicle missions | Park Getaway, Cab Rush | **REVIEW; retain both only if mode changes core loop** | Both call `topcar.js`; getaway/cash/cops vs taxi pickup/drop-off may be distinct, but must be verified in actual play. |
| Top-down police escape | Park Getaway, Highway Heist, Most Wanted Run | **REVIEW as related but not automatically duplicate** | Compare camera, pursuit tactics, collision/risk decisions, environment navigation and objectives. 3D chase may be distinct if the decisions are. |
| General traffic driving | Lane Racer, Throttle Rider, Moto Lanes, No Brakes, Green Dash | **Compare across family; do not retain theme-only variants** | Separate traffic weaving from brakeless mountain survival and timed delivery only if their decision loops/levels are genuinely different. |
| 3D/2D running and flight | Rail Rush, Ruin Runner, Desert Dash, Roof Runner, Jet Blaster, Tunnel Hop, Green Dash, Road Hopper | **Keep only distinct movement grammars** | Lane switching/jump/slide variants compete for one identity; vertical thrust, gravity rotation, gap timing, cross-traffic pathing and delivery navigation can be distinct if central to play. |
| Survivor/horde combat | Cube Horde, Moon Swarm, Night Shift, Grid Wars, Arrow Hero, Rift Survival | **Keep distinct only with different combat/strategy loops** | Compare aim control, movement, visibility, room progression, build choices, enemy AI and objective; visual theme alone fails. |
| Tower defense | Lawn Guard, Pop Defense, Keep Guard, Node Siege | **Potentially multiple distinct titles** | Lane resource defense, fixed-path balloon defense, fantasy path defense and maze/path-blocking can be different; compare Pop Defense vs Keep Guard closely. |
| Reflex/throwing/aiming | Knife Toss, Pen Throw, Paper Toss, Cup Toss, Bat Boy, Dunk Flick, Hoop Flap, Skee Roll, Bullseye, Duck Shot | **Cluster by actual input physics and mastery** | Aiming/throwing games may differ, but reskinned swipe trajectories and simple score loops should not occupy multiple slots. Hoop Flap must be compared with Sky Flap and Dunk Flick. |
| Match/merge/board puzzles | Block Drop, Bud Merge, Hex Stack, Gem Rush, Strain Crush, Orb Coil, Bubble Pop, Tile Twin, Mine Sweep, Glow Echo, Beat Tiles, Slab Stack, Helix Drop, Color Hop | **Do not merge solely by puzzle category; flag lookalike rule systems** | Tetris-style falling blocks, merge-2048, match-3, marble chain, bubble trajectories, memory sequence and rhythm timing can be distinct. Compare Hex Stack/Block Drop and Gem Rush/Strain Crush on actual rules and board manipulation. |
| Physics construction/destruction | Sling Siege, Castle Crush, Rig Rally, Goo Tower, Wreck Ride, Hill Hauler, Egg Roll | **Likely distinct candidates; audit mechanics and polish** | Aiming structures, siege destruction, build-and-ride, elastic construction, ragdoll riding, suspension driving and balance driving differ if objectives and physics meaningfully differ. |
| Sports skill challenges | Pin Strike, Spot Kick, Putt Party, Cue Club, Long Ball, Rally Court, Ice Snipe, Reel Deal, Hoop Streak, Kickflip City, Bullseye | **Keep if simulation and decision loops differ** | Separate sport-specific control, timing, aim, spin/physics and tactical decisions; reject shallow reskins of the same launch/trajectory mechanic. |
| Cannabis-themed mini-games | Grow Op, Trim Rush, Bud Bar, Green Dash, Roll Up, Smoke Rings, Bud Sort, Pest Patrol, Cup Toss, Strain Crush | **Theme is not identity; compare each against the whole catalog** | Green Dash competes with delivery/runners; Cup Toss with throw/aim games; Strain Crush with match-3; Pest Patrol with reaction-target games. Other games need substantive unique loops. |

## Specific provisional identity decisions

### Highway traffic games
- **Do not ship all three** of Moto Lanes, Throttle Rider and Lane Racer in their current described form as separate titles.
- Choose one canonical traffic-weaving experience after direct play comparison.
- To preserve two additional slots, redesign each around a different central mechanic rather than changing the camera or vehicle. Examples of sufficiently different directions: a physics-based circuit racing game with braking, cornering, tyre grip and racing lines; a tactical pursuit/escape game with destructible routes and police coordination; or a vehicle logistics challenge built around route planning and cargo constraints. These are design directions, not implemented work.

### 3D runners
- **Do not ship both Rail Rush and Ruin Runner as separate titles** unless actual play proves the rail mechanics create sustained unique decisions.
- If consolidated, the retained game must receive the strongest art, environments, animations and encounter design from the available implementation; the retired entry must not remain reachable as a second catalog card.
- Jet Blaster, Tunnel Hop, Roof Runner and Road Hopper should be evaluated on their actual central movement mechanics rather than lumped together simply because they are endless/survival games.

### Tower defense
- Pop Defense and Keep Guard need a direct comparison. If both use the same path-defense decisions, keep one. Node Siege can remain distinct only if player-built maze routing changes strategy and enemy paths materially. Lawn Guard's resource collection/lane placement is potentially distinct.

## Candidate keep/rebuild/retire workflow

1. **Inventory dependencies before removal.** Find catalog references, launch routes, IDs, leaderboard/score records, achievements, recommendations, deep links, tests and game-specific assets.
2. **Collect comparable evidence.** Same viewport/device, first 5 minutes, one loss/restart, a longer session, and a score submission. Capture video/screenshots and note controls and decisions.
3. **Score each pair.** Core verbs, decision loop, objective/fail states, spatial structure, challenge grammar, progression, mastery, visual identity, and code/asset overlap. Any high-risk pair needs human adjudication.
4. **Choose one canonical implementation per duplicate cluster.** Use gameplay quality, stability, depth, originality, visual quality and mobile controls—not the most popular title reference.
5. **Retire cleanly.** Remove the retired entry from the active catalog and all active navigation/competition paths. Preserve historic scores and show a retired/unavailable state for old links; never silently reassign a score to another game.
6. **Rebuild genuinely distinct alternatives.** Write a one-page game design specification before coding: unique player verbs, unique decision loop, unique objectives, unique encounter/level grammar, and unique visual direction.
7. **Run regression.** Catalog count and all references consistent; active game routes work; score submission bound to stable game ID; retired games cannot be selected for new giveaways; existing historical records remain readable.
8. **Human sign-off.** Desktop + Android evidence, visual/audio scorecard, performance, exploit checks, rights/provenance. Untested is not PASS.

## What remains unverified

This is a proposal based on catalog metadata and selected source inspections, not the final all-pairs audit. Every cluster must be checked against complete implementation and observed gameplay. The proposed keep/retire choices must not be treated as executed changes. No title has been removed by this document.