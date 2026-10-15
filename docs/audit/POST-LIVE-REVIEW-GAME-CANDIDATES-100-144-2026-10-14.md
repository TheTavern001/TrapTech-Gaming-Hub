# Post-private-review expansion candidates: user-supplied #100–144

**Status: backlog only — NOT added to the playable catalog, not licensed, not AAA-certified and not approved for giveaways.**

Source: owner's October 14, 2026 follow-up. Prioritize after existing Hub UI, avatar, store, security, booking, official-prize gates and the current 87 proposed playable games have undergone live phone review. These titles are references for **original, licensed browser-playable implementations**, not authorization to copy proprietary game files, characters, names, music, artwork or trademarks.

| # | Reference concept | Distinct primary mechanic | Intended fair competition metric |
|---:|---|---|---|
| 100 | Piano Tiles | Rhythm, tap sequence | Longest valid sequence, score/combo |
| 101 | Sudoku | Logic solving | Time, difficulty-adjusted accuracy |
| 102 | Mahjong Solitaire | Tile matching | Time, efficiency |
| 103 | Stack | Precision stacking | Height |
| 104 | Knife Hit | Timing / projectile placement | Score |
| 105 | Dunk Shot | Basketball trajectory | Consecutive shots |
| 106 | Flappy Dunk | One-button basketball | Score |
| 107 | Baseball Boy! | Batting distance | Distance |
| 108 | Pineapple Pen | Precision throwing | Score |
| 109 | Whac-A-Mole | Reaction speed | Hits/accuracy |
| 110 | Duck Hunt | Aim / reflex | Score |
| 111 | Paper Toss | Angle / power | Score |
| 112 | Skee-Ball | Physics aiming | Score |
| 113 | Space Cadet Pinball | Pinball physics | Score |
| 114 | Track & Field | Rapid-input timing | Score |
| 115 | Typing Challenge | Typing speed / accuracy | WPM and accuracy |
| 116 | Street Fighter II | Fighting / patterns | Survival and score |
| 117 | Mortal Kombat | Fighting / combos | Survival and score |
| 118 | Punch-Out!! | Pattern recognition / counters | Opponents defeated and time |
| 119 | Endless Beat-'Em-Up | Crowd combat | Kills and combo |
| 120 | Endless Sword Arena | Melee timing | Kills and survival |
| 121 | Endless Archery | Aim / moving targets | Score |
| 122 | Boss Rush | Boss attack patterns | Time and damage |
| 123 | Ninja Survival | Movement and melee | Time and kills |
| 124 | Basketball Shot Challenge | Accuracy | Consecutive shots |
| 125 | Soccer Penalty Challenge | Aim | Goals |
| 126 | Home Run Derby | Batting power / accuracy | Distance |
| 127 | Bowling | Physics / aim | Score |
| 128 | Golf Challenge | Power / angle | Strokes (normalized challenge rules) |
| 129 | Tennis Rally | Timing / returning | Longest rally |
| 130 | Hockey Shootout | Aim / timing | Goals |
| 131 | Skateboard Trick Challenge | Combo scoring | Trick score |
| 132 | Pool / Billiards | Physics / angles | Balls cleared + efficiency |
| 133 | Fishing Challenge | Timing / reeling | Weight and rarity |
| 134 | Tron Light Cycles | Territory / trails | Survival and area |
| 135 | Lunar Lander | Precision physics landing | Fuel and accuracy |
| 136 | Marble Madness | Physics maze racing | Time |
| 137 | Frogger | Traffic / timing / route planning | Crossings |
| 138 | Rally-X | Maze driving / smoke | Score |
| 139 | Tapper | Reaction / resource management | Customers |
| 140 | Paperboy | Route accuracy | Deliveries and damage |
| 141 | WorldBox-style Sandbox Challenge | Simulation and creative destruction | Objective-specific score |
| 142 | Happy Wheels | Ragdoll physics | Distance and survival |
| 143 | World of Goo-style | Physics construction | Height and efficiency |
| 144 | Bad Piggies | Vehicle-construction physics | Distance and efficiency |

## Duplicate-family audit before admission

- **100** overlaps existing rhythm/sequence titles; check against `gl-beat-beat`, music input titles and other timing games.
- **103** overlaps the existing stacker family; only add a genuinely distinct implementation or improve the existing Stack title.
- **105 / 106 / 124** are related basketball/reflex concepts; compare one-button vertical obstacle play versus precision trajectory and accuracy streaks.
- **107 / 126** overlap batting-distance family. One highest-quality representative unless gameplay rules materially differ.
- **108 / 109 / 110 / 111 / 112 / 121** are distinct aiming/reaction subfamilies, but verify controls do not merely swap target artwork.
- **116 / 117 / 118 / 119 / 120 / 123** need mechanic-by-mechanic review to prevent the combat/fighting catalog becoming several skins of the same game.
- **134 / 137 / 138** have distinct trail, crossing and maze-driving mechanics despite similar overhead presentation.
- **142 / 143 / 144** need original licensed physics implementations, not scraped commercial game binaries. Compare with the existing destruction/building mechanics.
- **102** must use a challenge length or rotating board library that produces a meaningful fair score; **101** similarly needs identical or auditable seeded puzzles across entrants.
- **128** lower-is-better stroke counting needs a normalized challenge configuration; all contest scores must be nonnegative, server-replayable and comparably ranked.
- **141** sandbox objectives must be deterministic and objectively verifiable; sandbox free-form creativity alone cannot award competitive prizes.

## Admission gates (unchanged)

1. Confirm it is a distinct **mechanical family** and worth replacing/adding alongside one of the existing 87 titles. Merge/remaster rather than create reskinned duplicates.
2. Obtain legal commercial hosting rights for all code, sounds, art and meshes; pin attribution, file hashes, license, and version in repo. Famous reference titles are **not** a rights grant.
3. Adapt to portrait-first Android and iOS, safe areas, responsive touch controls, 60fps target when capable, device-appropriate rendering resolution and quality settings.
4. Audit gameplay feel, collision, difficulty progression, restart, pause/background/resume, audio feedback, and no exploitable maximum score.
5. Add seeded challenge inputs, server-authoritative scoring and independent replay adjudication before enabling **official prize** eligibility. Any unapproved game remains free play only.
6. Complete targeted unit/smoke tests, real device QA and owner acceptance. Catalog presence and sprite previews do not imply game approval.
7. Increment game batches **after** first integrated private Hub and existing game quality review; maintain target of approximately 500 truly distinct, worth-playing games.

**Resume point:** Do not implement this backlog during the current R1 pre-deployment stabilization. The owner's next priority is Deplexo private review of the already-existing Hub. Keep this file as the exact additional candidate list for later expansion.
