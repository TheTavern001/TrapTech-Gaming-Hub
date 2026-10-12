# Pairwise Audit Register — Batch 3: Additional Gameplay Loop Comparisons

Status: source-level inspection of selected modules; human/device testing remains required.

## Findings

### Paper Toss ↔ Cup Toss — related genre, **different candidate loops**
- Paper Toss: one flick into a fixed bin, wind applies lateral acceleration, three misses end the run; score rewards difficult wind.
- Cup Toss: perspective table with a rack of cups at changing distance, swipe direction/power, ballistic arc, table bounces/rim collisions, clear rack and re-rack progression.
- **Provisional: KEEP BOTH**, only if Cup Toss's perspective/ballistic collision and rack progression work consistently on mobile. A shared swipe-throw input is not enough to call these duplicates because the target geometry, world model and progression differ.

### Knife Toss ↔ Pen Throw — **related genre, different timing grammar**
- Knife Toss: throw into a rotating target; avoid existing knives, target rotation accelerates/changes, apples give bonuses, stages reset the target.
- Pen Throw: launch a pen straight up to hit horizontally moving/bobbing fruit; accuracy rewards center hits; a miss ends the run.
- **Provisional: KEEP BOTH** if timing is fair and the stages/target behaviour are legible. One tests angular gaps on a rotating target; the other tests intercept timing against moving targets. Theme alone is not the differentiator.

### Sky Flap ↔ Hoop Flap — **possible overlap but not confirmed**
- Sky Flap uses tap-controlled gravity flight through rock-spire gaps, with speed/gap tightening.
- Hoop Flap uses tap-controlled flight through hoops, with descent timing, rim interactions and swish streaks.
- **Provisional: KEEP BOTH only if** hoop apertures/rims create reliable distinct timing and precision decisions. If it's simply the same one-tap gap flight with round gates, consolidate.

### Gem Rush ↔ Strain Crush — **confirmed duplicate; already documented in Batch 2**
Both use the same 8×8 adjacent-swap match-three loop and timing/refill structure. Keep Gem Rush; Strain Crush needs full redesign or safe retirement.

### Block Drop vs Hex Stack — **not decided**
The fetched source path for Hex Stack did not resolve at the current ref, so no source-level similarity score is assigned. Do not infer duplication from title or genre. Resolve the actual catalog URL/module before adjudication.

### Alien Rows ↔ Star Swarm — **related arcade shooter, not automatic duplicate**
- Alien Rows: player movement on a horizontal rail, auto-fire/space fire, marching invader formations and waves.
- Star Swarm: formation shooter with custom pixel-art enemy types, diving patterns and stage structure.
- **Provisional: KEEP BOTH only if** Star Swarm's dive/formation attacks create different dodge/target priorities than the marching rows. If both reduce to horizontal movement + shoot marching enemies, consolidate.

### Road Hopper ↔ Toad Cross — **high overlap risk; compare mechanics carefully**
- Road Hopper is a 3D voxel lane-crossing hopper using the shared runner-stage framework and chase camera.
- Toad Cross is a 2D top-down road-and-river crossing game with timed hops, moving cars, logs/turtles, and five home slots to fill.
- **Provisional: KEEP BOTH** only if 3D movement/perspective and hazard grammar create a meaningfully different experience. Their core fantasy (cross dangerous traffic/lanes) overlaps, but 2D river/log navigation and five-home objective may be sufficiently distinct. Need direct play comparison.

### Mine Sweep ↔ Tile Twin — **distinct puzzle systems**
- Mine Sweep: information deduction, hidden mines, reveal/flag decisions, board-clear risk.
- Tile Twin: Mahjong solitaire, identify free matching pairs, remove blocking tiles, solvable layouts and reshuffles.
- **KEEP BOTH — DISTINCT**. Shared tile grid does not imply similar reasoning loop.

## Additional visual quality concerns observed from source (not screenshot sign-off)
- Gem Rush and Strain Crush both draw simple canvas boards; Strain Crush's code is substantially the same board/update system. Their visual reskin reinforces the duplicate finding.
- Paper Toss's visible draw loop uses a small set of flat shapes; Cup Toss builds a richer perspective table, but source code alone cannot establish polished final presentation.
- Pen Throw's fruit target and pen are simple geometric primitives. This is a visual-depth issue, not a duplicate verdict.
- High-quality source structure does not prove AAA visuals. Screenshot/video review and device testing are required for every retained title.

## Limits
This batch is selective, not the complete catalog. It does not assign a similarity score to pairs whose modules were not successfully resolved. No catalog entries are deleted in this document.