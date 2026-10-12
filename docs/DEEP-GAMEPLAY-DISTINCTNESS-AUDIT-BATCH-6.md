# Additional source-level AAA/gameplay audit — batch 6

**Branch:** `games/deep-distinctness-audit`  
**Scope:** targeted source inspection of shooter and physics-defense families, based on checked-in source only. This is not gameplay certification.

## 1. Bug Blaster vs Alien Rows vs Star Swarm

### Source evidence
- `public/games-lib/bug-blaster/game.js` describes a mushroom-field segment shooter, with a grid of destructible mushrooms, segmented centipede-style enemies, a player restricted to the bottom zone, a single active shot and auto-fire while touch is held.
- `public/games-lib/alien-rows/game.js` describes a marching-invader shooter with rows/waves, player movement along the lower field, auto-fire on touch, multiple shots/bombs and a UFO bonus.
- `public/games-lib/star-swarm/game.js` describes a formation shooter with original pixel enemy maps, wing-flap frames, diving enemy patterns and stage progression.

### Disposition
**Keep as distinct candidates, pending actual play verification.** Bug Blaster's mushroom/segmented-enemy field and constrained firing lane differs from Alien Rows' marching formations and Star Swarm's diving-formation attack patterns. Theme alone is not the distinction; each game's enemy movement and spatial pressure should be validated on screen.

### Acceptance test required
- Verify the centipede segments turn correctly around mushroom obstacles and the player can read/counter threats.
- Verify Alien Rows' formation descent, bombs, UFO, wave pacing and collision fairness.
- Verify Star Swarm's dive paths, attack telegraphs, collision windows and return-to-formation logic.
- Record at least three waves/stages, game-over/restart, scoring, touch controls and a representative mobile performance trace for each.
- Check asset attribution/provenance; comments claim Kenney CC0 for Alien Rows and original maps for Star Swarm, but repository comments alone are not a complete asset-rights audit.

## 2. Pop Defense vs Keep Guard

### Source evidence
- `public/games-lib/pop-defense/game.js` explicitly uses the shared `td.js` tower-defense engine and a balloon/path-defense theme, with Kenney Tower Defense CC0 art plus code-drawn road, balloons and UI.
- `public/games-lib/keep-guard/game.js` also explicitly uses `td.js`, with a fantasy path-defense theme and code-drawn towers, raiders and forest map.

### Disposition
**High-overlap pair; distinctness not proven by the shared engine or theme.** Both could be distinct if tower roles, target priorities, upgrade/economy decisions, enemy resistances, map topology, wave composition and progression create meaningfully different decisions. Painterly vector art versus sprites is a presentation difference, not sufficient by itself.

### Acceptance test required
Build a side-by-side mechanic matrix from the actual runtime: tower roster/roles, cost/upgrades, target rules, enemy traits, wave composition, path topology, player decisions per minute, win/fail conditions and progression. Play at least five waves in each and confirm no tower/economy exploits or pathing bugs. If the decision grammar is substantially the same, consolidate only after stable IDs, score/event records, URLs and analytics consumers are mapped.

## 3. Sling Siege vs Castle Crush

### Source evidence
- `public/games-lib/sling-siege/game.js` uses Matter.js through `phys.js`, drag-back/release projectile input, material-dependent block values/HP/density, generated forts and unused-shot scoring.
- `public/games-lib/castle-crush/game.js` also uses Matter.js through `phys.js`, drag-back/release from a trebuchet, procedural forts, break callbacks and crowned-king targets.

### Disposition
**Strong overlap; retain provisionally until the physics/encounter loops are compared in a running browser.** The source confirms the same broad verb (pull/release projectile to destroy a physics fort), shared physics foundation and procedural destruction loop. Differences in target objective, material interactions, projectile limits, fort generation and campaign structure must be substantial and consistent to justify two entries.

### Acceptance test required
Compare trajectory control, projectile count, material HP/weight, structural collapse, fort generation, target placement, level/campaign structure, score/unused-ammo incentives, restart/undo behavior and mobile drag handling. Test seeded levels and edge cases (drag outside canvas, background tab, rapid restart, slow-motion collision chains). Do not retire either ID until score/history/deep-link dependencies and a legacy-ID experience are documented.

## 4. Source-level visual quality limitations observed

- These reviewed games are canvas-rendered 2D games, with sprites or code-drawn art. That can support polished arcade visuals but does not establish AAA 3D rendering.
- The source comments identify some art provenance, but that is not a substitute for a repository-wide asset/license manifest.
- Code inspection cannot prove actual sprite loading, readable UI at phone size, responsive input, animation smoothness, audio mix, color accessibility, memory stability or actual playability.
- No quality grade is assigned in this batch. A final rating must be tied to a build hash and visual/gameplay/performance evidence.

## 5. Branch-wide CI blocker

The latest checked commit `5dcb0226b81f9265737629b134884ab1802ecb8c` triggered failures in:
- Games Library static checks
- Games Library browser smoke tests
- V1 launch syntax checks

The GitHub run/job metadata returned completed failures but empty step arrays; log download returned a storage `BlobNotFound` response. This leaves the cause unknown. Next action is to retrieve working Actions logs or reproduce the three workflows from an actual checkout, then fix demonstrated failures and rerun. A documentation-only commit must not be described as having fixed these failures.

## Batch 6 outcome

- Added source-backed distinctions and explicit test gates for three shooter games, the shared-engine defense pair and the shared-physics siege pair.
- No game was removed or score/ID mapping changed.
- Full pairwise audit, complete asset rights review, runtime testing, CI repair and release signoff remain incomplete.
