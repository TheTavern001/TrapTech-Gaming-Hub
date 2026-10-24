# Core Game Rebuild Plan (owner review, 2026-10-22)

Owner verdict: every core game except **Stack** and **Munchies Snake** gets a full rebuild — realistic colour, real 3D (or
high-fidelity 2D) assets, a new in-game UI/layout, and mechanics matched to the recognisable reference game.

## Rules for every rebuild

- **Reference ≠ copy.** The reference names the gameplay players already know. Our build is original code and art, or
  CC0/permissively licensed assets with the licence file kept. No proprietary art, audio, names or logos.
- **Keep the game id.** Scores, achievements, earned items and giveaway history stay attached (`jetpack-dash` etc.).
- **Keep fairness.** All gameplay randomness from the run seed; server score limits re-tuned per rebuild
  (`docs/SCORE-RANGES.md`); Stack keeps server replay.
- **Mobile first.** Portrait, one-thumb controls, 60 fps on a mid-range Android; HUD inside the safe area.
- **Acceptance per game:** side-by-side screenshot vs reference loop, browser e2e (legit accepted / forged rejected),
  phone FPS ≥ 30, owner visual sign-off.

## Scoring and run length (owner direction)

Owner expectation: in an addictive endless game, strong players should reach **100k–1M+ points**. Today Jetpack Dash
scores raw meters (typical run 42 s / 580 m; Pro target 3,400 m and Elite 5,300 m come from a 3,000-player Monte Carlo
simulation in `docs/score-ranges.json`, not real players). For each rebuild:

- **Points, not raw units**, where the reference uses them (Subway Surfers model): distance × multiplier, with the
  multiplier raised by missions/streaks, plus coins, near-misses and combos.
- **Run length:** difficulty ramp tuned so a competent run lasts minutes, not seconds.
- **Re-tune together, never separately:** anti-cheat rate ceiling (Jetpack Dash is capped at 30 m/s today; a 1M score
  would be rejected), score tiers, Pro/Elite earned-item targets, achievement ladders and skill-quest targets —
  re-simulated with `tools/score-sim.js`, then replaced with real run percentiles once there is data.
- **Fresh boards:** old-unit scores are archived (same path as retired games) because they are not comparable.

## Shared UI pass (applies to all games)

One in-game HUD kit for core and library games: score / best / lives pills, pause, sound and settings in the safe area;
consistent start, pause and game-over cards (current game-over card has a large empty gap); real typography and icons.

## Per game

| Game (id) | Reference | Rebuild target | Assets on hand |
|---|---|---|---|
| Drift Rush (`drift-rush`) | Traffic Racer / Drift Boss | **Done (v9):** 3D highway, chase camera, traffic weaving, near-miss + drift combo scoring | Kenney Car Kit (sedan, taxi, police, SUV, trucks), city buildings, lamps, barriers |
| Bud Escape (`jetpack-dash`, was Jetpack Dash) | Jetpack Joyride | **Done (v9):** owner spec "Bud Escape": Cash Green escapes a federal grow warehouse on a hover-dolly; grow-light zappers, security drones (lock-on reticle), UV lasers, harvest arms; rainbow strain crates give one of 7 one-hit vehicles (shockwave + slow-mo on entry); warehouse staff to high-five; 3 daily missions shared by all players; ragdoll death; score = meters + 200 per mission (owner decision) | Toon-rendered CC0 Kenney 3D kits + models built in code for the cannabis pieces, GameArt2D CC0 character, packed by `tools/bud-escape-assets/` |
| Sky Hopper (`sky-hopper`) | Flappy Bird | Bright daytime world, readable pipes/towers, satisfying flap physics, medals | 2D art to commission/build |
| Brick Breaker (`brick-breaker`) | Arkanoid / Breakout | 3D-lit bricks with materials, multi-hit and steel bricks, capsules (laser, multiball, catch), boss stage | Procedural PBR bricks |
| Void Swarm (`void-swarm`) | Galaga | **Overlaps Star Swarm.** Proposal: retire into Star Swarm, or re-theme to a different shooter (e.g. Asteroids or vertical bullet-hell) | Kenney space kit |
| High Score (`high-score`) | Duck Hunt / shooting gallery | 3D carnival gallery with moving targets, wind, combo multipliers | Kenney/Quaternius props |
| Terp Tapper (`terp-tapper`) | Piano Tiles / Guitar Hero mobile | Highway with depth, note trails, hit windows shown, original music charts | Synthesised audio |
| Grow Guard (`grow-guard`) | Plants vs. Zombies | Lit garden lanes with depth, animated pests and gadgets, sun-drop economy readable at a glance | Quaternius nature/creatures |
| Sling Smash (`sling-smash`) | Angry Birds | Real 2D physics structures (wood/glass/stone break states), trajectory preview, 10-shot challenge | Material textures (Poly Haven CC0) |
| Haze Defense (`haze-defense`) | Bloons TD | Real map art instead of placeholder hexes, distinct tower models with upgrade paths, wave preview | Kenney tower-defense kit |

## Order

1. **Pilot: Drift Rush** (weakest visually, best assets already in repo). Owner signs off on the quality bar.
2. Shared HUD/UI kit.
3. Jetpack Dash, Sling Smash, Haze Defense, Grow Guard (most recognisable references).
4. Brick Breaker, Sky Hopper, High Score, Terp Tapper. (Memory Match was removed from the hub on 2026-10-24, owner decision.)
5. Decide Void Swarm (retire vs re-theme).
6. Library games: same pass, starting with the weakest of the visual audit (Block Drop upgrade next, as the kept Tetris title).
