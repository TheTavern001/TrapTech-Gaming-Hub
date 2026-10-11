# Deep Game Distinctness, Originality, Gameplay, and Visual Quality Audit

Status: **RELEASE BLOCKER — audit not yet completed**  
Scope: every game in `public/games-lib/catalog.json` and every implementation/asset reachable from each catalog entry.  
Baseline catalog snapshot: 100 games (11 October 2026). The target is a smaller, stronger library if necessary; catalog count is not a success metric.

## Non-negotiable policy

- A passing startup/runtime test does not mean a game is good, distinct, original, or release-ready.
- No game is approved merely because its title, colors, theme, camera, or asset skin differs.
- Keep one definitive game per core gameplay identity. If two games produce substantially the same repeated player decisions, movement loop, objective structure, and fail/success loop, retain the stronger implementation and retire or fundamentally redesign the other.
- Do not preserve redundant entries to inflate the library count. If a game is removed, remove it cleanly from the catalog, routes, search, recommendations, score submission, leaderboards, tests, and assets where safe; preserve historical scores with a clear retired-game state instead of silently corrupting records.
- “AAA” is an aspiration/quality bar, not a claim that can be proven by CI alone. Require documented expert-style human review and device testing; never label the catalog AAA-ready solely from automated tests.
- Reusing shared engine code is allowed. Reusing the same core game loop with a new name or theme is not.

## Phase A — inventory and evidence capture

For each catalog item, record:
1. Stable game ID, displayed title, catalog/category tags, entry URL/module, shared engine, major dependencies and asset sources/licences.
2. A short observed gameplay video or reproducible browser evidence on desktop and Android; if not available, mark **UNOBSERVED**, not PASS.
3. Player verbs, moment-to-moment decisions, main objective, fail state, scoring model, progression, session duration, skill ceiling, random/system behaviour, and the primary source of mastery.
4. Rendering approach, camera, geometry/material quality, lighting/shadows, animation, effects, sound, level variety, HUD readability, responsiveness, performance and accessibility.
5. Startup errors, runtime errors, network/asset failures, input defects, collision/physics defects, exploit/score integrity issues, and reproduction steps.
6. Originality and licence evidence for code, art, models, textures, fonts, music and sound. A game title or reference is not permission to copy protected assets or trade dress.

## Phase B — near-duplicate detection

Compare **all pairs**, not only games within the same catalog category. For each pair, compare the following dimensions on a 0–4 scale (0 = absent/different; 4 = essentially the same). Record evidence and a short explanation for every score.

- Core player verbs and control grammar
- Moment-to-moment decision loop
- Primary objective and win/fail condition
- Spatial structure, camera and movement model
- Challenge generation and enemy/obstacle behaviour
- Scoring, risk/reward and mastery curve
- Progression, upgrade and run structure
- Player fantasy / intended emotional experience
- Visual composition, silhouettes, environment language and HUD
- Audio identity and feedback language
- Level design and encounter grammar
- Technical/gameplay implementation overlap

**Automatic review flags:** any pair with core-loop similarity >= 3; three or more dimensions scoring >= 3; same shared-engine template plus same control/objective loop; or one game appearing to be a renamed/re-skinned variant of another. Flags require human adjudication; the numeric score is triage, not a legal conclusion.

Output a pairwise matrix and connected duplicate clusters. Every cluster must end with one of:
- **KEEP ONE** — select a single best implementation and document why.
- **REBUILD AS DISTINCT** — specify materially different verbs, decision loop, objectives, level structure and feedback before coding.
- **KEEP BOTH — DISTINCT** — provide concrete observed evidence of meaningfully different play, not just theme/art differences.
- **HOLD FOR RIGHTS REVIEW** — origin/licence/visual-expression concerns remain unresolved.

## Phase C — core identity test

A candidate is not distinct enough if the only meaningful changes are title, palette, backdrop, player model, speed, obstacle art, minor power-ups, or scoring multiplier.

A game qualifies as a separate identity only when it has a defensible combination of:
- a different primary player decision and control grammar;
- a different repeated decision/feedback loop;
- a different objective/fail-state structure or spatial problem;
- a different mastery curve and meaningful strategic trade-offs; and
- enough distinct level/encounter design to sustain the identity.

For example, several endless runners that only vary lanes, jump timing and scenery count as one identity family unless one is redesigned around a genuinely different central mechanic. Several vehicle games are not automatically duplicates, but drifting through checkpoints, traffic weaving, demolition combat, and logistics/vehicle recovery can be distinct if their actual mechanics and levels support those differences. These are examples, not pre-approved decisions about any catalog entry.

## Phase D — gameplay depth and correctness

Every retained game must be manually played from cold start through multiple rounds/levels on desktop and Android touch, including failure, restart, pause/resume where supported, return to hub and score submission.

Check:
- responsive, predictable controls and a readable tutorial/onboarding;
- meaningful decisions beyond repeating one input;
- fair, learnable difficulty curve and sufficient variation;
- collision boundaries, physics, cooldowns, timers, spawn logic, RNG and edge cases;
- all win, loss, timeout, pause, restart and abandonment states;
- no softlocks, impossible states, input dead zones, invisible hazards or unavoidable damage;
- score determinism and server-side score validation; duplicate, forged, replayed and out-of-range scores rejected;
- no paid items, paid upgrades or monetized boosts that improve competitive scores or giveaway odds;
- accessible HUD, contrast, sound controls, reduced-motion considerations where feasible;
- repeat play is meaningfully different, not only a different random seed or cosmetic theme.

Record at least three distinct play sessions per retained game across devices; for score/competitive games include a low-skill, normal and high-skill run when practical. Automated tests should cover deterministic mechanics and exploit regressions.

## Phase E — visual/audio quality gate

Visual quality must be judged in motion, at phone resolution, not from a title card or static screenshot. Score each dimension 0–4 and attach screenshots/video evidence:
- coherent visual direction and original art identity;
- environment depth, composition, silhouette readability and spatial landmarks;
- high-quality geometry/materials/textures and non-repetitive scene dressing;
- lighting, shadows, post-processing and effects appropriate to the device;
- character/vehicle/enemy animation, anticipation, impact and transitions;
- camera motion, framing, speed sensation and feedback clarity;
- distinctive environments, encounters and meaningful set-piece variation;
- polished HUD, typography, menus, loading, pause, results and accessibility;
- cohesive sound design/music, spatial cues and responsive audio feedback;
- stable performance and frame pacing on the target Android device and desktop.

**Fail** if the scene is mainly primitive placeholders, repeated obstacle rows, generic copied runner/racer scaffolding, mismatched asset styles, broken animation, low-contrast gameplay, placeholder audio, obvious visual bugs, or reskinned content with no distinctive level design. A high average cannot hide a critical failure in controls, clarity, or stability.

## Phase F — mobile performance and compatibility

Test the target Samsung Galaxy S21 FE 5G and a desktop browser at realistic viewport sizes. Capture actual device/browser, build SHA, resolution, frame-time/frame-rate evidence, memory/asset failures, load time and network conditions. Test touch controls with one hand and common Android browser UI/viewport changes. Headless WebGL metrics are diagnostic only; they do not substitute for real-device performance.

Targets for review (not automatic claims): stable 60 FPS where the game/device supports it; no sustained frame pacing spikes, severe thermal degradation, viewport overflow, accidental page scrolling, or touch controls hidden by browser chrome. If 60 FPS is not achievable, document the reason and a stable fallback target.

## Phase G — rights and provenance review

For each retained game, document provenance and licence for every third-party code package and material asset. Flag copied game-specific names, characters, level layouts, artwork, music, sound, UI composition, distinctive animations, or other expressive elements for review. Genre conventions and broad mechanics are not by themselves proof of infringement, and a similarity score is not a legal ruling. Do not market a game as an exact copy of a commercial title. Obtain legal review where meaningful concerns remain.

## Phase H — decisions and release gates

Each game must have one row in `docs/GAME-QA-TRACKER.md` or a linked detailed report containing:
- identity summary and unique-mechanics statement;
- nearest neighbour(s), pairwise scores and adjudication;
- disposition: KEEP / REBUILD / RETIRE / RIGHTS HOLD;
- defects with severity, issue link, reproduction steps and retest evidence;
- gameplay, visual/audio, mobile performance, accessibility, rights and score-integrity status;
- reviewer, date, device/browser, commit SHA, evidence links and retest result.

No entry may be marked **PASS** unless every applicable gate is evidenced. Unknown or untested means **NOT SIGNED OFF**. Any unresolved critical/high-severity defect, duplicate-cluster decision, rights hold, or score exploit blocks release. The Hub may launch with a smaller curated set; it must not launch with known redundant, broken, or unreviewed games simply to reach 100 or 150 entries.

## Required deliverables

1. Complete machine-readable inventory of every catalog game and its entry/module/assets.
2. Pairwise similarity matrix with explainable evidence and duplicate clusters.
3. Decision log identifying which game is retained from each redundant cluster and why.
4. A smaller curated catalog plan with distinct core-loop families and no placeholder entries.
5. Per-game gameplay and visual/audio scorecards with screenshots/video from desktop and Android.
6. Prioritized defect backlog and fixes, followed by automated regression and human retest.
7. Rights/provenance register.
8. Release report listing retained games, retired games, unresolved blockers, build SHA and explicit sign-off.

## Current known status

The previous 100/100 automated catalog audit established basic startup/runtime, input, score acceptance/rejection and some render-budget checks. It did **not** establish distinctness, original art, deep gameplay, AAA-level visual quality, real-device stability or legal clearance. All games remain **NOT SIGNED OFF** until this deeper audit is performed.