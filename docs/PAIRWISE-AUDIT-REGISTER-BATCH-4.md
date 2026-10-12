# Pairwise Audit Register — Batch 4: Puzzle, Arcade, and Sports Families

Status: selected source-level inspection. These are not human playtest sign-offs.

## Puzzle and reflex loops

### Block Drop ↔ Hex Spin — **DISTINCT**
- Block Drop implements a 10×20 falling tetromino board, piece rotation, line clearing, 7-bag piece distribution, hold/ghost features and stacking pressure.
- Hex Spin is radial survival: orbit a core while rotating six-sector walls close in; the player must align with gaps.
- These differ in spatial model, verbs, objective and mastery. Keep both.

### Glow Echo ↔ Beat Tiles — **DISTINCT**
- Glow Echo is sequence-memory recall: observe an increasingly long pattern and reproduce it, with a fifth pad and shuffled positions at later rounds.
- Beat Tiles is continuous rhythm/timing: tap/hold scrolling tiles before they pass; missed tiles or empty-lane taps end the run.
- Memory recall and real-time rhythmic execution are different skills. Keep both.

### Neon Serpent ↔ Maze Muncher — **DISTINCT**
- Neon Serpent is grid navigation with a growing tail, queued turns and self-collision risk.
- Maze Muncher is maze navigation under pursuit by four hunters with distinct targeting, dot collection and power-pellet reversals.
- Both use grids, but the pursuit/route-planning and enemy AI make Maze Muncher a distinct identity. Keep both if hunter behaviours work as intended.

### Brick Blitz vs Orb Coil — **OPEN**
Both are arcade board-clearing games, but do not decide by genre alone. Inspect Orb Coil's marble-chain movement, chain-reaction matching, route and fail state against Brick Blitz's paddle-controlled ball ricochet, brick health, multi-ball and power-ups. If one is just another ball-bounce/target-clear loop, consider redesign; otherwise keep distinct.

## Arcade shooters

### Bug Blaster ↔ Alien Rows ↔ Star Swarm — **RELATED FAMILY; KEEP/RETIRE DECISION NEEDS GAMEPLAY EVIDENCE**
- Bug Blaster uses a bottom-zone player and a segmented Centipede-like enemy that navigates a mushroom field; player shots can alter the field and enemy path.
- Alien Rows uses a horizontal player rail against marching formations.
- Star Swarm is a formation shooter with enemy dive/attack patterns.
- The decision system may differ: obstacle-field manipulation vs fixed formation shooting vs dodge-and-target priorities. Keep separately only if the latter two show genuinely different enemy attack patterns and tactical demands. Do not count palette changes or enemy art as uniqueness.

### Rock Buster ↔ Star Swarm — **DISTINCT CANDIDATES**
Rock Buster is a free-space thrust/rotation shooter with inertial movement and destructible asteroids; Star Swarm is a formation/attack-wave shooter. These require different movement and target-priority skills. Keep both if controls are reliable and waves have meaningful variation.

### Missile Guard ↔ Rock Buster — **DISTINCT**
Missile Guard is a stationary city-defense interception loop: tap to detonate interceptors against incoming threats and protect cities. Rock Buster is a player-controlled spacecraft in continuous inertial movement. Distinct verbs, spatial model and objective. Keep both.

## Sports gameplay

### Bat Boy ↔ Long Ball — **HIGH OVERLAP; retain one unless proven meaningfully different**
Both are batting timing games where a pitch approaches and the player taps to swing, then receives a distance/home-run score. Long Ball adds pitch types, lateral contact location, more detailed trajectory and a 10-out format; Bat Boy has a simpler timing window and three-strike structure. Those differences may justify a deliberate casual vs simulation progression, but as currently described they are close enough to require direct comparison. Recommendation: keep Long Ball as the deeper batting title; either retire Bat Boy or redesign it into a different baseball mechanic (e.g., fielding/throw decisions) rather than a simpler clone.

### Spot Kick ↔ Long Ball — **DISTINCT**
Spot Kick uses swipe trajectory/power/curl to place a penalty shot against a keeper who reacts after a delay; three saves/misses end the run. Long Ball is timing/contact hitting against pitches. Different sport action and mastery. Keep both.

### Putt Party ↔ Pin Strike — **DISTINCT**
Putt Party is top-down miniature golf with pull-back putting, slopes, sand, water, moving sweepers, par and strokes. Pin Strike is perspective bowling with ball placement, hook/curve, pin collisions and frame scoring. Both are precision sports physics, but target and control loops differ. Keep both.

## Visual/implementation notes
- Several 2D titles use code-drawn canvas scenes. This can be polished, but does not by itself establish AAA visual quality. The source shows meaningful systems in Block Drop, Maze Muncher, Putt Party and Pin Strike, yet screenshot/video/device evidence is still needed.
- A deeper source review must verify deterministic random seeding, collision edge cases, accessible touch targets, restart/pause/resume behaviour, scoring integrity and level variety.
- “Distinct” here means distinct core loop, not automatic release approval.

## Audit scope
This is another selected batch. It does not complete the 4,950-pair matrix, and no games are removed by this document.