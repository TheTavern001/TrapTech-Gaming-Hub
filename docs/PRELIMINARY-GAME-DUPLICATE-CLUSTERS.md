# Preliminary catalog findings — deep distinctness audit

Date: 11 October 2026  
Catalog source: `public/games-lib/catalog.json` on `games/deep-distinctness-audit`  
Scope: 100 entries. This is a source-metadata triage, **not** a completed gameplay or visual inspection.

## High-confidence facts from catalog metadata

- The catalog contains 100 entries, and all must remain unapproved until per-game human QA is complete.
- Many entries explicitly declare a commercial/reference game in `ref_internal`. That field signals design inspiration/reference; it does not prove copying or establish whether the implementation is sufficiently distinct.
- Many entries declare the same local `public/games-lib/kit.js` engine and synthesized audio/vector art. Shared framework code alone is not a duplicate, but the implementations must be checked for identical input grammar, state machine, scoring loop, obstacle/level grammar, and visual template.
- Some entries explicitly identify vendored upstream projects and licences. Those require provenance/licence verification as well as gameplay distinctness review.
- The earlier 100/100 automated audit only checked basic operation, input, score handling and selected render limits. It did not assess pairwise similarity or AAA-level quality.

## Priority candidate clusters for pairwise inspection

The entries below are **review queues**, not final duplicate determinations. The game source, actual play, code paths and rendered output must be compared before disposition.

### 1. Endless runners / one-button movement / lane dodging
- Sky Flap — `sky-flap` — reference: Flappy Bird
- Cloud Hopper — `cloud-hopper` — Doodle Jump
- Road Hopper — `road-hopper` — Crossy Road
- Desert Dash — `dino-dash` — Chrome T-Rex Runner
- Rail Rush — `rail-rush` — Subway Surfers
- Ruin Runner — `ruin-runner` — Temple Run 2
- Jet Blaster — `jet-blaster` — Jetpack Joyride
- Roof Runner — `roof-runner` — Canabalt
- Tunnel Hop — `tunnel-hop` — Run (tunnel runner)
- Hill Glider — `hill-glider` — Tiny Wings
- Dune Glide — `dune-glide` — Alto's Adventure
- Green Dash — `green-dash` — delivery runner
- Hoop Flap — `hoop-flap` — Flappy Dunk
- Dunk Flick — `dunk-flick` — Dunk Shot

**Audit question:** which games actually provide different decisions, controls, spatial navigation, physics and mastery, and which merely reskin jump/avoid/endless scoring? Do not merge unlike games based only on a broad “runner” label; do not keep near-identical ones because their themes differ.

### 2. Driving / traffic / racing / chase / stunt / vehicle physics
- Hill Hauler — `hill-hauler` — Hill Climb Racing
- Most Wanted Run — `wanted-run` — Smashy Road: Wanted 2
- Throttle Rider — `throttle-rider` — Traffic Rider
- Lane Racer — `lane-racer` — Traffic Racer
- Drift King — `drift-king` — Drift Boss
- Moto Lanes — `moto-lanes` — Traffic Rider
- Egg Roll — `egg-roll` — Eggy Car
- Monster Crush — `monster-crush` — monster truck crusher
- Park Getaway — `park-getaway` — Pako Forever
- Highway Heist — `highway-heist` — Pako Highway
- No Brakes — `no-brakes` — Faily Brakes
- Cab Rush — `cab-rush` — Crazy Taxi
- Dirt Dash — `dirt-dash` — Excitebike
- Road Brawl — `road-brawl` — Road Rash
- Derby Smash — `derby-smash` — demolition derby
- Neon Circuit — `neon-circuit` — original neon arcade racer

**Audit question:** distinguish traffic weaving, first-person motorcycle riding, drift timing, physics climbing, vehicle delivery, police pursuit, combat racing, stunt racing and demolition only where each has its own control model, objective and encounter design. Throttle Rider and Moto Lanes are a top-priority same-reference pair. Lane Racer is also a top-priority comparison, but actual loop evidence is required.

### 3. Horde survival / arena shooter / auto-attack progression
- Cube Horde — `cube-horde` — Zombie Cubes
- Arrow Hero — `arrow-hero` — Archero
- Night Shift — `night-shift` — 20 Minutes Till Dawn
- Grid Wars — `grid-wars` — Geometry Wars
- Moon Swarm — `moon-swarm` — Vampire Survivors
- Rift Survival — `rift-survival` — no explicit reference in catalog

**Audit question:** are movement, aiming, attack timing, enemy patterns, build choices and run progression meaningfully distinct? A different character, enemy skin or weapon list is insufficient.

### 4. Tower defense / placement / lane pressure
- Lawn Guard — `lawn-guard` — Plants vs. Zombies
- Pop Defense — `pop-defense` — Bloons TD 6
- Keep Guard — `keep-guard` — Kingdom Rush
- Node Siege — `node-siege` — Infinitode 2

**Audit question:** distinguish lane-based unit placement, projectile/balloon targeting, fixed-path tower tactics and scalable tower-defense systems. If the actual loop is the same place-upgrade-repeat loop with different art, retain only the strongest or redesign the rest.

### 5. Physics projectile / destruction / construction
- Sling Siege — `sling-siege` — Angry Birds 2
- Wreck Ride — `wreck-ride` — Happy Wheels
- Rig Rally — `rig-rally` — Bad Piggies
- Goo Tower — `goo-tower` — World of Goo
- Castle Crush — `castle-crush` — Crush the Castle

**Audit question:** projectile trajectory puzzle, physics driving survival, vehicle construction, structural construction and siege destruction may be distinct. Verify the actual implementation and avoid shared levels, trajectory loops, structures or near-identical art.

### 6. Reflex / lane timing / simple score attack
- Slab Stack — `slab-stack` — Stack
- Helix Drop — `helix-drop` — Helix Jump
- Hex Spin — `hex-spin` — Super Hexagon
- Color Hop — `color-hop` — Color Switch
- Zig Path — `zig-path` — ZigZag
- Light Cycle — `light-cycle` — Tron light cycles
- Knife Toss — `knife-toss` — Knife Hit
- Mole Whack — `mole-whack` — Whac-A-Mole
- Pen Throw — `pen-throw` — Pineapple Pen
- Paper Toss — `paper-toss` — Paper Toss
- Bat Boy — `bat-boy` — Baseball Boy
- Cup Toss — `cup-toss` — swipe-throw cup pong
- Skee Roll — `skee-roll` — Skee-Ball

**Audit question:** separate timing, spatial navigation, precision throws, reaction targeting and physics aiming; simple “tap at the right time” is not enough to justify several titles unless their skill loop differs.

### 7. Puzzle / matching / board manipulation
- Block Drop — `block-drop` — Tetris
- Bud Merge — `bud-merge` — 2048
- Hex Stack — `hex-stack` — Hextris
- Orb Coil — `orb-coil` — Zuma
- Gem Rush — `gem-rush` — Bejeweled
- Bubble Pop — `bubble-pop` — Bubble Shooter
- Mine Sweep — `mine-sweep` — Minesweeper
- Tile Twin — `tile-twin` — Mahjong Solitaire
- Glow Echo — `glow-echo` — Simon
- Beat Tiles — `beat-tiles` — Piano Tiles
- Strain Crush — `strain-crush` — match-3
- Neon Flipper — `neon-flipper` — pinball

**Audit question:** the broad puzzle category does not make these duplicates; compare their actual decision loop and verify whether any entries are only a reskinned board or clone. Prioritize unique level design, rule systems and visual identity.

### 8. Arcade shooting / fixed-screen targeting
- Alien Rows — `alien-rows` — Space Invaders
- Rock Buster — `rock-buster` — Asteroids
- Star Swarm — `star-swarm` — Galaga
- Missile Guard — `missile-guard` — Missile Command
- Bug Blaster — `bug-blaster` — Centipede
- Duck Shot — `duck-shot` — Duck Hunt

**Audit question:** compare player movement, firing, enemy trajectories, target selection and defensive decisions. Distinct art alone is not sufficient.

### 9. Cannabis-themed games — check for reskinned mechanics
- Grow Op — `grow-op` — grow simulation
- Trim Rush — `trim-rush` — trimming speed game
- Bud Bar — `bud-bar` — dispensary tapper
- Green Dash — `green-dash` — delivery runner
- Roll Up — `roll-up` — rolling precision
- Smoke Rings — `smoke-rings` — aim + power shot
- Bud Sort — `bud-sort` — conveyor sorting
- Pest Patrol — `pest-patrol` — bug squash
- Cup Toss — `cup-toss` — swipe-throw cup pong
- Strain Crush — `strain-crush` — match-3

**Audit question:** these may legitimately be distinct because theme is not the deciding factor; test their actual verbs, objectives, strategy, physics and feedback. Compare Green Dash against all runner entries, Strain Crush against all match/puzzle entries, Bud Bar against other tapper/idle loops, and Pest Patrol against all reaction-target games.

## Immediate blockers / priorities

1. Inspect the actual source modules and shared engine call paths for the highest-risk pairs, starting with **Throttle Rider vs Moto Lanes**, **Lane Racer vs other traffic runners**, **Jet Blaster vs all endless runners**, and **Rail Rush vs Ruin Runner vs Desert Dash**.
2. Generate the full pairwise matrix across all 100 games using both source-level features and observed gameplay, then manually adjudicate every high-similarity pair.
3. Build screenshot/video evidence on desktop and the target Android phone for visual comparisons.
4. Verify the upstream vendored entries and licenses separately from similarity.
5. Make retain/rebuild/retire decisions before spending time polishing redundant variants.
6. Keep all human quality fields **NOT SIGNED OFF** until the actual play and visual reviews are complete.

## Important caveat

This document is based on the current catalog's titles, declared reference inspirations, categories, source fields and prior known audit limitations. It does not claim the listed pairs are proven clones, and it does not claim that any one of them has already been removed or fixed. Those decisions require code and play evidence.