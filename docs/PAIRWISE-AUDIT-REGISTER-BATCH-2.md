# Pairwise Audit Register — Batch 2: Source-Confirmed Duplicate Findings

Audit ref: `71980353979e67c548a67be8af8a4b1806f0f34b`  
Status: source-level findings; still requires visual/device playtest for release sign-off.

## Confirmed high-confidence duplicate

### Gem Rush ↔ Strain Crush — **DUPLICATE: consolidate to one**
Both modules implement an 8×8 adjacent-swap match-3 board, same cell geometry, same pointer handling (swipe or tap two), same gravity/refill movement, same invalid-swap reversal, same timer-drain formula, same combo chain, and essentially the same update loop. Strain Crush changes the theme, gem palette, and some display details; this is not a different gameplay identity.

- Canonical recommendation: **Gem Rush**.
- Retire/rebuild candidate: **Strain Crush**.
- Reason: the source modules share the same control grammar, board rules, objective, fail condition, pacing formula and implementation structure. Gem Rush additionally includes explicit 4-match Flame and 5-match Star power-gem rules; Strain Crush does not show an equivalent unique mechanic in the inspected core.
- Before retirement: verify no event/giveaway or leaderboard references require the stable ID `gl-strain-crush`; preserve historical scores; remove it from new-game selection; old deep links should show a clear consolidated/retired message rather than silently aliasing score submissions.

## Related but not confirmed duplicate

### Sky Flap ↔ Hoop Flap — **LIKELY DISTINCT ENOUGH TO RETAIN, pending playtest**
- Sky Flap: one-tap flight through upper/lower rock-spire gaps, gravity/flap timing, gap tightens and speed rises.
- Hoop Flap: flap-controlled falling/ascending ball through hoop apertures, swish streaks, rim interactions and different score feedback.
- Shared broad tap-to-fly survival genre, but target geometry and precision scoring may be different enough. Keep only if Hoop Flap's hoop interactions are reliable and require distinct timing; if hoop collision is mostly cosmetic and the same single-gap rhythm, consolidate.

### Dunk Flick ↔ Hoop Streak — **DISTINCT INPUT/MASTERY, pending physics QA**
- Dunk Flick: drag-back vector controls shot arc, hoop-to-hoop progression, swish streak.
- Hoop Streak: swipe-up speed/direction controls arc, time-limited shot loop, moving hoop after progression, explicit rim/backboard collision and fire-streak scoring.
- Both basketball shots but controls and attempt structures differ. Retain if shots are fair and reliably register; fix any shot physics/targeting bugs before release.

### Paper Toss ↔ Cup Toss — **OPEN**
Source modules must be compared in full. Both may use swipe-driven projectile arcs; differing objects alone do not qualify. Keep both only if wind/obstacles, throw calibration, rebound/cup target, level objectives or mastery meaningfully differ.

### Sling Siege ↔ Castle Crush — **HIGH-PRIORITY REVIEW; likely overlap but not yet proven duplicate**
- Both are side-view physics destruction games using Matter.js / the Hub physics wrapper, drag-and-release projectiles, breakable fort structures, targets and limited ammunition.
- Sling Siege has material-specific blocks (wood/stone/glass), target aliens and generated fort layouts.
- Castle Crush uses a trebuchet, king targets and a separate fort builder.
- Current evidence supports a strong overlap flag, not an automatic retirement. Compare projectile power/angle model, structure topology, materials, target rules, level generation and post-impact scoring. If these are just equivalent slingshot/trebuchet skins, consolidate; if trebuchet trajectory and fort objectives produce substantially different play, keep only after proving it.

## Tower defense findings

### Pop Defense ↔ Keep Guard — **RELATED CORE; needs decision-system comparison**
Both use `td.js` and a fixed path with tower placement/upgrades/waves. Source shows distinct art direction and unit themes (balloons vs fantasy raiders), but art and enemy skins do not establish gameplay distinctness. Inspect tower roles, target priorities, economy, enemy resistances, path geometry, upgrade decisions, wave pacing and special mechanics. If the strategy remains interchangeable, retain one.

### Lawn Guard and Node Siege
Do not automatically retire:
- Lawn Guard's lane-specific resource/defender placement loop may differ from conventional path defense.
- Node Siege's maze/path-blocking mode can be genuinely distinct if tower placement changes enemy routes and the BFS reroute system is strategically important in actual maps.

## Vehicle missions

### Park Getaway ↔ Cab Rush ↔ Derby Smash — **DO NOT CONSOLIDATE BY SHARED ENGINE ALONE**
All call `TopCar`, but their configured modes have different win conditions:
- Getaway: collect cash and exploit police pursuit.
- Taxi: timed pickups/drop-offs, route navigation and braking.
- Derby: ram rivals, manage collision damage and survive the arena.
Keep them provisionally distinct; playtest each mode for depth, clear feedback and unique progression.

## Immediate next actions
1. Use `gl-gem-rush` as the canonical match-3 identity; mark `gl-strain-crush` for safe retirement or full redesign, not a palette reskin.
2. Build a retired-title compatibility layer that preserves historical score visibility while blocking retired IDs from new giveaway setup and new competitive submissions.
3. Add regression tests for active catalog IDs, retired IDs, event eligibility and score routing before changing the catalog.
4. Continue the 4,950-pair review. The table above is one additional evidence batch, not the entire audit.
