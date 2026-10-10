# AAA Rebuild Program — The Gaming Hub

## Objective

Rebuild the full library, including games already listed in `src/games-lib.js`. Existing game entries are not grandfathered in: if the core mechanic, visual quality, mobile controls, frame time, or rights clearance cannot meet the acceptance gate, replace the game with a new original or commercially cleared title. A count of games is not a substitute for quality.

## Acceptance gate (required for every game)

### Visual quality
- Cohesive art direction: no default rectangles, crude low-detail primitives, or temporary placeholder assets in the final build.
- A deliberate scene composition, readable silhouettes, layered background, high-quality materials/textures where appropriate, lighting/shadows where affordable, animated characters/vehicles, responsive particles and impact effects.
- Polished title screen, pause/resume, score/HUD, game-over state, restart flow, audio feedback and transitions.
- Original or commercially cleared code, art, fonts, sound, models and animations. Record exact source and license; attribution is not a rights grant.

### Performance
- Target stable 60 FPS on a representative mid-range phone.
- Use frame-time percentiles (not just a single average FPS number): P95 frame time should normally stay at or below 16.7 ms; sustained P95 above 20 ms is a tuning blocker; sustained frame times above 33.3 ms fail.
- Mobile DPR should be adaptive; avoid rendering a large 3D scene at maximum device pixel ratio by default.
- For Three.js/WebGL games, measure draw calls, triangle count, texture memory where available, shader compile stutter, garbage-collection spikes, and scene-update time.
- For Canvas games, measure update/draw time, particle counts, overdraw, blur/shadow use, and resize behavior.
- Do not use headless SwiftShader numbers as a substitute for physical-device profiling. The existing E2E harness's GPU-budget path is useful for structural checks but does not prove real-device 60 FPS.

### Gameplay and competition integrity
- Inputs must work on touch and keyboard; movement and physics should be time-step independent.
- Pause, resume, tab visibility, orientation, retry and game-over states must not duplicate or corrupt scores.
- Legitimate scores must submit successfully; forged scores must be rejected. Review the actual server scoring rules for each game rather than relying on the registry's generic rate ceiling.
- Giveaways must use verified score submissions and the defined tie-break logic; never award based only on a client-side display value.

## Rebuild sequence

### Phase 0 — stop counting unverified games as finished
1. Run the integrity audit and baseline E2E tests against the exact branch commit.
2. Record failures and screenshots. Preserve the last known working version in Git history before each replacement.
3. Separate failures into load/score integrity, controls, performance, art quality, and asset-rights categories.
4. Re-test the known hot spots first: `dino-dash`, `rail-rush`, `lane-racer`, and `moto-lanes`. Do not call FPS instrumentation fixed until its measurements are non-null and repeatable.

### Phase 1 — high-visibility movement and vehicle games
Rebuild runner, lane-switching, driving, bike, drifting, off-road and stunt games first. These are the most exposed to visible blockiness and performance complaints. Standardize camera motion, vehicle suspension/lean, road materials, environment variation, collision feedback, animation, traffic behavior, touch steering and distance/score tuning. Prefer shared optimized engines with per-game art direction over duplicating expensive render loops.

### Phase 2 — combat, survival and shooters
Upgrade enemy silhouettes/animation, hit reactions, weapon feel, spawn logic, readable projectile effects, boss/wave pacing, spatial sound and clear HUD hierarchy. Preserve stable frame time under peak enemy/projectile counts; add stress tests that reach the heaviest gameplay state.

### Phase 3 — physics, destruction and defense
Improve collision feedback, believable motion, material response, particles and camera shake without letting effects swamp the screen. Stress-test high object counts and cap expensive debris. Tower-defense games must clearly communicate tower ranges, targeting, upgrade branching, enemy health and wave pressure.

### Phase 4 — puzzle, reflex, sports and specialty
Use crisp scalable rendering, responsive controls, polished transitions, readable game states and meaningful skill-based scoring. These genres do not require 3D; a distinctive, high-fidelity 2D art direction is preferable to unnecessary heavy 3D.

### Phase 5 — visual/technical audit of every remaining title
Every existing registry slug must have a fresh browser result, a mobile result, a gameplay capture, a rights record and a human visual score. Missing or stale screenshots do not count as a pass. Replace any title that fails after two focused optimization/art passes rather than spending unlimited time on a weak base.

## Work log on this branch

- **Neon Circuit**: new original Canvas arcade racer added; browser and physical-device testing still required.
- **Rift Survival**: new original arena-survival game added; browser and physical-device testing still required.
- **Registry/catalog/docs**: reconciled to 100 entries. This is a metadata consistency fix, not a claim that all 100 games are polished.
- **Known reported defects**: Desert Dash FPS instrumentation; low-FPS reports for Rail Rush, Lane Racer and Moto Lanes. These are still open until a fresh run identifies the cause and validates a fix.

## Required evidence before calling a game AAA-ready

Each game's review record must include:
1. Commit SHA and test date.
2. Desktop + mobile load/control/score/forgery test outcome.
3. Physical-device make/model, browser, test duration, average/P50/P95 frame time, worst sustained drop, memory/thermal notes.
4. Gameplay screenshots or short capture showing title, active play and game-over/score submission.
5. Visual rating (minimum 7/10) with concrete notes, not just a label.
6. License/source manifest and trademark review.
7. Final decision: pass, fix, or replace.

No game should be described as AAA-ready solely because it is registered, launches, or has a configured giveaway flag.
