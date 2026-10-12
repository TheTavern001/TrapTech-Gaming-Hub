# Source-level findings: first deep-audit pass

Date: 11 October 2026  
Branch: `games/deep-distinctness-audit`  
Evidence source: catalog metadata and the current game entry modules on this branch. This is a source-level review of selected high-risk pairs; no claim is made that all 100 games have been fully played or visually signed off.

## Finding 1 — Moto Lanes vs Throttle Rider vs Lane Racer

**Severity: HIGH — likely redundant family; decision required before release.**

Evidence:
- `public/games-lib/moto-lanes/game.js` invokes `Racer` from `../racer3x.js` with `bike: true`, speed 24, vmax 52. Its instructions describe leaning/steering through traffic and chaining near misses.
- `public/games-lib/throttle-rider/game.js` invokes the same `Racer` implementation with `bike: true`, `fpv: true`, speed 26, vmax 58. It describes a helmet-camera highway run, near misses and overtakes.
- `public/games-lib/lane-racer/game.js` invokes the same `Racer` implementation with a car player, speed 22, vmax 48. Its help text also describes weaving through traffic and chained near-miss multipliers.
- All three use `public/games-lib/racer3x.js`, which documents a continuous-steering highway racer, four lanes of one-way traffic and near-miss combos.

Interpretation:
- Moto Lanes and Throttle Rider share the same vehicle class and central traffic-weaving/near-miss loop; first-person camera vs chase/third-person camera and modest speed tuning are not enough by themselves to establish distinct identities.
- Lane Racer changes the vehicle class but retains the same engine, traffic pattern and core risk/reward loop. Vehicle art alone is not a meaningful game identity change.
- The camera difference may improve immersion, but does not currently establish a different strategic decision system, objective, progression structure or encounter grammar.

**Recommendation:** treat this trio as one provisional identity cluster. Retain one canonical highway-traffic game unless source and play evidence demonstrates a substantial gameplay distinction. Candidate canonical: **Moto Lanes** for the motorbike fantasy, or **Lane Racer** if a car-first experience better fits the Hub. Do not keep all three just to increase catalog count. If the user wants multiple vehicle fantasies, they must be rebuilt around distinct mechanics rather than simple vehicle/camera switches. No catalog entry has been removed in this audit pass.

## Finding 2 — Rail Rush vs Ruin Runner

**Severity: HIGH — same engine and closely aligned core loop.**

Evidence:
- `public/games-lib/rail-rush/game.js` invokes `RailRunner` from `../runner3x.js`, with speed 15, coin value 10, and instructions for track/lane changes, jumping and rolling.
- `public/games-lib/ruin-runner/game.js` invokes the same `RailRunner` implementation with speed 15, coin value 10, jungle theme, and instructions for lane changes, jumping and sliding.
- Both use the same shared three.js lane-runner engine. Their visible difference in this configuration is primarily theme/set dressing and wording; the controls and central obstacle-avoidance loop are almost identical.

Interpretation:
- A train/rail environment vs jungle-temple environment is a visual setting change, not enough by itself to justify two separate games.
- Rail Rush may have train-riding/ramp mechanics elsewhere in the engine; these must be verified from the full gameplay implementation. If they create sustained, distinct decisions and encounters, that evidence could justify keeping both. Otherwise they are a near-duplicate pair.

**Recommendation:** provisional cluster. Keep only one unless the rail/train gameplay materially changes the decisions, route geometry, risk/reward and level objectives. Do not count theme-only variants as distinct.

## Finding 3 — Jet Blaster vs the lane-runner family

**Severity: MEDIUM — different control grammar, still requires a visual and gameplay gate.**

Evidence:
- `public/games-lib/jet-blaster/game.js` uses the 2D `Kit.run` engine, hold-to-fly/release-to-fall vertical thrust, velocity and gravity, zappers, coins and warned missiles. It is not wired to `runner3x.js`.
- The core input/physics differs from the three-lane jump/roll engine used by Rail Rush and Ruin Runner.

Interpretation:
- Jet Blaster has a defensible potential distinction: continuous vertical thrust management versus lane switching/jumping/sliding. It should not be retired merely because it is an endless survival game.
- Its present source uses a 2D canvas art approach with procedural walls, zappers, coins and missiles. This is a different presentation from the 3D runner family, but that alone does not meet the requested visual quality bar.
- The source uses `Math.random()` while drawing electrical arcs. This makes frame-to-frame visuals non-deterministic; it may be acceptable for decorative lightning but should be replaced by deterministic seeded animation to improve reproducibility and visual stability.

**Recommendation:** keep under **REBUILD / VISUAL QUALITY REVIEW**, pending play evidence. Upgrade to an original jetpack-flight identity with deliberate vertical route planning, distinct obstacle encounters and high-quality art rather than another generic obstacle tunnel. Confirm collision fairness and touch response.

## Source audit limitation

The files above establish shared code paths and declared mechanics, not complete in-motion experience. The next pass must inspect full engine configuration and rendered evidence for all entries, build pairwise comparisons across the entire catalog, and manually play candidates on desktop and the target Android phone. No game receives human QA PASS from this report.

## Required actions from this pass

1. Keep all three racer entries flagged as not signed off until a single-identity decision is made.
2. Keep Rail Rush and Ruin Runner flagged until the claimed train/ramp mechanics are verified as materially distinct.
3. Keep Jet Blaster as a potentially distinct candidate but block sign-off pending a substantial visual/gameplay polish pass.
4. Expand this evidence format to every flagged pair and record final decisions in the audit tracker.
5. After disposition, remove retired games from every catalog-facing and competitive path consistently; preserve historical score records safely.
