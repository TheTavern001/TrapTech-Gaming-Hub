# Deep AAA Graphics & Gameplay Audit — Batch 5

Scope: source-level review of selected overlap families and quality gates. This is not a rendered-image, frame-rate, or hands-on gameplay sign-off.

## 1. Duplicate and near-duplicate findings

### Sky Flap vs Hoop Flap — **NEAR-DUPLICATE CORE LOOP; HOLD BOTH FROM “DISTINCT” CLAIM**
- Sky Flap: one-tap vertical flyer, gravity/flap impulse, horizontal scrolling obstacles, narrow gap clearance, +1 per gate.
- Hoop Flap: one-tap vertical flyer, gravity/flap impulse, horizontal scrolling hoops, vertical alignment on crossing, swish bonus.
- Hoop Flap's downward crossing / hoop alignment / swish streak changes the scoring moment, but both share the same repeated action: tap to adjust vertical flight and pass sequential moving obstacles. That is a small variation, not yet strong evidence of a distinct game.
- Recommendation: either (a) keep Sky Flap and redesign Hoop Flap around basketball-specific shot arcs, moving defenders/hoop timing and meaningful swish/rim mechanics, or (b) consolidate them. Do not advertise both as meaningfully different until playtests prove otherwise.

### Pop Defense vs Keep Guard — **SAME GENRE/ENGINE; DISTINCTNESS NOT YET PROVEN**
- Both explicitly use the shared `td.js` path-defense engine. Pop Defense uses a road/path with balloons and image-based tower assets; Keep Guard uses a fantasy forest theme and code-drawn towers/raiders.
- Visual theme and tower art are not sufficient. Compare tower targeting/roles, enemy resistances, path geometry, economy, upgrade choices, active abilities, wave composition and boss rules.
- Recommendation: HOLD for a mechanics matrix. If tower choices and wave counters are equivalent, consolidate one or redesign a materially different economy/path-blocking/hero-control system.

### Sling Siege vs Castle Crush — **STRONG OVERLAP, BUT POTENTIALLY DIFFERENT PHYSICS/LEVEL DESIGN**
- Both are projectile-driven destruction games using Matter.js/Phys physics, breakable forts and targets.
- Sling Siege exposes material-specific block HP/density/value and an unused-shot bonus; Castle Crush frames a trebuchet and crowned-king targets with generated forts.
- A trebuchet skin and different target sprites are not enough. Compare aiming model, projectile arc/power feedback, material simulation, structure topology, number of shots, target placement, level progression and failure/retry costs.
- Recommendation: retain both only if their firing models and encounter construction create different repeat decisions; otherwise redesign one as a distinct siege mechanic.

### Alien Rows vs Star Swarm — **CONDITIONALLY DISTINCT**
- Alien Rows has marching formations, a player rail, shots/bombs, shields and wave clears.
- Star Swarm has custom pixel-art enemy variants and a formation shooter with diving bugs.
- Keep both only if diving patterns force materially different dodging, target-priority and timing decisions across later stages. If divers are cosmetic/rare and the core is still shooting rows, consolidate or redesign one.

### Rail Rush vs Ruin Runner — **DUPLICATE CONFIRMED AT ENGINE/CONFIG LEVEL**
- Both call `runner3x.js` with speed 15 and coin value 10. Main visible distinction is environment/theme and help text; both lane-change, jump and slide/roll.
- Recommendation: retain one canonical runner. If both are desired, redesign one with genuinely different route topology, traversal verbs, camera/physics or encounter systems. Do not treat the different environment as gameplay distinction.

### Park Getaway / Cab Rush / Derby Smash — **PROVISIONALLY DISTINCT MODES; ENGINE QUALITY GATE**
- All are thin configuration calls into `topcar.js`, but select getaway, taxi and derby modes respectively.
- Different objective verbs are present: evade cops/collect cash, perform pickup/drop-off missions with braking, or ram rivals with directional impact concerns.
- Keep all three only if each mode has distinct opponent AI, mission generation, damage/handling feedback, and scoring. Shared engine is acceptable; modes that amount to different scoring labels on the same drive loop are not.

## 2. Visual and gameplay quality audit

### Source-visible strengths
- Sky Flap loads a coherent sprite set and has geometry-aware obstacle collision rather than only a title-screen reskin.
- Pop Defense uses a documented CC0 tower-defense asset pack; Sling Siege documents CC0 physics assets and material-specific block properties.
- Star Swarm has hand-authored pixel sprite maps and multiple enemy variants.
- Putt Party, Pin Strike, Block Drop and Maze Muncher implement systems that support skill variation (hazards/physics, pin collision, piece hold/ghost/wall kicks, and hunter targeting respectively).

These are implementation clues, not a claim that the games meet AAA quality.

### Release-blocking quality gaps visible from source/config
1. **2D canvas ceiling vs requested AAA look:** many titles are deliberately code-drawn or sprite-based 2D games. Polished 2D can be excellent, but these should not be described as AAA 3D graphics. A true high-end 3D standard requires authored models/materials, lighting/shadows, animation, camera work, effects, audio and performance testing—not just gradients, glow, particles or more sprites.
2. **Catalog tiers are unsubstantiated:** the catalog assigns `tier: "A+"` broadly, but the tier field has no linked evidence rubric, screenshot set, performance report or human sign-off. Treat it as an unverified label; remove/replace it or add objective evidence gates before public marketing.
3. **“Original Hub build” is not provenance proof:** catalog licence text repeatedly asserts original code and MIT licensing. Verify that code ownership and the stated licence are accurate for every file, and retain third-party notices for external engines/assets. Do not assume a reference title (e.g., a named commercial game in `ref_internal`) proves infringement, but review visual/audio/level/branding similarity and trademark risks.
4. **Canvas code can conceal weak feedback:** check readable silhouettes at phone scale, anticipation cues, hit-stop/recoil, animation states, hit flashes, camera framing, layered backgrounds, coherent UI typography, sound mix and meaningful transitions. Glow and particles alone do not establish impact.
5. **Gameplay depth is not inferred from line count:** require escalating mechanics, enemy/obstacle combinations, level/mission variety, fair telegraphing, counterplay, a learning curve and a non-repetitive late game. “Endless” with only speed increases is a limited loop.
6. **Mobile controls need physical-device testing:** inspect pointer/touch target sizes, swipe capture, screen aspect-ratio scaling, safe-area overlap, accidental browser gestures, pause/resume after app backgrounding, audio resume after touch, and 30/60 fps frame pacing.
7. **Scoring fairness matters:** competitive/giveaway entries need deterministic rules, stable game IDs, validated score submission, replay/forgery resistance appropriate to the threat model, and consistent game build/version pinning for an event.

## 3. Required AAA sign-off card for every title

Each game must have a record with evidence, not a self-awarded letter grade:

- **Visuals:** representative gameplay screenshots at native resolution; model/sprite provenance; animation/lighting/post-process audit; mobile readability; visual bugs and clipping.
- **Gameplay:** 10-minute first-play session, later-stage session, fail/retry loop, difficulty curve, distinctness comparison, bugs with reproduction steps.
- **Controls:** touch and keyboard tests; input latency; gesture conflicts; accessibility and remapping where applicable.
- **Performance:** target device and browser/app build; median and 1% low frame time; memory; load time; thermal/battery observation; asset loading failures.
- **Audio:** effects/music provenance, mix, mute controls, mobile autoplay/resume, clipping and latency.
- **Stability:** pause/background/foreground, restart, exit, resize/rotate, score submission, reconnect and stale-session handling.
- **Rights:** per-file code/assets/fonts/audio licences, attribution obligations, trademark/trade-dress review.
- **Decision:** KEEP, REBUILD, RETIRE, RIGHTS HOLD, with reviewer, build hash and date.

No title passes solely because it boots or because an automated smoke test passes.

## 4. Next implementation gate
1. Build a catalog-to-runtime inventory of all 100 entries and verify every `url`, `art`, module path, shared engine and licence reference resolves.
2. Generate a full duplicate candidate matrix from shared imports/configs and gameplay descriptors, then manually inspect every high-similarity pair. The full 100-title universe contains 4,950 unique pairs.
3. Choose safe canonical IDs before retiring duplicates. Preserve historic scores/events; block new entries to retired IDs; old links must show an explicit retired/consolidated message. Never silently reroute a score to another game.
4. Add per-game visual/gameplay evidence records and automated mobile/resolution/input regression where feasible.
5. Run human QA on desktop and Samsung Galaxy S21 FE, then record results. No human device sign-off has been performed as part of this source-only batch.

## Current status
This document adds source-backed findings and release gates only. It does not change runtime code, remove catalog entries, prove AAA quality, or complete the full pairwise audit.