# Full Deep AAA Audit — Hub, Games, Cosmetics, Achievements, Quests

Status as of 2026-10-22, branch `claude/fix-cosmetics-quests-4l4mnz`. This replaces the 2026-10-19 plan that used to live
in this file. `docs/AAA-FINAL.md` and `docs/READY-FOR-REVIEW.md` are superseded by this document.

## What went wrong on 2026-10-19 → 2026-10-21

A series of commits ("Wire … AAA …", "Fix startup …", "Add … stubs") replaced working server modules with short stubs
and wired in generated drafts. Last known-good commit for all of them: `099effa`.

| File | Good (`099effa`) | Broken (`24bc664`) | Effect |
|---|---|---|---|
| `src/cosmetics.js` | 171 lines, 57 banners / 34 frames / 74 titles, placeholder safety net | 84-line stub over `cosmetics-aaa-full.js` | `COS.generated` missing → cosmetics, systems and startup tests crash |
| `src/achievements.js` | 335 lines, 138 achievements, server-side `evaluate` | 90-line stub | no real achievements, profile/auth stubs |
| `src/rotating-quests.js` | 124 lines, 3,150 templates, `periodKey`/`rotation`/`validateRotation` | 37-line wrapper over `quests-aaa.js` | `/api/rotating-quests` throws (rotation functions deleted) |
| `src/admin-sec.js` | 415 lines: secret path, password + TOTP, CSRF, lockouts, audit log | `requireRole()` calls `next()`, `mount()` is a no-op | **every admin API route is unauthenticated** (see below) |

## Fixed on this branch

- **Cosmetics** restored from `099effa`, then the AAA work merged properly:
  - `cosmetics-aaa-full.js` art applied to the same hand-made ids (ids/names unchanged → no ownership or equip regressions).
  - `cosmetics-expansion.js` banners/frames/titles added as new ids (collision-checked against hand-made and shop ids).
  - Catalog: 71 banners, 39 frames, 84 titles; 0 reward ids fall back to generated placeholders.
- **Achievements** restored (138) + 9 entries from `achievements-expansion.js` merged → 147 hand-made, plus 11,573 skill
  ladders from `src/skill-engine.js`. Only entries scored from stats the server really computes and paid in
  banner/frame/title are merged (shop-purchase counts are not tracked; colour/effect rewards would break `ownedFrom`).
- **Rotating quests** restored: 3,150 templates, deterministic HMAC rotation, client-tamper validation.
- **Games library metadata**: Bud Merge is an original Kit build since 2026-10-17 but was still registered as vendored
  2048 (licence warning). Registry, `catalog.json` and `docs/GAMES-LIB.md` now say `built` / MIT Trap Tech.
- **Audit tools** no longer report the six retired duplicate ids (wreck-ride, rig-rally, drift-king, dune-glide, egg-roll,
  monster-crush — redirects only) as giveaway blockers or duplicate loops: `games-lib-integrity-audit.js`,
  `prelaunch-deep-audit.js`, `e2e-games-lib.js` eligibility gate.

## Quests: what actually exists

The hard, skill-based quest system the hub needs is already live: `src/skill-engine.js` → `/api/skill/quests` (UI in
`public/js/v8.js`). Per-user daily/weekly/seasonal boards with score targets, *beat your own best*, consistency, survival,
variety and play-day quests, scaled from each game's score tiers; progress is read from accepted (held=0, non-demo) runs;
claims are idempotent and pay Hub Credits plus earn-only cosmetics at elite/mythic. 7,935 quest variants across 87 games.

`/api/rotating-quests` (the 3,150-template board) is a separate, preview-only layer and is not shown in the UI. It does not
need its own progress engine; building one would duplicate the skill engine.

Not wired, by design: `quests-aaa.js` objectives such as "perfect clear", "equip a full set", "win a friend challenge" have no
server-side event source; `quests-mass.js` / `quests-expansion.js` / `achievements-mass.js` / `achievements-aaa.js` /
`cosmetics-aaa.js` / `cosmetics-aaa-design.js` / `shop-gen-aaa.js` are unreferenced drafts (mass ladders duplicate the skill
engine; several reward ids that do not exist).

## Verification (local, Node 22, fresh DB)

| Check | Result |
|---|---|
| `npm run test:cosmetics` | OK — every reward id has a design |
| `npm run test:systems` | 52/52 (one run hit the heap-growth threshold at 40.05 MB vs 40 MB; same flake on `099effa`, unrelated) |
| `npm run test:rotating-quests` | passed, 3,150 templates |
| `npm run test:rewards-startup` | 8/8 |
| `tools/test-full-hub-meta-contract.js` | pass |
| `tools/e2e-economy.js` / `e2e-timers.js` / `e2e-anticheat.js` / `e2e-tiebreak.js` | 49/49 · 27/27 · 12/12 · 4/4 |
| `tools/games-lib-integrity-audit.js` | 0 blockers, 0 game problems |
| `tools/prelaunch-deep-audit.js` | 0 blockers, 0 duplicate findings |
| `tools/e2e-games-lib.js` (80 library games, desktop + iPhone emulation) | GAMES_LIB_RESULT |

## Open blockers

1. **Admin authentication (critical, not yet fixed on this branch).** With the stubbed `src/admin-sec.js`,
   `GET /api/admin/games-lib/playoffs` answers 200 without a session, and the matching POST routes that create and resolve
   giveaway tie-break playoffs are equally open; the real admin panel (secret path, password + TOTP) does not mount at all.
   `e2e-api`, `e2e-events` and `e2e-avatars` fail on exactly this. Fix: restore `src/admin-sec.js` from `099effa`.
   The 2026-10-20 change "owner always accepts ADMIN_PASSWORD env var" is a separate owner decision (it lets the env
   password override a password changed in the dashboard; TOTP is still required).
2. Stale tests, failing identically on `099effa`: `e2e-cosmetic-orders` (expects paid checkout open; it is closed by default),
   parts of `e2e-events` (vendor share kit / inactive event).
3. Human release gates (`tools/public-release-gate.js`): owner visual acceptance, Deplexo at exact main SHA, Stripe test
   checkout + signed webhook + refund, live merchant/terms, backups/restore, 10k staging load, real Android/iOS device passes.
   These need the owner and live infrastructure; they are not code defects.
4. True 3D wearables / finished assets via Cloudflare R2 (`docs/R2-SETUP-AND-NEXT.md`) — infrastructure, not started.

## Round 2 (2026-10-22): game audit fixes

- **Retired duplicates (owner decision):** Alien Rows → Star Swarm, Hex Stack → Block Drop. Retired library titles now go
  through the same `retire()` path as core games (leaderboard archived, open giveaways and tournaments moved to the
  replacement, pending challenges expired).
- **Seed fairness:** Light Cycle AI aggression, Grow Guard sun-drop positions and Munchies Snake dropped orbs used
  `Math.random()`; players on the same seed got different games. Now drawn from the run's seeded RNG.
- **3D games on phones (Road Hopper, Wanted Run, Rail Rush, Cube Horde):** the unstyled WebGL canvas widened the layout
  viewport to 450 px on a 390 px phone and pushed the BEST pill off-screen. Fixed in `runner3x.js`.
- **CSP:** `connect-src` blocked the `data:`/`blob:` fetches three.js GLTFLoader makes (Rail Rush and Throttle Rider
  textures; the hub's rigged 3D avatar, whose `.gltf` embeds its buffers). Allowed `data:` and `blob:` only.
- **Shop:** "See earned items" now scrolls to the earned section (router had no `#anchor` handling).
- **Copy:** sponsor FAQ rewritten (removed the stale casino-games answer), shop "How it works" page and earned-item labels
  rewritten in plain language; internal admin notes removed from player-facing text.
- Browser pass, all 74 games live at the start of the run (desktop + iPhone emulation, legit score accepted / forged score
  rejected, no console errors): **71 pass**. After the CSP fix Rail Rush passes too. Open:
  - Cube Horde: ~180k triangles per frame, over the 150k phone budget (performance work).
  - Throttle Rider: stayed on "starting" on emulated iPhone within the test window under software WebGL; needs a real-phone check.
  - The six old retired ids correctly refuse runs; the harness now skips retired games unless named.

### Visual grade (owner review): rebuild required
Owner verdict: all core games except Stack and Munchies Snake need a full rebuild (art, 3D assets, UI/layout, mechanics
matched to the reference game). Void Swarm is a third vertical space shooter next to Star Swarm.

## Round 3 (2026-10-23): Drift Rush rebuild, per-game settings, docs

- **Drift Rush v9** (first core rebuild): three.js chase-cam highway racer — traffic with near-miss bonuses, drift banking,
  fixed chicanes with chevrons, nitro/oil/roadworks, analog steering, real spinning/steering wheels, sky reflections,
  photoreal Poly Haven (CC0) vegetation impostors, farm buildings, a dispensary, hemp fields and branded billboards
  ("Never drive impaired"). Scoring contract unchanged and validated against `src/ac-levels.js`; ~26k triangles on screen.
- **Settings + pause everywhere:** games declare their own options (camera view, graphics detail, effects); core-game pause
  menu has Settings; every library game got a touch pause button (Resume / Settings / Exit).
- **Docs and hub copy:** README rewritten to the current catalog (85 playable: 13 core + 72 library), counts, seasons,
  anti-cheat and admin access; About page game count is now computed live; Terms no longer mention retired casino games.
- **Owner/legal check needed:** Terms section 3 says cosmetics "cannot be bought", while the Hub Store supports optional paid
  cosmetic purchases (checkout currently closed). Align the wording with counsel before opening paid checkout.

## Round 4 (2026-10-24): admin security, CI, Jetpack Dash v9

- **Admin security restored** (`src/admin-sec.js` from `099effa`): unauthenticated admin requests now 404/401; e2e-api 323/323.
- **CI:** two checks that already failed on `main` fixed (stale Stripe refund regex; missing `tools/e2e-hub-library.js`).
- **Jetpack Dash v9** (owner decisions: Joyride-style in portrait, points scoring): three.js lab corridor, angled camera,
  pilot hero, zappers / missiles / lasers / coins / shields. Score = 625 × multiplier per 25 m + 25 × multiplier per coin +
  250 × multiplier per close call; the multiplier (max x10) rises every 250 m without a hit. New L3 rule in `src/ac-levels.js`;
  simulated runs from ~4k to ~1.25M points validate; a shield break at x1 no longer logs a repeated multiplier mark (would
  have rejected legitimate runs). Tiers 12k / 150k / 600k; `docs/score-ranges.json` holds design estimates until real data
  exists (`tools/score-sim.js` still models meters and must not be re-run for this game). Meter runs migrate once to the
  retired id `jetpack-dash-m` (archived board).

## Round 5 (2026-10-24): Jetpack Dash as a 2D side-scroller

- **Owner decision:** straight 2D side-scrolling like the original reference, not 3D. `public/js/jetpack.js` is now plain
  canvas 2D (no three.js): pre-baked parallax lab tiles (grow-room windows, pillars, pipes, light cones, hazard floor),
  pilot sprites pre-rendered from the Quaternius rig (`public/assets/jetpack/pilot.webp`, tooling in `tools/jetpack-sprites/`),
  electric zapper arcs, missiles with smoke, laser emitters, spinning coins, shield bubble, jetpack flame and sparks.
- Landscape: the corridor fills the screen. Portrait: a wide band with ~12 m visible ahead (as in the reference) and
  service levels above/below; HUD moves right in landscape so it never covers the pilot.
- **Gameplay, spawn order and every scoring event are unchanged** (same server rule). Re-validated: 9 simulated runs from
  4k to 1.86M points pass `checkEvents`; a signed-in run is accepted (not held). Settings: graphics detail, screen shake.

## Round 6 (2026-10-24): Bud Escape replaces Jetpack Dash

- **Owner spec "Bud Escape"** (same id `jetpack-dash`, so giveaway links and history stay): Cash Green flees a federal grow
  warehouse on a stolen hover-dolly (hold to rise, release to fall; speed grows with distance). Hazards: grow-light zappers
  (some rotate), security drones (fly in, lock a red reticle on your height with beeps, fire one straight shot), UV lasers (never
  while in a vehicle) and harvest arms (striped arms with a spinning saw sweeping from floor or ceiling).
- **Vehicles** from rainbow strain crates (one crate per 480-760 m, same rules for everyone): Rolling Blunt, Hydroponic Walker,
  Trichome Glider, Resin Rocket Sled, Bong Hover, Seed Pod Cannon Cart, Smoke Cloud Board. Each has its own controls, absorbs one
  hit, clears nearby hazards with a shockwave on entry and on destruction, and slows the game briefly on entry.
- **Missions:** three per UTC day, identical for every player (high fives, near misses, nugs, airtime, vehicles, dodged shots,
  shockwave clears); each adds a flat 200. No shields, magnets, upgrades or anything that carries over.
- **Scoring (owner decision):** meters travelled (10 per 10 m) + mission bonuses. New L3 rule; tiers 700 / 2,500 / 5,000 m.
  Classic runs migrate once to `jetpack-dash-m` (archived board).
- **Art (owner: use finished downloaded assets, not drawn-in-code ones):** Kenney CC0 Toon Characters (Cash, staff, robot),
  Platformer Pack Industrial (warehouse), Robot Pack (drones, vehicles), New Platformer Pack, Smoke Particles, Particle Pack, Space
  Shooter; Openclipart public-domain cannabis plants, leaf and bong. One 555 KB atlas built by `tools/bud-escape-assets/build.py`
  (licence record + rebuild steps in its README). The previous pilot sprites were removed.
- Verified: 8 simulated runs (70 m to 7,870 points over 7 minutes) pass the server rule and stay under the rate cap; a signed-in
  run is accepted; e2e-api 323/323, anticheat 12/12, economy 49/49, systems 54/54. e2e-tiebreak (with its prize-proof hook) has
  one failure that is identical on the base branch.

## Round 7 (2026-10-24): Bud Escape art pass (owner: match the reference game's look)

- Flat Kenney look replaced with thick-outline cartoon art: Cash Green is GameArt2D's "Red Hat Boy" (CC0, cap recoloured
  green, real idle / fly / hurt / death animations); the corridor is ask4asset's sci-fi wall with its windows cut open onto a
  magenta-lit grow room; GameArt2D sci-fi tiles for ceiling, floor, dolly deck, barrels and saw blades; hamcav90's robo orb
  (CC0) for drones; FreeArt cartoon crates; Kenney and Openclipart pieces get the same dark outline at build time.
  Licence record and rebuild steps: `tools/bud-escape-assets/README.md`.
- Gameplay and scoring unchanged; runs re-validated against the server rule, signed-in run accepted, 60 fps on emulated iPhone 13.
