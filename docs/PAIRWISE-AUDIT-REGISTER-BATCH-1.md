# Pairwise Audit Register — First Source-Verified Batch

This register is deliberately evidence-based. “High overlap” means source/config inspection shows the same engine and substantially the same control/objective loop; it is not a claim that every moment of the games has been human-play-tested. The audit remains open for all uninspected pairs.

## Scoring legend

- **Core loop**: 0 unrelated, 1 broad genre only, 2 some shared decisions, 3 substantially similar loop, 4 effectively same loop.
- **Control grammar**: 0 unrelated, 1 broad controls overlap, 2 some overlap, 3 mostly same, 4 same.
- **Objective/fail loop**: same scale.
- **Implementation overlap**: same scale.
- **Disposition**: PROVISIONAL until gameplay video/device evidence and route/score dependency checks are attached.

| Pair / family | Core loop | Controls | Objective/fail | Implementation | Evidence | Provisional disposition |
|---|---:|---:|---:|---:|---|---|
| Moto Lanes ↔ Throttle Rider | 4 | 4 | 4 | 4 | Both import `racer3x.js`, `bike:true`, traffic weaving, near-miss/overtake scoring. Config changes fpv, speed and vmax. | **CONSOLIDATE TO ONE** unless observed differences prove otherwise. |
| Moto Lanes ↔ Lane Racer | 4 | 4 | 4 | 4 | Both import `racer3x.js`; same four-lane one-way traffic and chained near-miss loop; bike/car and speed differ. | **CONSOLIDATE TO ONE** unless observed differences prove otherwise. |
| Throttle Rider ↔ Lane Racer | 4 | 4 | 4 | 4 | Same shared engine, steering grammar and near-miss scoring; first-person camera/bike vs chase camera/car. | **CONSOLIDATE TO ONE** unless observed differences prove otherwise. |
| Rail Rush ↔ Ruin Runner | 4 | 4 | 4 | 4 | Both import `runner3x.js`, speed 15, coinV 10; lane changes, jump, roll/slide; only theme/help text visibly differ in wrapper configs. | **CONSOLIDATE TO ONE** unless observed level mechanics prove otherwise. |
| Park Getaway ↔ Cab Rush | 2 | 3 | 1 | 4 | Same `topcar.js`; engine explicitly defines different modes. Getaway: bags + escalating police chase; taxi: pickup/drop-off, fare timer and route efficiency. | **KEEP BOTH — DISTINCT candidate**, subject to playtest; same engine is not enough to retire. |
| Park Getaway ↔ Derby Smash | 1 | 3 | 1 | 4 | Same `topcar.js`, but getaway collects bags/evades police while derby rams rival cars and manages impact damage/health. | **KEEP BOTH — DISTINCT candidate**, subject to playtest. |
| Lawn Guard ↔ Pop Defense | TBD | TBD | TBD | 2 | Need compare individual modules, not infer from category. Lawn Guard appears to use its own lane/sun loop; Pop Defense uses `td.js`. | **OPEN**. |
| Pop Defense ↔ Keep Guard | 3 | 3 | 3 | 4 | Both call `td.js` path mode and share tower placement/upgrades/waves. Actual tower roster, enemy behaviours, map shape and economy need side-by-side inspection. | **HIGH-PRIORITY HUMAN REVIEW**; keep both only with strategic evidence. |
| Node Siege ↔ Pop Defense | 2 | 2 | 2 | 3 | Same `td.js` foundation, but Node Siege uses maze mode where towers block tiles and enemies reroute with BFS. | **KEEP DISTINCT candidate** if path-blocking materially affects play. |
| Jet Blaster ↔ Rail Rush | 1 | 1 | 2 | 1 | Jet Blaster uses `Kit.run` vertical thrust/gravity, zappers and warned missiles; Rail Rush uses 3D lane changes/jumps/slides. | **KEEP BOTH — DISTINCT candidate**; improve art/depth independently. |
| Tunnel Hop ↔ Rail Rush | 1 | 2 | 2 | 1 | Tunnel Hop rotates gravity / changes surfaces into floors; Rail Rush uses discrete lanes and jump/slide. | **KEEP BOTH — DISTINCT candidate** if gravity rotation is central and reliably playable. |
| Roof Runner ↔ Rail Rush | 2 | 2 | 2 | 1 | Roof Runner uses one-button variable jump/gap timing; Rail Rush uses lane selection plus jump/slide. | **KEEP BOTH — DISTINCT candidate** if the gap-timing loop is deep enough. |
| Hill Glider ↔ Dune Glide | 2 | 2 | 2 | 2 | Hill Glider's own `Kit.run` loop uses hold-to-dive/release-on-upslope; Dune Glide uses `hillcar.js`, auto speed and jump/backflip/landing. | **KEEP BOTH — DISTINCT candidate**; verify the flight/landing decision loop in play. |
| Cube Horde ↔ Moon Swarm | TBD | TBD | TBD | 2 | Both use shared `arena.js`, but one is 3D voxel zombie wave arena and the other pixel-art survivor roguelite; need inspect controls, targeting, build/progression and enemy pressure. | **OPEN**; shared engine/theme family alone is not enough. |
| Gem Rush ↔ Strain Crush | TBD | TBD | TBD | TBD | Catalog references Bejeweled vs match-3; inspect actual board rules and implementation. If both use adjacent-swap match-three with no substantial strategic difference, consolidate. | **OPEN — HIGH PRIORITY**. |
| Sky Flap ↔ Hoop Flap | TBD | TBD | TBD | TBD | Catalog references Flappy Bird vs Flappy Dunk. Need inspect whether hoop/ball physics and aiming create a distinct repeated decision or merely reskin gate passing. | **OPEN — HIGH PRIORITY**. |
| Dunk Flick ↔ Hoop Streak | TBD | TBD | TBD | TBD | Both basketball scoring families; compare trajectory control, moving targets, rebound/position decisions and attempt structure. | **OPEN — HIGH PRIORITY**. |
| Paper Toss ↔ Cup Toss | TBD | TBD | TBD | TBD | Both swipe-throw trajectory games; compare wind/obstacles, aiming model, object physics and progression. | **OPEN — HIGH PRIORITY**. |
| Green Dash ↔ Cab Rush | 1 | 2 | 2 | 1 | Green Dash is a delivery scooter loop; Cab Rush is a timed pickup/drop-off route loop. | **KEEP BOTH — DISTINCT candidate** if delivery/drop zones and traffic decisions are actually different. |
| Sling Siege ↔ Castle Crush | TBD | TBD | TBD | TBD | Both projectile-driven destruction references; inspect whether aim/release physics, structure design, materials and level objectives are materially distinct. | **OPEN — HIGH PRIORITY**. |

## Confirmed implementation facts in this batch

1. `public/games-lib/rail-rush/game.js` and `ruin-runner/game.js` are short wrappers around the same `RailRunner` function with the same speed and coin value. Their visible configuration difference is primarily theme/help copy.
2. `moto-lanes/game.js`, `throttle-rider/game.js`, and `lane-racer/game.js` all call the same `Racer` function in `racer3x.js`; the loop is described by the engine as continuous steering, four lanes of one-way traffic, and near-miss combos.
3. `topcar.js` supports explicit modes `getaway`, `derby`, and `taxi` with different objectives. This is a useful counterexample: sharing a rendering/physics engine is not itself proof of duplicate gameplay.
4. `td.js` explicitly supports fixed-path and maze modes. Maze mode blocks placement tiles and recalculates enemy routing with BFS; this can be a genuine strategic distinction if the game config and map make it matter.

## Actions required before retiring the first cluster

- Inspect active catalog IDs/URLs and how the server resolves `game.id`; never reuse a retired ID.
- Check active giveaway creation and score submission so retired games cannot be newly selected while old scores remain visible.
- Select the best runner and racer by observed input reliability, level/encounter variation, art/animation/audio, performance, and score integrity—not title alone.
- Keep a retirement alias/landing page for old URLs that explains the title is consolidated and links to the retained title; don't silently route old score submissions into a different game.
- Add regression tests for catalog uniqueness and retired game eligibility.

## Status

**Partial source audit, not a completed all-pairs matrix.** The catalog contains 100 titles, so there are 4,950 unique unordered pairs. This register is an evidence-backed starting subset, not a claim that all 4,950 pairs have been manually reviewed.