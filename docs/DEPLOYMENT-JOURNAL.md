# Deployment, audit, and 500-game release ledger
Last reconciled: **2026-10-14 (owner Deplexo CURRENT screenshot, phone time 12:17; no independent `/api/build` readback)**.

### Current live host vs. source development (latest evidence; supersedes the historic table below)

| Exact Git SHA | Deplexo evidence | Interpretation |
|---|---|---|
| `278af07ebfbc0eb2e783d8294cb1707c528c0163` | **CURRENT / READY**, owner screenshot, build 323 seconds | Latest confirmed deployed build; QA/gameplay-distinctness branch |
| `916f5c76673d35a48e38c9d3218f06c5dd6e5ee4` | **READY**, owner screenshot, build 561 seconds | Historic rollback, not current |
| `03119b9c019aae88896eabe34ee697b7cd469419` | **READY**, owner screenshot, build 390 seconds | Historic rollback, not current |
| `df091e892e6e6575846940630530897eb79fb650` | **No Deplexo deployment reported** | GitHub SOURCE_ONLY; first tracked overhaul checkpoint, NOT live |
| Later commits on `program/five-release-full-hub-overhaul-20261013` | **No Deplexo deployment reported** | Kenney source vehicle imports, five-game research queue, meta fairness and release-tool work remain GitHub only |

Owner confirmed **automatic deployment OFF**. Do not call `df091e8` READY or infer newer code from the GitHub commit timeline. The current Deplexo snapshot shows **93 historical registrations, 6 archived mechanics overlaps ⇒ 87 proposed playable titles in source**, not game-quality approval. Source work is not the 500-game public release.

**Operator command:** `node tools/release-status.js` prints separate `hostCurrent`, `workingSource`, registered/playable/archived counts and errors. `node tools/test-deplexo-release-evidence.js` fails if a source-only SHA is falsely recorded as a deployment. Neither calls Deplexo. Keep this header up to date with every owner screenshot or full build log; historic events below remain chronological evidence, not current truth.



This is the operational handoff for every restart or new working session. Read this document, `docs/HUB-MASTER-CHECKLIST.md`, the live app's `/api/build` and the **latest Deplexo log** before touching code. The machine-readable record is `docs/audit/DEPLOYMENT-JOURNAL.json`. Run `node tools/release-status.js` to see the branch SHA, latest observed deployment and catalog capacity. Do not infer production status from GitHub commits alone.

## What is actually known

| Source commit | Deployment observation | First known failure | Resolution or next action |
|---|---|---|---|
| `bb2346e` | FAILED | Structural audit falsely reported missing manifest icon route. | `ea454f9` updated icon resolution; no proof this build alone passed. |
| `229c367` | FAILED, user screenshot | Docker build smoke check step failed; actual HTTP verifier message absent in screenshot. | `649e2ab` bounded smoke checks; then other fixes followed. |
| `8489b41` | **DEPLOYED / CURRENT / READY**, user screenshots | None known for that revision. | Last positively observed Deplexo READY point. Full gameplay not certified. |
| `58a9f52` | **ERROR**, user screenshot, 83 seconds | Exact build-log failure unknown. | `b7be1ec` updated verifier for registry-derived mobile tests. Hypothesis until new build log confirms. |
| `b7be1ec` | **BUILDING 35%**, user screenshot around 02:25 Eastern | No error at observation time. | Check current Deplexo outcome. Do not label FAILED or READY without evidence. |

The Skee Roll minigame was changed on `58a9f52`. Its currently committed ball physics was **locally simulated from source** at 60 Hz (0.15-second hold => 0 points, 0.45 => 30 points, 0.75 => 50 points); this is not a player/browser run. The mobile audit changed in `b7be1ec` because the mobile suite now derives 13 active games from the canonical 16 historical core-game IDs excluding three retired chance titles. A full Docker rebuild and browser game suite have **not** been executed by this audit session.

## Mandatory updates following every source push or Deplexo deployment

1. **Source event:** record GitHub full SHA, commit timestamp (UTC), changed paths, reason, exact tests actually run and result. Never infer a green build from source syntax checks.
2. **Deployment event:** append the Deplexo image-build state **and** final container state for that exact SHA, its duration, and first failing command plus log excerpt if ERROR. For BUILDING/UNKNOWN, preserve that state until final evidence is available. Keep all failed records as history.
3. **Fix event:** link first known error to its exact correcting SHA; mark proposed fixes as *unverified* until Docker logs or READY show the outcome. Never rewrite the failed record as READY.
4. **Audit event:** store API/build fingerprint and report blocker count, browser/simulator test result, physical Android captures, anti-cheat and performance numbers. Use evidence paths such as `docs/audit/GAME-QA-TRACKER.md`. Unknown = NOT RUN.
5. **Game intake:** require complete source/asset license, genuine distinct mechanics, playable game files, signed score adapter, generated inventory/card and valid thumbnail, then batch E2E and owner review. Increment count only after integrated and accepted.
6. **Rollback:** retain last known READY SHA; check database-migration compatibility and backups before rolling back; do not undo user saves/purchases/achievements.

## Where to continue

**Immediate next action:** determine the final Deplexo result for `b7be1ec` (or a later commit). If READY, check `/healthz`, `/api/build`, `/api/audit/report` and proceed to direct phone review, gameplay audit and 20-game intake candidate screening. If ERROR, read the first failed line in the new build log, fix that source error, update this ledger with the failed SHA and targeted fix, then rebuild. Never spend a deployment just to see whether a suspected issue changed.

**Game expansion math:** 13 active core games + 80 Games Library games = **93** active titles; **407** distinct, approved additions required for a 500-total target. The three retired chance games are not counted. `docs/GAME-CANDIDATES.md` lists 120 research leads, not 120 integration-ready games. Screening and integrating a candidate never by itself confers launch approval.

## Planned import gates

Use `docs/UNIVERSAL-GAME-INTEGRATION.md`, `docs/GAME-CANDIDATES.md`, and `docs/audit/GAME-QA-TRACKER.md`.
- Candidate ID/slug/genre, source repo URL, license and *asset license* verified; attribution and commercial redistribution compatible. No proprietary replicas.
- Distinct player decision loop versus the 93 existing titles; document why same-engine variants are or are not actual duplicates.
- One-click in-Hub launch, keyboard/touch, pause/restart, error states, responsive layout; signed-run start/submit, server-validated score and forgery rejection. Exclude giveaway eligibility by default until validated.
- Approved source-quality game art, optimized textures/models, no missing files, coherent UI/achievement cosmetics. Existing Hub accounts/shop/avatar/score APIs retained.
- Review in small batches (e.g. 20), record all passes and defects; then scale to additional batches within the user's approximately five major deployment milestones. Batches can require more source commits; do not silently bypass QA to hit an arbitrary deployment count.
- Hold public launch until staging load/reliability/performance tests reach the requested 10k population and sustained concurrency goals; never aim load-generation at the live user database.

**Evidence truth:** Deplexo READY means the image/app reached the host's READY state; it does not certify AAA visuals, Android performance, data persistence, payment or 500-game catalog quality.

## 2026-10-13 intake preparation update

The original build audits required **exactly 80 library games**, which would have rejected the first new game regardless of quality. This hard-coded release blocker has been corrected in the same batch as the admission ledger. Full Docker build remains to be verified after Deplexo redeploys the new commit. See `docs/audit/GAME-INTAKE-BASELINE.json`, `docs/audit/GAME-INTAKE-ACCEPTANCE.json`, and `docs/audit/GAME-IMPORT-PROTOCOL.md`.

## Source changes after the last Deplexo screenshot (not host-confirmed)

| Source SHA | Change | Verified evidence |
|---|---|---|
| `4ad48e9` | Deploy/audit ledger, read-only reporter and non-destructive asset-credit builder. | Source JS syntax checked. Deplexo unknown. |
| `be049c9` | Fixed release reporter escaped registry regex. | Canonical parser matched 16 historical core / 13 active games. Deplexo unknown. |
| `71a07b4` | Removed exact-80 blocker from both prelaunch audits; introduced 500-game admission protocol. | Source checks and registry-based report exercised; Docker/Deplexo outcome unknown. |

The next source branch head can advance beyond this table. Read `git log` and `node tools/release-status.js` to reconcile work since this note, then append to the machine-readable journal. The last observed Deplexo READY SHA remains `8489b41` until a later deployment is independently confirmed.

## Reconciled from owner Deplexo screenshot — 2026-10-13 ~02:44 Eastern
The earlier last-known READY entry `8489b41` remains valid, but a **newer READY screenshot confirms `420bab1`**. Later failed builds are **`58a9f52` (83s), `b7be1ec` (108s), `4ad48e9` (164s), and `71a07b4` (218s)**. All failures are marked **cause UNKNOWN** until the actual Deplexo build logs show the first failing command. The latest source commit visible to GitHub at this checkpoint is `570a9fe` (06:43:35 UTC), **not host-confirmed**. An older screenshot of BUILDING for `b7be1ec` has been superseded by the later screenshot showing ERROR.

**Resumption after interruption:** obtain the error excerpt for `71a07b4`; reproduce that exact failed check without paid GitHub Actions; fix the root cause on the working branch, run checks, then merge once for a controlled Deplexo deployment. Until then, the source and the last known READY deployment are different revisions. If the screenshot is updated, append rather than rewriting past events.

**User's quality-count rule:** registered titles are **not** equivalent to AAA-approved titles. Audit all 93 current titles before expansion; `node tools/quality-readiness.js` reads the separate evidence-backed per-game acceptance file. Empty approvals mean **0 independently quality-approved** (not zero games registered). Only approved games advance the 500-game launch-quality target.


## Isolated QA implementation checkpoint — `eaaca78` (not deployed)
Branch: `audit/phase1-brand-qa-ledger-20261013`; draft PR #10. Its browser header changes and per-game acceptance reporter are source-only pending actual Android/desktop QA. Read-only reporter was exercised in a dependency-stubbed JS harness: correct 93 registered/0 approved; fake incomplete approval was rejected. This **is not** a passing Deplexo build or visual signoff. The pending exact build log for `71a07b4` remains the deployment blocker. Additional edits on this branch should append their own SHA when known.

## 2026-10-13 ~09:28 Eastern — additional host failures and verified build-guard regression

The owner provided a new Deplexo deployment list. It shows **working-branch commits also triggered Deplexo builds**: `570a9fe` ERROR 113s, `eaaca78` ERROR 309s, `12446a1` ERROR 156s, `3623d72` ERROR 317s. The service dashboard reports running; the most recent screenshot-confirmed READY revision is `420bab1` (436s), not evidence that later source passed. `2fc38b3` has no host outcome shown. Earlier READY revisions remain recorded separately.

**Regression chain (source-confirmed, exact Docker log not yet available):** `58a9f52` changed `tools/e2e-mobile.js` to a dynamic active-game list but left `tools/verify-prelaunch.js` expecting the old literal array: a static evaluation reads 0 mobile IDs and flags 16 core IDs missing. `b7be1ec` attempted to align the registry audit but added `require('../src/config')` during Docker build. `src/config.js` requires runtime secrets and cannot safely be loaded from the build prelaunch audit (the Docker build stage has no runtime secret values).

**Targeted candidate:** replace the runtime config import with source-only parsing of the canonical `CHANCE_RETIRED` list; preserve dynamic mobile harness contract and reject unknown retirements. Candidate syntax parsed in V8 and core derivation checked **16 historical = 13 active + 3 retired**. A small-context patch applied and parsed locally; full Docker/Deplexo pass **not yet confirmed**. Do not treat the source-level diagnosis as proof of the host's first error line. See <https://github.com/TheTavern001/gaming-hub-2/issues/11>.


## 2026-10-13 ~10:29 Eastern — latest READY and new failure
Owner screenshots confirm Deplexo `55ebf1c` **READY** (415s; working audit branch), superseding last-known READY `420bab1`; `d5de300` **ERROR** (104s) and build root cause remains **UNKNOWN** without the Docker log. A READY host image is not evidence of which revision `/api/build` currently serves. The 93-game source registry has zero individually AAA-certified titles; neither the latest avatar source commit nor staged game optimizations are certified public-ready.

**Payments evidence:** Stripe connected sandbox exists in **test mode**, with no webhook endpoints and no Checkout Sessions at observation. No live payment is tested. Default checkout for an unset admin flag must be OFF; Stripe live key requires explicit `PAYMENTS_LIVE_APPROVED=1` as well as webhook, URL and enabled admin state. Set approval only AFTER sandbox end-to-end checkout, signed webhooks, refund handling and legal review.


## Deplexo root-cause breakthrough — 2026-10-13 11:11 Eastern
Owner supplied the **full failed `d5de300` Docker log**. Image build reached `[1/2] STEP 11/12`. `npm ci` PASSED, rotating-quests tests PASSED (3,150 templates), and `tools/verify-game-syntax.js` PASSED **all 96 files**. The first error was:
```
Error: Cannot find module '/app/tools/test-endless-buffers.js'
    at Module._resolveFilename ...
Node.js v20.20.2
Error: building at STEP "RUN ... node --check tools/test-endless-buffers.js ..." exit status 1
```
**CONFIRMED cause:** `.dockerignore` excluded the new script with `tools/*`; the hard-coded exemptions only enumerated older scripts. The file **exists in GitHub** but was absent in the Docker build context. A repetitive whitelist design caused the failure, not a broken gameplay script.

**Systemic fix staged:** include the **entire tools directory** in the Docker context (still excluding secrets and nested node_modules) rather than manually allowlisting each JS file. Put explicit file-existence guards at the beginning of Docker prelaunch. The source-only endurance simulation was rerun against actual fetched game scripts: Tunnel Hop 7,200 seconds with max 64 rows and Drift King 4,000 steps with max 42 road points, scores unchanged; PASSED. **This does not yet certify a Docker build or Deplexo READY**.

Additional Deplexo failures visible in owner's screenshot: `b5c9783` 202s, `1a2b775` 124s, `61c1b9d` 65s, all ERROR. Their individual logs weren't provided, so the same inherited ignore rule is a plausible but **not confirmed** cause. These are separate documented attempts. Next: observe READY of the fixed commit before claiming host recovery.

## 2026-10-13 recovery
Owner confirms Deplexo `3dfd391` READY, removing the missing Docker tool blocker. Live /api/build not reachable from this environment; runtime functionality and AAA certification remain unverified. Following source changes are not yet confirmed READY. Historical ERROR records remain intact.

## Owner verified live API and corrected facial entitlement — 2026-10-13 12:57 EDT
Android browser screenshot of `/api/build` shows `ok:true`, 80 library + 13 core games, and 24-digit build fingerprint. This hash is a content digest, not a git commit SHA. Current default avatar `outfit:base` can never match `supportsRiggedAvatar()` requiring `outfit:adventurer`: owner's blob-like screen confirms the bad fallback. Do not cover the issue by equipping free clothing or relabeling the Adventurer model. The permanent replacement requires original Mickel-Captain-inspired neutral modular characters, actual assets, PBR, 3D source preview and owner acceptance. Owner explicitly changed rule: all skin/face/eyes/mouth/beard character-building choices FREE. Special hair and emotes remain unlockable. New isolated Docker build test enforces free faces. See authoritative issue #18.


## 2026-10-13 owner-confirmed 0b7e3a6 READY; next technical inventory
Build `0b7e3a6` is owner-confirmed READY, facial traits free in source (30). Next candidate includes per-title source scan for all 93 currently registered games, output `/api/audit/game-source` with all quality signoffs false and source hashes, and smaller mobile avatar preview layout for easier selection. This is not a substitute for premium neutral rig and layered outfits, score replay, licensed assets, actual play QA or 500-game public launch. Base asset research: Quaternius Universal Base Characters (six bodies, 20 hairstyles, CC0) + Modular Character Outfits Fantasy (12 outfits, 62 parts, CC0); the binaries must still be acquired and vetted. Historical failed builds preserved.

## 2026-10-13 missing card art finding
Seven core games point at non-existent /assets/cards/v7/*.webp: munchies-snake, brick-breaker, void-swarm, stack, grow-guard, sling-smash, haze-defense. These are image defects, not gameplay source failures. The source inventory reports each under missingArtwork without auto-approving title. Source art corrections must use appropriate owned/licensed title-specific assets, not reuse unrelated thumbnails.

## 2026-10-13 audit hardening: missing HTML dependencies
Source scanner originally filtered non-existent JS filenames from nonstandard multi-file games. New full reference validation checks every local script tag, including bundled/vendor and Hub bridges. A new disposable negative-path test hides `bud-merge/js/game_manager.js` from the scanner and must receive exit 1 with exact missing dependency. This prevents silent acceptance of incompletely packaged games and doesn't change player data or gameplay. Deplexo result pending; historical failed releases preserved.

## 2026-10-13 14:34 EDT — source-integrity READY & six-week staged rollout
Owner confirms Deplexo **`9f9a03d` READY**, including Docker fatal on any missing game HTML-linked JS and a negative missing-Bud-Merge-engine regression. This does **not** certify gameplay quality or the browser audit report. Isolated season policy commit **`63818e7`** passed tests for Season 1's original 56-day Oct 1–Nov 25 period, 42-day Season 2 and 3 periods, exact consecutive boundaries and admin overrides. Eleven Docker tool script paths tracked; `.dockerignore` no longer omits tools. Safe next commit adds this evidence to staging release before QA branch host deployment, leaving all player DB tables untouched. Await Deplexo READY and live /api/seasons; do not mark paid giveaways or AAA public launch ready.

## 2026-10-13 15:45 EDT — d14555c READY / vehicle lab pilot
Owner confirms Deplexo READY for d14555c on feature branch, same SHA as QA branch. Future 42-day seasons staged with Season 1 grandfathered. Next pilot adds a 3D preview at /games-lib/labs/garage/index.html with six distinct existing Blender CC0 meshes and Docker byte-hash verification. **This does not add games, purchasable cosmetics or competitive advantages.** Mobile device visual approval, server-side score replay, neutral avatar and 500-game QA remain outstanding.

## 2026-10-13 settings checkpoint
New shared game settings and five app-level controls (sound, render detail, FPS, motion, contrast), no scores or hitboxes changed. Docker test added, deployment unconfirmed.

## 2026-10-13 — completed registered game settings source-coverage audit
Confirmed via GitHub source at `075e467`: 77 built library game pages load `../kit.js`; Bud Merge, Hex Stack and Desert Dash link `../vendor-settings.mjs`. In total 80/80 library entrypoints have a settings path, plus shared SPA settings for the 13 core games. Input suppression, vendor-specific native pause, sound override persistence and high-contrast site styling are coded. Regression scripts pass isolated V8 tests; full Docker and owner physical mobile verification remain pending. No new AAA-certified games.

## 2026-10-13 — no regression to older box trains
Visual files restored verbatim from Deplexo READY ccedb2a, original train model integrity test from READY 0048954, with Docker/HTTP checks on settings candidate. Combined deployment still pending; AAA and public launch not certified.

## 2026-10-13 ~19:05 EDT — expansion readiness source test fixes
Source audit `tools/test-game-source-mechanics.js` and player/game-settings QA no longer reject game 94 solely because 93/80 totals are hard-coded. The immutable 13 core + 80 library list is still enforced as a baseline and every new title must appear in the source audit and implement a verified settings adapter; any new engine kind fails closed. Original missing-script negative regression remains. This is source-level preparation for 500, **not approval of one new game**. Latest branch `audit/avatar-renderability-ledger-20261013` source commit `1d08431` with device settings across all games has NOT yet been confirmed Deplexo READY. No auto-deploy of this isolated feature until reviewed.

## 2026-10-13 ~22:07 EDT — exact owner Docker failure confirmed; safe staged remediation

- Owner supplied the **full** Deplexo build log for `5932ba613c2d22e4bdf97920d6071cc59c2b4dd6`. Package install, 96 original/core source syntax checks, 80 library inventory, 93 registered source records, all prior targeted physics tests, rig inventory, six-vehicle GLB integrity and player settings test passed. **Fatal STEP 11/12**: `node tools/verify-prelaunch.js` misidentified the literal string `import * as GP from './player-prefs.js'` inside `tools/verify-live-deployment.js` as an actual local module import and attempted to resolve `tools/player-prefs.js`. The real Hub import in `public/js/app.js` correctly resolves to `public/js/player-prefs.js`.
- Isolated source fix branch `fix/deplexo-import-audit-false-positive-20261013`, parent `feature/expansion-ready-game-admission-20261013` at `6874037`: `b8f51f4` implements executable-code-aware dependency scan, `8390117` applies it without weakening real file checks, `c610566` adds a regression for phantom and missing imports, `c5d97e5` runs regression in Docker before prelaunch. Actual fetched GitHub source plus exact committed test body passed V8 source/harness evaluation; **full Node/Docker/Deplexo NOT YET RUN**.
- Consolidated Hextris/game-settings changes from old draft PR #27 into same candidate: `5eeb204`, `cbfea4f`, `de6f485`, `b496e86`; dynamic admission and Kit title/pause guards preserved, no new games added.
- Additional Deplexo ERROR cards from owner screenshot: `4cf7e51` 210s, `46a71d4` 243s, `1d08431` duration obscured. Their first error logs remain UNKNOWN; do not substitute the `5932ba6` finding for independent proof.
- Deplexo documents history listing and logs but **no individual old-deployment record deletion** in published API/CLI. `DELETE /apps/{id}` deletes the entire app and persistent data volume: do not invoke as cleanup. Retain 1 existing app and recovery SHA, preserve failure history in `docs/audit/DEPLOYMENT-JOURNAL.json`, consolidate release work to a controlled branch rather than triggering repeated experimental builds.
- **Next exact action:** run the full newly patched Docker build (prelaunch and HTTP smoke) on the consolidated candidate; if it passes, deploy through the one Deplexo app, get READY and verify `/healthz` + `/api/build` exact SHA; then real Samsung Android QA before admitting distinct games 94+. The 93 current games remain registered but 0 owner/AAA quality-approved.
- Full root-cause and cleanup report: [Deplexo 5932ba6 first-error reconstruction](audit/DEPLEXO-5932BA6-ROOT-CAUSE-2026-10-13.md).

## 2026-10-13 late evening — whole-Hub five-release program initialized (NO DEPLOYMENT)

**Owner confirms Deplexo automatic deployment turned OFF.** Preserve owner-confirmed READY `03119b9c019aae88896eabe34ee697b7cd469419` on existing app; do not interpret a GitHub commit as a hosted deployment. Working base: `qa/gameplay-distinctness-and-collision-20261013` at `278af07ebfbc0eb2e783d8294cb1707c528c0163`; isolated successor: `program/five-release-full-hub-overhaul-20261013`. User explicitly requires ALL historic gameplay/avatars/shop/economy/meta/hub/security issues consolidated into approximately five deliberate release checkpoints, then unique-game expansion toward 500; no piecemeal Deplexo builds.

**Source work in order:** `397b15a` master 5-release requirement/acceptance contract; `67ee6df` 26-workstream evidence board (no false AAA approvals); `b7335ba` 11 publicly rights-documented external asset packs, six existing Kenney Car Kit GLBs distinguished from unimported packs; `ad42de1` new pure zero-pay-to-win cosmetic/identical-starter contract; `db31e6b` 202-assertion source contract regression, `5b382e8` hooks it into Docker; `2db1405` all-game source mechanics scanner, `343cc38` Docker gate/report artifact; `2be99ff` exact GitHub tree snapshot for all 93 registered game code paths with six owner-retired entries preserved. Asset licenses/source references require downloaded SHA256 and render proof; 0 AAA approved.

**Verification actually completed:** JS syntax parsed for new source modules/scripts at V8 level. The exact committed fairness test body executed against fetched GitHub source under a V8 in-memory filesystem shim: **202 assertions PASS**. A current GitHub recursive tree snapshot confirms 13 core / 80 library IDs, source paths present for all 93, CREDITS.md present for all 80 library titles, 6 staged archival duplicates => 87 proposed playable. No Docker or real browser execution of this program branch, no 93-title mechanics simulation, no external asset downloads, no visual/device signoff, no run-score/replay or paid settlement cert. The game scanner is linked into Docker for the next controlled build, not yet executed. All source statuses remain SOURCE_ONLY/BLOCKED/NOT_STARTED.

**Next resume point:** complete R1 deep mechanics/duplication QA, run `node tools/test-full-hub-meta-contract.js` and `node tools/audit-full-game-mechanics.js` on complete checkout, resolve any source audit/HTTP failures; integrate genuinely different licensed assets across actual gameplay and neutral modular rig, then finish meta/UX/economy/security and device QA. Only after a complete R1 milestone passes locally should a **manual** Deplexo deployment be initiated. Five-releases plan is a release discipline, not assurance 500 games are certified.

**Files:** [master contract](MASTER-TRAPTECH-FIVE-RELEASE-CONTRACT-2026-10-13.md), [workboard](audit/FIVE-RELEASE-FULL-HUB-WORKBOARD.json), [source asset pipeline](audit/EXTERNAL-ASSET-PIPELINE-2026-10-13.json), [all 93 source path snapshot](audit/ALL-GAME-SOURCE-PATH-SNAPSHOT-2026-10-13.json).

## 2026-10-14 — genuine external Kenney assets and next-game research (NO HOST DEPLOY)

- **Auto-deployment OFF:** owner confirmed; `03119b9c019aae88896eabe34ee697b7cd469419` remains the only owner-confirmed Deplexo READY rollback image. All work below is GitHub source on isolated branch; no host deployment.
- **Corrected misattribution:** `rc-*.glb` garage vehicles are generated in Blender by `tools/blender/hub-cars.py`, not externally sourced; `cv-*.glb` are Divinux CC0 cartoon vehicles, not Kenney. Honest source ledger updated accordingly.
- **Imported 10 actual Kenney Car Kit 3.1 CC0 GLBs** from intact public mirror `Arslan12216775/kenney_car-kit` into `public/games-lib/assets3d/kc-*.glb` preserving exact upstream Git blob IDs: police, race-future, SUV luxury, ambulance, firetruck, taxi, sports sedan, truck, garbage truck and delivery. User's Most Wanted now defaults to authentic Kenney sports sedan (same for every account) and offers an in-game visual-only QA preview set; physics/hitboxes/score logic unchanged. Rest of engine still awaits R1/R2 artistic and Android QA. 
- **Binary integrity evidence:** Ten of ten GLB files verified against pinned Git SHA/byte count, parsed as glTF 2.0 with nonzero meshes and **embedded textures, zero external image URLs**. Approximately 2k–3k triangles/model. New fail-closed `tools/test-imported-kenney-cars.js` integrated into Docker; test's Git blob NUL and selector parsing assertions were corrected before the next build. **GLB metadata PASS is not rendered AAA approval.** Evidence `docs/audit/KENNEY-CAR-KIT-BINARY-QA-2026-10-13.json`.
- **Owner gameplay source simulation:** original staged Most Wanted police/scenery, Rail Rush train hit, Arrow Hero touch tests on fetched repository code: 29 V8 assertions PASS with binary & child-process mocked. Real Node/Docker and real Android **NOT RUN**.
- **Next-game research:** `docs/audit/POST-OVERHAUL-GAME-CANDIDATES-2026-10-13.json` lists five distinctive permissively licensed public browser sources: HexGL hover racing, Reversi, Battleship, Sudoku, 3D Maze. All `RESEARCH_ONLY`; none installed, scored, counted, or assumed AAA. Existing registrations 93 historic, six archived proposal => 87 active for source QA. The candidate queue source regression passed 79 V8 assertions with fetched registry and read shims. Real Node/Docker **NOT RUN**.
- **Manual release gate:** `node tools/preflight-manual-release.js --release=R1 --require-ready` would currently report BLOCKED; exact current board evaluated under V8 test returned 6 blocked R1 workstreams and exit code 1. Auto deployment remains OFF until all release preconditions pass. `--public` later requires R5 and `tools/quality-readiness.js --require-500`.
- **Source commits** in order: `2eab22a` imports authentic Kenney GLBs + gameplay model source + manifest/smoke; `274e86b` Git hash null fix; `3bec9ce` next-game research; `ab13619` candidate regression; `9e3157e` manual release preflight; `e8a9613` quality reporter wiring; `50160de` game selector regression parser; `413796b` Docker candidate check; `be139da` binary QA results; `27bf94c` updates 26-stream workboard.
- **Next resume point:** run actual Node/Docker prelaunch for the isolated branch, render 10 Kenney cars + police/traffic in on-device Most Wanted with identical hitbox semantics, finish deep R1 game-by-game mechanics/dedup audit, fix all gameplay tests, then R2 sourced art across 87 active titles. Only manually deploy once the entire milestone has evidence. DO NOT turn auto-deploy on yet.

## 2026-10-14 — Owner screenshot evidence reconciled; licensed chase and neutral-rig QA (NO DEPLOYMENT)

- **HOST, directly observed:** owner Deplexo screenshot (phone clock `12:17`) shows **`278af07ebfbc0eb2e783d8294cb1707c528c0163` CURRENT / READY (323s)**, `916f5c76673d35a48e38c9d3218f06c5dd6e5ee4` READY (561s), and `03119b9c019aae88896eabe34ee697b7cd469419` READY (390s). GitHub REST resolved all three full SHAs; Deplexo API and public `/api/build` were *not* independently readable. App not stated to be down.
- **Screenshot integrity:** 709×1536 JPEG / 108,248 bytes, SHA-256 `b780eb36e28e1e4468fdb6464b5c1da0652ec37edf486fc5b8d99b9d407139ad`, indexed in `docs/audit/DEPLEXO-OWNER-SCREENSHOT-EVIDENCE-2026-10-14.json`. Screenshot bytes themselves are **not** mirrored to GitHub; digest/metadata and the owner source chat are evidence, not a claim of in-repo image storage.
- **GITHUB SOURCE ONLY:** `df091e892e6e6575846940630530897eb79fb650` and all later `program/five-release-full-hub-overhaul-20261013` commits have **no owner-confirmed Deplexo deployment**. Deplexo automatic deployment OFF. Do not call these changes live.
- **Tracking source:** `tools/release-status.js` now reports `hostCurrent`, `ownerScreenshotEvidence`, `workingSource`, 93 historic registrations, 6 archived duplicates, 87 proposed playable entries and 413 more accepted distinct games to reach 500 active. `tools/test-deplexo-release-evidence.js` (included in Docker) cross-checks screenshot digest, full host SHAs, 323/561/390s durations, current flags, and prohibits labeling the source-only snapshot deployed. **151 V8 shim assertions PASS** against the committed sources; actual `node`/Docker not run here.
- **R1 driving polish source only:** Most Wanted chasing cruisers and high-heat SUV now load **true Kenney CC0** models, with beacon/fallback code and no change to server hitboxes, movement or scores. Reused `Matrix4` scratch instead of per-scenery-clone allocations in its instanced draw loop. Cup Toss removed a recurring empty timer from its update loop. Owner gameplay source-backed V8 simulation **39 checks PASS**, low-allocation render/timer source check **13 assertions PASS**, but these are NOT measured Android FPS or AAA art.
- **R3 sourced avatar pilot source only:** imported Quaternius Universal Base Characters 741,320-byte glTF 2.0, 65 joints and three meshes, source Git SHA pinned. `?avatarRigQA=1` uses the source rig within the existing Hub avatar viewport if the account is wearing the normal free base outfit and no unsupported accessories. Normal appearance is unchanged. Model has **one flat jade material, no animation tracks and no modular clothing**; real clipping/animation/frame approval **NOT RUN**. Opt-in eligibility executed in V8 and passed 7 checks. Audit/test `docs/audit/QUATERNIUS-NEUTRAL-STARTER-QA-2026-10-14.json`, `tools/test-neutral-avatar-source.js`.
- **Next resume:** actual Node/Docker STEP11 + STEP12 suite on the isolated source branch; complete game-by-game R1 mechanics/duplicate/score audit, externally sourced artwork and real Android rendering QA; then R2–R5 meta, avatar, shop, security, payment and performance acceptance. **Do not enable Deplexo auto deploy before first release gate passes.** Preserve existing `278af07` ready app and database.

## 2026-10-14 — Phone-first unified Hub Credits + fraud-resistant rewards (SOURCE ONLY, NO DEPLEXO DEPLOYMENT)

**Live baseline remains owner-screenshot `278af07` CURRENT/READY.** The GitHub development HEAD at journal reconciliation was `9f9a8110ac99f689930a61b7d26d29d3e59d0386` on `program/five-release-full-hub-overhaul-20261013`; no new Deplexo deployment or user data migration was initiated. Automatic deployment is still OFF. Do not call this source-only change live, paid-tested or secure-certified.

**Owner clarification:** approximately 98% Android/iPhone; future native app. One spendable cosmetic currency, **Hub Credits**, earn or buy; 1 legacy Point = 1 Credit, 1 legacy Crown = 10 Credits. Keep original `crown_ledger` source rows (purchases/refunds/spends) untouched; mirror each immutable transaction into `points_ledger` under unique `legacy-crown:<original row id>` semantics (`reason='legacy-crown'`, `ref=id`) exactly once. All shop routes now call one atomic `src/shop.js:buy` wallet path. Existing payment pack IDs persist for order reconciliation; labels/prices read 5k/$4.99, 11k/$9.99, 24k/$19.99, 65k/$49.99 Credits. Prestige stays direct-dollar preview-only, NOT a second in-Hub currency. No player-to-player transfers or gameplay power.

**Specific exploit fixed in source:** historically `src/shop.js:sync`, parts of `src/progress.js` and `src/achievements.js` credited/advanced unreviewed `held` runs, including subsequent referral credit. These paths now require `held=0`; later anti-cheat admin disqualification posts immutable negative run-integrity Credit adjustment, repeatable holds/clears restore and revoke in matched sequence. Already-awarded cosmetic entitlements and paid-refund debt require additional hardening prior to production.

**Payment surface:** `src/monetize.js` now bridges each settled Crown source ledger event into Hub Credits atomically. The deprecated `/api/crowns/buy` alias uses the same shop debit and is rate limited. The unused Whop webhook is deliberately disabled with 404; it used to trust a signed order reference without independent amount/currency settlement verification. Stripe/Bitcoin remain gated by explicit operator approval; no live payment was made. Browser UI in `public/js/hub-store.js`, `public/js/economy.js`, `public/js/app.js` uses only Hub Credits, with Earn/Buy/Spend links.

**Actual tests:** a separate native Node v22 SQLite in-memory SQL-equivalence smoke passed: 5 signed Crown/source entries imported once, replay gave zero duplicate grants, refund debited once, run-integrity hold/clear adjustments were reversible across four review cycles. JS syntax was checked on changed backend modules at V8 level; candidate full Node20/better-sqlite3 tests `tools/test-unified-wallet.js` and `tools/test-reward-integrity.js` are **committed and linked to Docker STEP11 but NOT EXECUTED**. `tools/e2e-payments.js` mock BTC regressions now assert Credits and Whop 404; **not executed**. Full Deplexo STEP11/STEP12, live browser, WebKit and physical Android performance checks remain NOT RUN.

**Release gates:** `docs/audit/SECURITY-MOBILE-CREDITS-RELEASE-GATES-2026-10-14.json` has 14 wallet/auth/payments/anti-cheat/mobile/privacy gates with **0 owner approved**. An in-memory V8 execution of the actual `tools/preflight-manual-release.js` returned R1 BLOCKED (6), R3 BLOCKED (21), R4 BLOCKED (37, including 13 R4 security gates). These are not real-device test results. Post-release Deplexo `/api/build` will be read **after** manual deploy; it is not a preflight requirement.

**Known serious blockers:** one-use signed client run tokens and plausibility caps alone are not server-authoritative simulation for each giveaway. Score replay proof for all admitted games; server-side session revocation/WebView token theft, refunded-but-equipped cosmetics, complete payment webhook negative tests, DB backup/PII retention and real Apple/Google billing compliance remain unfinished. We must not imply that anyone is guaranteed hackproof; certify controls only through adversarial testing.

**Exact resume point:** run the native tests and all existing Docker checks on `program/five-release-full-hub-overhaul-20261013` locally, fix any failures, finish R1 duplication/collision/touch/source gameplay audits, continue R2 licensed game art (Quaternius/Kenney proofs), R3 avatar/economy/Cosmetics Wallet polish, R4 server score verification/payment/identity/data protections + device performance, R5 private tested manual release, then 500 distinct-game intake. **Keep Deplexo auto-deploy OFF until milestone candidate passes its own preflight and owner UAT.**

References: `docs/UNIFIED-HUB-CREDITS-SECURITY-2026-10-14.md`, `docs/audit/MOBILE-FIRST-98-PERCENT-ACCEPTANCE-2026-10-14.json`, `docs/audit/SECURITY-MOBILE-CREDITS-RELEASE-GATES-2026-10-14.json`, `tools/test-unified-wallet.js`, `tools/test-reward-integrity.js`.

**2026-10-14 regression refinement (source only, no deployment):** Commit `693b3351012103a0338b2cde335c14fd2ab510b4` adjusts the pending native `tools/test-reward-integrity.js` checks to isolate exact run-credit clawback from independently awarded Season Pass progress. Season entitlements earned *before a later disqualification* are not automatically clawed back and remain a specific security/design blocker; the test must not mistakenly claim otherwise. Actual Node20 Docker execution still pending, while last screenshot host CURRENT remains `278af07`.

## 2026-10-14 — Immutable Credits checkout & anti-cheat financial proofing (SOURCE ONLY, NO DEPLEXO DEPLOY)

- **Last screenshot-confirmed Deplexo CURRENT READY remains** `278af07ebfbc0eb2e783d8294cb1707c528c0163`; owner confirmed automatic deployments OFF. `program/five-release-full-hub-overhaul-20261013` source HEAD at this checkpoint `16ddfb49141ac768349a41443b07fa9668d61d64` is **NOT VERIFIED LIVE**. No host build/readback, official owner review, real Android/iPhone or 500-game approval.
- **Problem closed in isolated source:** the unified Hub Credits path previously settled a paid Credit pack against mutable `store_products.crowns+bonus`. An admin catalog edit between checkout and fulfillment could alter grants and later refunds. `src/monetize.js` now adds `store_orders.pack_crowns` (safe additive SQLite migration), freezes quantity on Bitcoin, Stripe and manual order creation, rejects invalid pack quantity **before** payment, grants only `status='paid'` orders with a valid locked quantity, and refuses automatic grants for unquoted legacy orders pending manual financial reconciliation. Player balance conversion remains old Points ×1 / historical Crown ledger ×10.
- **Refund integrity:** `reverseEntitlements` now loads fresh order inside a SQLite transaction, replays original immutable `crown_ledger` purchase delta for exact refund, returns already-refunded for replayed signed provider notices, and does **not** mark a refund complete on missing original money evidence. Exceptions yield manual reconciliation rather than falsely increasing/decreasing a player's wallet.
- **Tests added:** `tools/test-payment-order-snapshots.js` performs disposable native `better-sqlite3` checks on mutable pricing, replayed settlement, exact grant/refund, legacy null snapshots and unpaid attempts. Wired into fail-closed Docker prelaunch before existing native wallet/reward and app verification. `tools/test-full-hub-meta-contract.js` now checks quote lock and payment-safety code constraints.
- **Verified in this turn:** extracted exact committed `grant` function under simulated V8 SQL returned **4/4 PASS** (locked original quantity, replay, no snapshot, unpaid order). Extracted exact refund function returned **3/3 PASS** (original delta, refund replay, missing evidence). Independently executed real SQLite in-memory SQL equivalence for original `INSERT OR IGNORE ... SELECT` migration: **PASS** (signed entries, duplicate migration prevented, frozen snapshot and exact net refund). **Full app Node `better-sqlite3`, Docker STEP11+STEP12, Stripe sandbox webhook, actual BTC receipt, host smoke, device UAT and security pen tests NOT RUN**.
- **Remaining blockers:** refund-funded purchased cosmetic ownership still lacks full entitlement/debt resolution, native IAP receipt backend not implemented, giveaway replay proof not universally certified, iOS Safari and Android physical tests not run. No workstream approved or deployment authorized by this checkpoint. Security scoreboard `docs/audit/SECURITY-MOBILE-CREDITS-RELEASE-GATES-2026-10-14.json` remains **BLOCKED**.
- **Next resume point:** run native financial regression suite and full Docker build on isolated branch; fix failures before first manual R1/R3 staging deploy; audit signed payment settlement/refund receipt and rollback on a copied DB, confirm production last READY fingerprint by host `/api/build`, complete source gameplay 87-title phone-first QA and human artwork/anti-cheat UAT. **Do not enable auto deploy or payments before those gates pass.**

## 2026-10-14 — Fail-closed giveaway score replay admission carried into five-release source (NO DEPLOY)

- **Live host baseline:** owner screenshot `278af07` CURRENT/READY; auto deploy OFF. Isolated overhaul GitHub HEAD `89de7d8e332c8c74da0ac97a0dcca39f28f6555f` is **SOURCE ONLY / NOT DEPLOYED**, despite the release tracking source now showing additional code.
- **Security pilot integrated:** based on draft `security/official-prize-replay-gate-20261013` / PR #23, the program branch now contains `src/prize-score-proof.js`, source guard in `src/server.js`, and prize-only SQL filters in `src/results.js`, `src/admin-scoring.js` and `src/boards.js`. Official runs are held unless game-specific owner-approved independently replayed `verify='replay-ok'` evidence exists. **Approved game list remains empty; zero prize winners can be confirmed from unapproved score entries.** An admin manually setting `verify='cleared'` no longer qualifies as replay proof.
- **Free play unaffected by new prize gate:** the guard only applies to runs linked to an official event; ordinary game score submission and progression paths still follow existing anti-cheat checks. This is **not** an assertion those free-play scores are cryptographically perfect or all games are AAA.
- **Test evidence:** actual copied source `tools/test-prize-score-proof.js` executed under V8 filesystem-backed stubs: **19 assertions PASS**. Standalone module direct behavior **6/6 PASS**. Real in-memory SQLite expression: no certified games ⇒ zero qualified; certified replay-only filter excludes manual-cleared/held: **PASS**. Docker prelaunch now runs `node tools/test-prize-score-proof.js`. Updated paid/free mock payment-giveaway test expects equal anti-cheat holds and empty official leaderboard until replay approved. **Full native Node/Docker, end-to-end event scores, real Android/iOS, security penetration and owner QA NOT RUN.**
- **Current release posture:** 0 individual games independently certified for cash/prize giveaways. No official prize event should be publicly launched until at least one game is independently replay-certified and phone-tested. Security approval, refundable cosmetic debt resolution, app billing, 87-game mechanics/asset QA and the full Hub overhaul remain BLOCKED.
- **Next resume:** run native Docker suite and official event replay abuse fixtures against disposable DB, verify event random/hybrid/sudden-death modes obey the same admission gate, certify a first exemplar game and extend per-title proof before a controlled private release. Do not turn auto-deploy on yet.
