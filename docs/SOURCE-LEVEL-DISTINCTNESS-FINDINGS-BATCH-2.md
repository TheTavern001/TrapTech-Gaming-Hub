# Source-level findings: second comparison batch

Date: 11 October 2026  
Status: preliminary, source-only. All entries remain NOT SIGNED OFF until gameplay/video and real-device evidence exists.

## Finding 4 — Tower defense family: similar genre, distinct strategic structures may justify separate entries

**Severity: MEDIUM — verify actual play; do not automatically retire by genre.**

Evidence:
- `lawn-guard/game.js` declares a 5-lane garden defense with sun collection, plant/defender placement and endless waves.
- `pop-defense/game.js` declares balloon-popping path defense using shared `td.js`.
- `keep-guard/game.js` declares fantasy path defense using shared `td.js`.
- `node-siege/game.js` declares neon maze tower defense; towers block tiles and enemies re-route with BFS, also using `td.js`.

Interpretation:
- Lawn Guard's resource collection and lane placement can form a distinct strategy loop from path towers.
- Node Siege's maze-building/path-recalculation mechanic is a defensible distinction from fixed-path defense if it actually affects strategic play.
- Pop Defense and Keep Guard both use the same shared tower-defense engine family. The balloon theme vs fantasy enemies is not sufficient by itself. Compare tower targeting, enemy path, upgrade choices, map shape, economy, wave design and meaningful counterplay.

**Recommendation:** do not collapse all four merely because they are tower defense. Prioritize Pop Defense vs Keep Guard. If they share the same TD state machine and only swap theme/tower stats, keep one and rebuild or retire the other. Node Siege can remain only if its maze-routing decisions are substantial and well-tested.

## Finding 5 — Hill Glider vs Dune Glide: shared movement inspiration, likely distinct control loops but must be proven

Evidence:
- `hill-glider/game.js` describes hold-to-dive on downslope and release on upslope to launch; it uses its own `Kit.run` 2D loop.
- `dune-glide/game.js` calls shared `hillcar.js` with `wheels: false`, automatic forward speed, and tap/jump plus in-air backflip controls for a sandboarding experience.

Interpretation:
- Both may share terrain-following momentum inspiration, but the input and mastery loop appears different: terrain-pump timing versus jump/backflip/landing control.
- These are not confirmed duplicates. They need side-by-side gameplay evidence, physics/terrain comparison and original visual identity review.

**Recommendation:** keep both as distinct candidates only if each has robust, different mechanics and satisfying skill progression; otherwise consolidate.

## Finding 6 — Roof Runner vs Tunnel Hop vs lane runners: potentially distinct 2D movement systems

Evidence:
- `roof-runner/game.js` uses a one-button jump with variable jump height and gaps between rooftops.
- `tunnel-hop/game.js` describes gravity/tunnel rotation where walls become floors, plus movement and jumping.
- Rail Rush/Ruin Runner use lane change, jump and slide in a 3D runner engine.

Interpretation:
- Roof Runner's gap timing and Tunnel Hop's changing gravity/surface orientation are potentially different core verbs from lane switching and sliding.
- The distinctness is plausible from source, not proven by source alone. Visual quality may still be below the required bar.

**Recommendation:** do not retire them solely because they are endless survival games. Require their special mechanics to be used throughout levels, not only introduced briefly.

## Finding 7 — Vehicle/chase games: more than one may be justified, but shared core mechanics require checks

Evidence:
- `park-getaway/game.js` calls shared `topcar.js` with `mode: 'getaway'`, describes collecting cash and luring cops into trees/each other.
- `cab-rush/game.js` calls shared `topcar.js` with `mode: 'taxi'`, describing timed pickup/dropoff fares and braking.
- `highway-heist/game.js` is a custom 2D top-down highway escape with cops boxing the player in and ramming them into traffic.
- `no-brakes/game.js` is a custom brakeless mountain-road survival game with steering and oncoming cars.
- `drift-king/game.js` is a one-tap drift game on a zig-zag road.
- `green-dash/game.js` is a top-down delivery scooter game where drop zones add time while traffic must be avoided.
- `hill-hauler/game.js` uses Matter.js rigid-body vehicle physics, sprung suspension and air-pitch control.
- `wanted-run/game.js` is a voxel 3D police-chase survival game.

Interpretation:
- Taxi delivery, vehicle physics climbing, one-tap drift, top-down chase and traffic weaving can be distinct if their objective structures and moment-to-moment decisions differ.
- Park Getaway and Cab Rush share `topcar.js`; inspect whether `mode` changes the simulation/objective meaningfully or only the HUD/mission labels.
- Highway Heist and Park Getaway overlap in police chase and top-down steering. Their ramming/traffic interactions vs cash/collision tactics must be tested.
- Green Dash shares the general delivery-and-traffic fantasy with Cab Rush, but scooter steering, timed drop zones and traffic can still form a distinct loop if implemented deeply.
- Hill Hauler's suspension/air-pitch physics is a strong distinctness signal from simple lane racers.
- Drift King appears to have a distinct one-tap drift control grammar, but a simple control difference alone does not guarantee enough depth.

**Recommendation:** cluster by actual decisions, not “driving” label. Prioritize Park Getaway vs Cab Rush (shared engine), Highway Heist vs Park Getaway, Green Dash vs Cab Rush, and all traffic weaving titles. Keep Hill Hauler and Drift King as distinct candidates pending quality review.

## Finding 8 — Horde-survival titles: shared genre, distinguish control and build decisions

Evidence:
- `cube-horde/game.js` describes a voxel 3D zombie-wave arena and references shared `arena.js` rules.
- `arrow-hero/game.js` describes drag movement, auto-fire while stationary, room clearing, a gate to the next room, and three-skill choices on level-up.
- `night-shift/game.js` describes a dark field with flashlight-cone visibility, auto-aim, XP gems, level-up picks and waves.
- `grid-wars/game.js` describes neon twin-stick survival with a warped grid and vector enemies.
- `moon-swarm/game.js` describes a pixel-art survivor roguelite and shared `arena.js` rules.

Interpretation:
- Arrow Hero's room/gate/skill-pick structure, Night Shift's light/visibility mechanic, and Grid Wars' twin-stick movement/aiming can be materially distinct.
- Cube Horde and Moon Swarm share `arena.js` rules but appear to use different presentation and game loops. Shared rules are not automatically duplication; compare controls, enemy archetypes, upgrades, arena topology, objective and run pacing.
- If the actual player input and upgrade loop are essentially identical across two games, a different rendering style is not enough.

**Recommendation:** preserve candidates with demonstrably unique control/strategy systems; compare Cube Horde vs Moon Swarm and Grid Wars vs Night Shift first. Require visual originality and variety, not only different art filters.

## Finding 9 — Sling Siege, Wreck Ride, Rig Rally and Goo Tower are mechanically differentiated candidates

Evidence:
- `sling-siege/game.js` uses Matter.js projectile physics and fort-toppling targets.
- `wreck-ride/game.js` uses Matter.js bike physics and a ragdoll rider with breakable grip joints.
- `rig-rally/game.js` is a build-then-ride contraption game with parts such as wheels, motors, balloons and fans.
- `goo-tower/game.js` uses a springy goo lattice for structure building.

Interpretation:
- These share a physics library but have different player verbs: aim/shoot, ride/control a ragdoll, assemble a vehicle, and construct a flexible structure. This is a stronger basis for distinct identities than theme-only variations.
- They still need control stability, physics edge-case testing, level/goal variety and high-quality visual polish.

**Recommendation:** keep as distinct candidates unless playtesting reveals the actual objective and decision loops collapse into the same physics puzzle. Do not count shared Matter.js dependency as duplication.

## Summary decisions from this pass

- **Likely redundant / high-priority adjudication:** Moto Lanes, Throttle Rider and Lane Racer; Rail Rush and Ruin Runner; Pop Defense and Keep Guard; Park Getaway and Cab Rush.
- **Potentially distinct but must be demonstrated:** Jet Blaster, Hill Glider, Dune Glide, Roof Runner, Tunnel Hop, Hill Hauler, Drift King, Highway Heist, Green Dash, Arrow Hero, Night Shift, Grid Wars, Sling Siege, Wreck Ride, Rig Rally and Goo Tower.
- **Not a final keep/delete list:** this is source-based triage. The final disposition requires actual play sessions, screen recordings, asset inspection, and human QA on desktop and Android.
- **No deletions made:** avoid removing games from catalog, routes, leaderboards and historical score handling until the full identity decision is documented and implementation plan is tested.
