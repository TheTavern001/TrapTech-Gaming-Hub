# Gaming Hub — Individual Game Audit & Redesign Workboard

Status: **in progress; not launch-approved**. This is the implementation workboard, not a claim that visual/gameplay QA has passed.

## Shop and avatar implementation progress

- **Rotating cosmetic universe:** added a deterministic 1,200-item catalog scheduled across 600 daily rotations, with a paginated catalog API and searchable Points Shop browser. Items outside the active rotation are preview-only; purchase still validates the active shop rotation.
- **Prestige originals:** the new collection contains 12 individually identified originals, each priced at $1,000–$5,000 with supply 1 and distinct effect metadata. A partial unique SQLite index blocks multiple active owners, order reservation checks run transactionally, and a refunded original is not silently reissued.
- **Legacy prestige:** the former three multi-supply items are retired from new sales without overwriting their historic ownership or current avatar unlocks.
- **Prestige visuals:** original SVG assets and per-item store art mappings are present; the 2D avatar renderer and 3D preview now include distinct environments for the new collection. Prestige purchases remain disabled unless `PRESTIGE_SALES_ENABLED=1` is explicitly configured after wearable/compatibility review.
- **Prelaunch gates:** expanded source checks for all 12 IDs, unique effects, one-of-one supply, minimum price, original art/CSS mappings, 3D environment mappings, database uniqueness, and catalog UI/API wiring.

## Implemented fixes and verification hardening

- **Sky Hopper:** bounded successive obstacle-gap shifts to reduce unfair/unreachable mobile layouts. Source-level syntax was checked after the change; full gameplay remains unverified.
- **Games Library shared engine:** wrapped localStorage reads/writes so denied storage does not prevent the game engine from booting; normalizes legacy viewport metadata so pinch zoom is not deliberately disabled while retaining safe-area support.
- **Prelaunch verification:** checks syntax across repository JavaScript, checks each original built game implementation, validates vendored multi-file entrypoints, confirms required shared library files, and checks icon/manifest wiring. The audit distinguishes original built titles from the three vendored multi-file titles rather than incorrectly requiring every title to have a `game.js` file.
- **Build gate:** the Docker build now stops if the deep audit reports a blocker instead of treating the existence of a report file as success.
- **Branding:** canonical crowned-TT Trap Tech artwork is wired to the browser icon, startup splash, PWA icons, shortcuts, and generated PNG icon routes. Deployment still needs live response verification.


- **Live deployment verifier expanded:** it now checks each library game's referenced same-origin JavaScript, CSS, image, font, audio, JSON and WebAssembly dependencies in addition to checking the HTML entrypoint. Missing runtime assets will be reported by path and by the titles that reference them.
- **Prelaunch regression gate expanded:** it now fails if the launch redesign stylesheet is absent/empty or if the homepage stops linking to that stylesheet or the canonical Trap Tech splash/favicon mark.

These are source-level changes, not proof of a full browser/device pass. Keep each title blocked until its game-specific test evidence is recorded below or in the generated audit report.

## Implemented fixes awaiting runtime regression

- Shared engine now clears held pointer/key state on pause, restart, finish and destroy; forced cancellations are marked separately so they do not accidentally trigger release actions.
- Plinko, Spin to Win and Sling Smash now cancel an in-progress aim/charge when the engine forcibly releases controls instead of launching/dropping/spinning during pause or teardown.
- Sky Hopper gap generation and moving-gap animation now bound successive gap transitions to reduce unfair mobile obstacle sequences.
- Brick Breaker now resolves ball/brick penetration and enforces a minimum physics substep, preventing repeated damage from one overlap and zero-step frames.
- Games Library storage access is guarded for locked WebViews, and its viewport handling preserves pinch zoom while adding safe-area support.
- Desktop mouse and mobile/in-app-browser regression coverage now includes all 16 registered core games.
- A direct local verifier and ten-title Games Library E2E batch runner are available; the Docker build executes structural/syntax verification and the live verifier can compare a deployed fingerprint with the checkout.

These are code changes, **not passes**. The fixes remain pending browser/gameplay execution and real-device review. The per-title record for all 116 games is in [GAME-QA-TRACKER.md](GAME-QA-TRACKER.md).

## Release gates (apply to every title)

A title stays **blocked** until it passes all gates:
1. **Boot and lifecycle:** loads from the real Hub launch route; no console errors; start, pause/resume, restart, end-run, destroy/unmount and return-to-Hub work without duplicate listeners, orphan audio or a stuck animation loop.
2. **Gameplay integrity:** rules match the in-game instructions; collisions, hitboxes, scoring, lives, timers, power-ups and game-over conditions are consistent; no softlocks or impossible generated states; pause/visibility changes do not advance gameplay.
3. **Input:** touch, mouse/pointer and keyboard are intentionally supported or explicitly documented; no accidental page scroll/zoom; controls remain usable on a 360px-wide phone and desktop; pointer cancellation and rapid repeated input are safe.
4. **Presentation:** title-specific art direction, readable HUD, clear state changes, distinct enemy/obstacle/item silhouettes, polished impact feedback, layered backgrounds and intentional motion. A recolor or common skin does not count as a redesign.
5. **Accessibility and performance:** reduced-motion preference respected; contrast and HUD readability checked; no expensive per-frame asset generation; sustained play remains responsive on a mid-range Android phone.
6. **Integrity and persistence:** score/event replay accepted by server; score and rewards cannot be inflated by client-only state; cosmetics do not alter hitboxes, physics, visibility or scoring.
7. **Evidence:** record device/browser, viewport, test scenarios, findings, fixes and commit. Static token scans alone never constitute a pass.

## Core games — title-specific redesign requirements

| Game | Visual identity and game-feel work | Gameplay / regression focus |
|---|---|---|
| Jetpack Dash | Cinematic layered city, readable depth separation, authored astronaut animation, hazard warning language and exhaust response | Hold/release feel, warning lead time, shield consumption, collision fairness, long-run speed and restart |
| Drift Rush | Premium top-down night circuit, road-surface detail, lighting pools, convincing car silhouette, tire smoke and drift trails | Steering assist, curve readability, drift banking, collision invulnerability, checkpoints and off-road recovery |
| Plinko | Physical-feeling board, individually readable pegs, chip spin/impact, slot animation and strong multiplier hierarchy | Aiming/nudges, exactly 10 chips, peg multiplier order, edge collisions, end-of-run and replay |
| Spin to Win | Machined wheel, crisp wedge typography, power-meter pulse, camera/lighting cues and distinct bonus/bust states | Charge/release determinism, life cap, reshuffle cadence, wedge selection, no input race conditions |
| Memory Match | Tactile card faces, flip easing, pair-match and mismatch feedback, board progression visualized clearly | No double-flip/race, pair lockout, clock math, combo reset, next-board transition and replay |
| High Score | Premium target materials, clear gold/bomb silhouettes, aim/impact response and escalating arena intensity | Tap accuracy, target expiry, bomb penalty, misses/lives, difficulty ramp and safe hit detection |
| Blazed Roulette | Atmospheric grow-room casino table, legible European wheel/pockets, chip denomination hierarchy and unmistakable practice-only messaging | Practice chips only; bets reconcile correctly; timing/landing-zone rules match instructions; table minimum/max and bust |
| Terp Tapper | Characterful tap targets, responsive squash/juice, streak meter and varied but legible spawn patterns | Hit/miss accounting, combo rules, spawn fairness, touch accuracy and anti-auto-click review |
| Neon Munchies | Premium neon arena, readable snake head/body, depth cues, food rarity, rival readability and satisfying growth | Self/wall/rival collision, food pickup, speed ramp, spawn safety, touch direction changes and restart |
| Brick Breaker | Distinct brick materials/damage states, ball trail, paddle feedback, power-up iconography and danger-line clarity | Swept collision at high speed, corner collisions, multi-ball caps, paddle angle, life loss and power duration |
| Sky Hopper | Night-city parallax, architectural towers, astronaut flight/hit animation, hazard contrast and premium coin treatment | Gap reachability on tall/narrow phones, ceiling/ground collision, moving gaps, coin pickup and difficulty ramp |
| Void Swarm | Distinct ship silhouettes, layered nebula, projectile readability, enemy formation language, boss telegraphs and damage states | Hitbox fairness, boss phase timing, enemy shots, invulnerability, power-up timers and wave progression |
| Stack | Isometric material lighting, readable top/side faces, satisfying perfect-stack effect and falling debris | Analytic movement replay, overlap/cut math, edge cases near zero overlap, speed curve, camera follow and restart |
| Grow Guard | Readable lane/arena identity, unique plant/enemy silhouettes, clear upgrade states and wave telegraphs | Enemy pathing, placement rules, resource economy, upgrade stacking, wave completion and leak conditions |
| Sling Smash | Elastic launch presentation, clear trajectory/target feedback, destructible material response and shot-completion clarity | Aim/drag cancellation, projectile collisions, limited shots, object destruction, off-screen recovery and score replay |
| Haze Defense | Tactical battlefield layers, readable lanes/towers/enemy roles, strong attack telegraphs and clear upgrade panels | Target selection, path completion, currency accounting, tower range, wave transitions, pause and loss/win states |

## Games Library (100 titles)

Every registered title under `public/games-lib/<slug>/` must receive its own row in the generated audit and be tested in batches of 10. Each row needs a named reviewer/test session, launch result, control matrix, gameplay scenario, mobile result, duplicate/template similarity decision, console findings, asset/license record, fixes/commit and a final **PASS / FIX / REPLACE / BLOCKED** status.

- **Batch A:** titles 1–10 — inventory and reproduce reported bugs.
- **Batch B:** titles 11–20.
- **Batch C:** titles 21–30.
- **Batch D:** titles 31–40.
- **Batch E:** titles 41–50.
- **Batch F:** titles 51–60.
- **Batch G:** titles 61–70.
- **Batch H:** titles 71–80.
- **Batch I:** titles 81–90.
- **Batch J:** titles 91–100.

No batch advances to public-launch status simply because the HTML exists or the static audit passes. A game that cannot meet the target is fixed or replaced rather than counted toward the launch-ready total.

## Shared systems that must be tested alongside games

- Hub-to-game navigation and return, account/session expiration, signed run token, score event replay, leaderboard updates, reward duplication, offline/network failure, and server restart behavior.
- Avatar ownership, presentation options, equipped-slot compatibility, preview vs. saved state, prestige ownership checks, and cosmetics isolation from competitive gameplay.
- Shop rotation boundaries, deterministic inventory for a session, item purchase idempotency, ownership persistence, expiry behavior, server-side one-of-one uniqueness for prestige originals, and graceful recovery after failed purchases.
- Brand icon consistency: browser favicon, manifest/PWA icon, home-screen icon, shortcut icon and in-Hub logo all use the approved Trap Tech crowned-TT master artwork; verify actual deployed responses before calling complete.

## Current truth

The repository includes a structural audit script and icon-serving changes, but **no successful end-to-end run, real-device gameplay pass, full visual audit, or verified production deployment is recorded yet**. Keep these gates open until test evidence exists.
