# Earn next season's Season Pass free (48 quests)

Code: `src/pass-quests.js`. Thresholds: `docs/pass-quests.json`, produced by `node tools/pass-quest-sim.js`.
Only honest runs count (held runs never do). Finishing all 48 grants the NEXT season's pass (`pass_owned.source = 'quests'`).
It is cosmetic like everything in the store: no score, entry or tie-break effect.

## How the difficulty was set
The sim uses the same skill model as `tools/score-sim.js` (skill ~ Beta(2, 3.2), 13 games, personal-best percentiles
correlated 0.8 across games, activity rising with skill) and the personal-best anchors in `docs/score-ranges.json`
(good median PB ~ p70, good p90 PB ~ p88, top-1% PB ~ p99, interpolated log-linearly). It binary-searches the tier-III
percentile so that about 5% of active players finish everything.

Result: tier III = personal-best percentile **0.54** in every game, simulated completion **5.1%**.
The killer is breadth: you must be good at all 13 games AND play 28 days / 250 runs in the 56-day season.

## The 48 quests
- 39 = 13 games x tiers I / II / III (personal best this season):

| Game | I | II | III |
|---|---|---|---|
| jetpack-dash | 2,050 | 2,300 | 2,600 |
| drift-rush | 2,700 | 3,050 | 3,400 |
| memory-match | 41,700 | 45,750 | 50,200 |
| high-score | 5,950 | 6,900 | 8,050 |
| terp-tapper | 52,600 | 61,000 | 70,700 |
| munchies-snake | 2,200 | 2,750 | 3,400 |
| brick-breaker | 6,200 | 7,650 | 9,500 |
| sky-hopper | 30 | 35 | 42 |
| void-swarm | 106,550 | 127,400 | 152,350 |
| stack | 1,200 | 1,400 | 1,650 |
| grow-guard | 29,600 | 32,200 | 35,050 |
| sling-smash | 12,900 | 15,300 | 18,150 |
| haze-defense | 29,350 | 32,050 | 34,950 |

- 9 more: play on 28 different days; finish 250 runs; reach free-track level 60 (no boosts); play all 13 games
  in one day; Gold-tier PB in 5, 9 and all 13 games; a 14-day play streak; 30 runs at or above their game's tier-II score.

Re-run `node tools/pass-quest-sim.js` after any game balance change; the server reads the JSON at start.
