# Endurance audit: Tunnel Hop / Drift King — 2026-10-13

**Scope:** Isolated source-logic simulation and two production gameplay source changes; **not** visual AAA approval, Android FPS measurement, cheating audit, or live deployment verification.

## Findings and staged fixes
- `public/games-lib/tunnel-hop/game.js`: generated world rows were stored forever; after five simulated minutes the baseline accumulated 6,099 rows. The revised renderer and collision indexing use an absolute `rowBase` and a rolling buffer. After two simulated hours the rolling buffer remained 64 rows, and tile generation matched the previous seeded sequence in source testing.
- `public/games-lib/drift-king/game.js`: the road point list grew forever, and Canvas drew the entire historical road twice each frame. A safe prune of completed segments retains a small trail and future look-ahead. In a scripted 4,000-segment physics path, peak source road points were 42 rather than 4,022; drawn path nodes were 64 rather than 8,044; score remained 13,659 and seeded RNG state 982989590.
- `tools/test-endless-buffers.js` is a standalone deterministic Node/VM regression check, run during Docker prelaunch, with no DB, player account, network, or payment calls.
- Source acceptance only: both titles remain **REWORK / not quality certified** until input, collisions, sound, design, anti-cheat, FPS and physical Android/desktop replay are checked.

## Catalog overlap triage: do not remove automatically
The static catalog has 80 unique slugs and IDs, but descriptions alone produce possible pairs:
- `hill-hauler` versus `egg-roll`: very similar distance-and-coin scoring but different actual gameplay source (Matter.js sprung rigid-body physics vs egg-balancing hill car). Keep pending actual hands-on distinctness review.
- `roof-runner` versus `tunnel-hop`: similar distance scores but different world/camera/control loops (side-view rooftop jump vs rotating gravity tunnel). No automatic deletion warranted.
- `spot-kick` versus `ice-snipe`: both goal/corner/streak shootouts, but football goalkeeper shot versus hockey stickhandling/delayed goalie. High-priority human uniqueness review, not a proven duplicate.
- `drift-king` versus broader driving library: one-button curve retention differs in source from physics driving but needs player comparison.
- `dirt-dash` and `hill-hauler` precalculate finite distance-spawned hazards/coins despite their endless positioning; investigate whether repeated long-run progression remains challenging. Do not alter scoring curves without a reliable gameplay regression.

## Release checkpoint
Draft working PR #10 branch is **not confirmed READY on Deplexo**, and auto-deploy may attempt builds on draft branches. Previous source-only import-registry Docker blocker was addressed in `55ebf1c`, but actual host status still requires build logs. Keep the quality-approval counter at zero until per-game evidence exists. Avoid conflating static QA, source simulation, Deplexo READY and public launch.
