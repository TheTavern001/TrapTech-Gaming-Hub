# Game catalog uniqueness and duplicate retirement

**Snapshot:** 2026-10-12  
**Decision:** retire 20 repeated or strongly overlapping gameplay loops before expanding toward the 500-game target.

## Active inventory

The source registry includes 16 historical core IDs, but three chance-based games are retired. The active baseline is **13 core games + 80 Games Library games = 93 playable titles**, pending hands-on release review. The 20 retired titles are removed from the registry, static fallback catalog, and public game-file tree, so they cannot reappear as active cards or be launched as direct public game pages.

## Canonical choices

| Gameplay loop | Keep | Retired duplicate(s) | Rationale |
|---|---|---|---|
| Jetpack obstacle flight | Core **Jetpack Dash** | Jet Blaster | Same jetpack-flight/obstacle/collectible loop |
| One-tap gap flying | Core **Sky Hopper** | Sky Flap, Hoop Flap | Same flap-to-pass-gap loop with a reskin/hoop variation |
| Timed slab stacking | Core **Stack** | Slab Stack | Same sliding slab, tap-to-drop, overhang-cut mechanic |
| Snake growth | Core **Neon Munchies** | Neon Serpent | Same collect-food/grow/avoid-collision loop |
| Paddle brick breaking | Core **Brick Breaker** | Brick Blitz | Same bounce-ball-and-clear-bricks loop |
| Slingshot structure destruction | Core **Sling Smash** | Sling Siege, Castle Crush | Same drag-aim-launch, collapse structures, clear targets loop |
| Lane-based pest defense | Core **Grow Guard** | Lawn Guard | Same grid/row defense loop against pests |
| Traffic-lane dodging | **Throttle Rider** | Moto Lanes, Lane Racer | Consolidate very similar traffic-weaving runners into one flagship |
| Endless third-person runner | **Rail Rush** | Ruin Runner | Keep one closest Subway-Surfers-style lane-running experience |
| Match-3 gems | **Strain Crush** | Gem Rush | Keep the distinctive cannabis-themed version rather than two match-3 clones |
| Crossing traffic | **Road Hopper** | Toad Cross | Keep one Crossy-Road/Frogger crossing loop |
| Baseball distance hitting | **Long Ball** | Bat Boy | Keep one home-run distance/precision batting loop |
| Police-chase driving | **Wanted Run** | Highway Heist, Park Getaway | Consolidate overlapping pursuit/survival driving variants |
| Bullet-heaven survival | **Moon Swarm** | Night Shift | Keep one auto-shooter wave-survival loop |
| Momentum gliding | **Dune Glide** | Hill Glider | Keep one downhill momentum-jump/glide loop |
| Rotating-target projectile timing | **Knife Toss** | Pen Throw | Same timed projectile insertion into a rotating target |

## Checks added to the release gate

- The registry count must be exactly 80 until new titles are accepted.
- Retired slugs must not return to the registry.
- Retired game directories must not exist in public assets.
- The static `catalog.json` fallback must exactly match the active registry.
- The API smoke test compares `/api/build` against the registry count rather than an obsolete hard-coded minimum.

## Expansion math

The target is **500 total active games**, including the 13 active core games. From the consolidated baseline of 93, that means **407 additional distinct games**. The first additions should be tested as carefully as the originals, not filler or same-loop reskins. A candidate is not counted toward the target until its gameplay loop is distinct, the controls and scoring work, its assets load locally, its source/licence is recorded, and its score path passes the shared verification gates.

This is a catalog uniqueness and structural-source pass. It does not claim the 80 retained games have completed hands-on desktop/Android gameplay, visual-quality, sustained-frame-time, or licensing review.

## Second-pass source evidence (current catalog)

The active Games Library has 77 original `game.js` files with distinct Git blob hashes and 3 independently vendored games. No pair of original game entry JavaScript files is byte-identical. This is **not** proof of unique mechanics: short `game.js` entrypoints often configure larger shared engines. The following uses are expected and must be assessed by actual mechanics:

- `cab-rush` and `derby-smash`: shared `topcar.js`, different taxi versus arena-demolition objectives.
- `egg-roll`, `monster-crush` and `dune-glide`: shared `hillcar.js` physics, different balancing, destruction and sandboarding objectives.
- `rail-rush` and `throttle-rider`: distinct 3D lane-runner versus first-person motorcycle highway engines.

Do not remove a title solely because it shares rendering/physics code. Remove or consolidate only when scoring, controls, progression and player decision loops are materially identical based on actual playtests. The separate QA tracker remains BLOCKED pending those tests.
