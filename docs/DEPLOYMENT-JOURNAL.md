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

## 2026-10-14 10:27 EDT — revoke compromised player sessions across phones (SOURCE ONLY, NO DEPLOYMENT)

- **Last owner Deplexo evidence unchanged:** `278af07ebfbc0eb2e783d8294cb1707c528c0163` CURRENT / READY in screenshot. `916f5c7` and `03119b9` historic READY. Owner says automatic deployment OFF. No new Deplexo READY or live `/api/build` fingerprint was observed; development commits are NOT hosted changes.
- **Security defect proven in source:** `src/server.js` originally authenticated a 30-day `gh_sess` or `X-Session` HMAC token by valid signature/expiry only. `POST /api/auth/signout` erased the cookie but did not revoke stolen/mobile-header tokens; password updates and administrator resets likewise did not invalidate copies. This is unacceptable for prize scoring, user identity and future Android/iOS wrappers.
- **Patch:** `d31a9e1` adds additive `users.session_version INTEGER NOT NULL DEFAULT 0` migration without touching rewards or player balances; `d8a19b4` binds every new cookie/header token to the exact server-side version, rejects legacy unversioned tokens and rejects copied/expired/banned sessions after signout. Player signout, authenticated password change and administrator reset each increase session_version. Signing out intentionally revokes **all** active sessions for the player; selective device-session revocation remains future hardening. **Existing tokens require sign-in after deployment.**
- **Test work:** `fe465cd` adds exact-source in-memory auth/session contract. 30 V8 assertions PASS using filesystem/crypto/Buffer shims over the actual committed server source (not genuine native HMAC library or full Node). `bb9c5f0` adds real HTTP tests for local throwaway build DB: mobile X-Session, tamper, copied-token signout, stale token cannot revoke new login, password change, old password rejection, login again, fake Whop webhook rejection. It **refuses non-loopback BASE or missing BUILD_SMOKE=1**. `32ecfae` wires contract into Docker STEP11 and localhost HTTP behavior into STEP12, failing the build rather than suppressing test errors.
- **What is NOT verified:** native `node tools/test-session-revocation.js`, native full Docker STEP11/12, real Android Chrome/WebView and iPhone Safari/WKWebView, account-recovery flows, signed admin/2FA and CSRF/pentest. The entire account-security R4 workstream remains **BLOCKED / SOURCE ONLY**, as does the public launch.
- **Next resume point:** complete reproducible native Node/Docker tests, resolve failures; add real mobile account signout/password and stolen-token attempts to device UAT, then verify refund/score/official-event replay and mobile gameplay/3D source artifacts before manual R1–R5 release. Leave Deplexo auto-deploy OFF.

## 2026-10-14 midday EDT — block unpaid-order administrative payment bypass (SOURCE ONLY, NO DEPLOYMENT)

- **Owner host evidence remains unchanged:** `278af07ebfbc0eb2e783d8294cb1707c528c0163` CURRENT/READY in latest supplied Deplexo screenshot. `916f5c7` and `03119b9` previous READY rollback records. Deplexo automatic deploy owner-confirmed OFF. No new deployment, host fingerprint, Android test or real Stripe/BTC money flow observed.
- **Precisely identified risk:** `src/monetize.js` previously let the admin `POST /store/orders/:ref/grant` route set **any pending/underpaid order** to `status='paid'` and invoke `grant()`. Even though access was admin-only, a mistaken/compromised admin operation could mint money-backed Hub Credits with no provider settlement. The generic `grant()` path checked only `status='paid'` and a product snapshot, not stored BTC confirmations or Stripe payment intent. Do not confuse admin authority with provider settlement proof.
- **Fixes, staged only:** `470fbc5` removes the admin-paid-status mutation, rejecting unverified order grant with HTTP 409; signed payment receipt/confirmed BTC proceeds through existing validated provider path. `5016337` adds pure `src/payment-settlement-proof.js`: fail-closed check for paid BTC amount, transaction ID and required confirmations; Stripe Checkout session ID + recorded payment intent; or the original zero-dollar, reference-tagged/audited manual gift. `49455bf` invokes this check inside **every** `grant()` transaction on freshly persisted data. `7d68362` forbids manual admin gifts of one-of-one prestige visuals until preview-only approval gate is lifted. Generic audited normal cosmetic/season manual gifts remain allowed. Historical paid orders, refunds and current balances are not changed in this branch.
- **Regression protection:** `15fbdfb` modifies mocked payment API E2E to demand 409 for pending/underpaid orders, prove legitimate BTC provider fulfillment and duplicate-grant idempotence. `19ccbca` adds manual-Prestige bypass negative. `dfe63f4` updates frozen-quantity/refund native SQLite test with legitimate *mock confirmed BTC receipt fields* and a forged-paid-with-zero-confirmation negative test (no actual chain transactions). `2caabe8`, `91bd030`, `a15eb24` introduce and finish unit source settlement tests; `47759bf` updates the whole-Hub contract and `b28fe6f` wires the unit test into fail-closed Docker prelaunch. Workboard and 15-item security gate ledger updated with source-only evidence; 0 owner-approved security gates.
- **Actual verification in this session:** 30 assertions from the *exact committed* payment-settlement unit module/test executed in a V8 sandbox with fetched source + mock file-path loader: PASS. The existing whole-Hub fairness/asset/finance contract was run the same way: **232 assertions PASS**, with asset file-existence check explicitly mocked (not disk attestation). R1/R3/R4 manual release preflight executed against actual fetched acceptance files in V8: all **BLOCKED** (6/21/38 unmet areas; requested nonzero exit status). New JavaScript files parse. **Native Node + better-sqlite3 project test, Docker STEP11/12, localhost payment E2E, real providers, Android Chrome/WebView and iOS Safari/WKWebView NOT RUN.**
- **Exact resume point:** run Docker native throwaway DB checks `node tools/test-payment-settlement-proof.js`, `node tools/test-payment-order-snapshots.js`, `node tools/test-unified-wallet.js`, `node tools/test-reward-integrity.js`, entire `tools/e2e-payments.js` with mocked explorer; fix any failures. Then tackle pending R1 all-game collision/duplicate/score cases, R2 licensed art and actual phone measurement, R3 full modular avatar/shop/quests, R4 independent prize replay and security, R5 private UAT. Do NOT enable public payments, prestige sales, 500-game intake, or Deplexo auto-deploy prematurely.

**Source branch checkpoint before this journal entry:** `a15eb242ec400ef8e3af0759b09ff5ce73dc0766`, not a host build.

## 2026-10-14 — Offline release test path, fair Credits cap (SOURCE ONLY; NOT DEPLOYED)

- **Hosting:** owner screenshot last confirmed `278af07` CURRENT/READY. Automatic deployments OFF. New security/currency commits on `program/five-release-full-hub-overhaul-20261013` are not observed on Deplexo.
- **Bug fixed:** `src/shop.js` daily earn cap formerly counted 40 disqualified/held prior runs as eligible runs; now joins each ledger row to `runs` and requires `held=0`. `tools/test-reward-integrity.js` now tests an isolated 40-disqualified + one legitimate run case, in addition to hold/clear cycles.
- **Actual test completed:** isolated in-memory SQLite regression: historical Crown rows convert 1:10 exactly once, negative refund rows preserved, repeated run-review ledger corrections balance to zero, and held runs do not consume the daily cap — PASS. This is **not** full application Node20/better-sqlite3, production DB, Docker, Android or iOS verification.
- **Alternative to unavailable hosted runner:** `bash scripts/offline-release-gate.sh R1` on a complete local checkout with `npm ci --omit=dev` executes the core Node QA; add `--docker` to execute the production Docker STEP11/STEP12 locally. The script produces a local timestamped evidence log and never deploys. HTTP auth test remains in Docker localhost STEP12 only.
- **Release preflight result from latest branch sources:** `BLOCKED`, six outstanding R1 mechanics/fairness acceptance workstreams. Do **not** turn Deplexo auto-deploy back on. Run native suite, finish 87 playable-title QA and owner phone review, then make one deliberate manual R1 deployment with host SHA and build fingerprint verification.

## 2026-10-14 — owner gameplay complaint: 11 themed games + 93-source identity and 13 mechanics-family QA (NO DEPLOYMENT)

**Host:** last owner screenshot-confirmed CURRENT/READY remains `278af07ebfbc0eb2e783d8294cb1707c528c0163`; Deplexo automatic deployment OFF. These GitHub commits are **SOURCE_ONLY_NOT_DEPLOYED**.

**Source bugs identified and repaired on `program/five-release-full-hub-overhaul-20261013`:**
- `6ece7aa` Trim Rush removes keyboard Space auto-snip and fixes misleading 60s help; `a98942d` fixes first-round `nextBud()` called before `g.done=0` (zero leaves and free clean-trim score).
- `c849ae9` Bud Bar first touch on a different lane now fires directly rather than only selecting; fixes phone usability.
- `e37025d` Grow Op describes actual endless survival/3-dead-plants failure instead of nonexistent 3-minute stop.
- `30e8701` Strain Crush corrects 60s renewable clock; `ab5eb64` adds seeded legal-swap board detection and zero-reward deadlock reshuffle.
- `3abc107` Dunk Flick removes goal-coordinate-derived guaranteed keyboard basket, uses manual arrow aim and identical touch ballistics.
- `9a221a7` adds Node VM-based real game callback regression for Trim, Bud Bar, Grow Op and 40 Strain Crush seeds; `218f6d0` expands to Dunk. `493a21b` adds gameplay callback tests to Docker; `93c5204` enriches full-catalog scanner with possible exploit/time/graphics flags and mechanics families.
- `d8277f3` adds exact 93 registered ID owner QA snapshot: 87 proposed active, 6 archived, 13 mechanically related review clusters; one especially high-risk remaining duplicate is **Haze Defense ↔ Pop Defense** (both build/upgrade on path vs layered/splitting enemies; Keep Guard also needs comparison).
- `915c159` / `5cfd624` add all-93 mechanic matrix consistency test to Docker; `28ca3cd` publishes `docs/audit/OWNER-GAMEPLAY-CANNABIS-DUPLICATE-PASS-2026-10-14.md`. Workboard updated with source-only evidence.

**Actual validation:** exact committed scripts and latest GitHub game source callbacks evaluated through a V8 simulated Node VM filesystem: **234 gameplay assertions PASS, 361 catalog/source-registry assertions PASS**. Full Node/Docker build, browser/WebGL assets, actual Android/iPhone gameplay and 60 FPS, signed score replay, license/owner AAA certification **NOT RUN** for this branch. No game was approved for release and no new games added toward 500.

**Next resume:** execute full native Docker/Node prelaunch in complete checkout; repair anything it fails. Compare each of the 13 families on real phones and consolidate proven gameplay duplicates while preserving score IDs (especially Haze Defense vs Pop Defense/Keep Guard). Replace procedural placeholder visuals using commercially sourced assets and integrate directly into game scenes. Finish R1–R5 Hub-wide QA before any controlled deployment. **Do not turn auto-deploy back on yet.**

## 2026-10-14 — owner asked proximity to adding games/public release; Grow Op long-session stability (NO DEPLOYMENT)

**Confirmed facts from exact source/evidence ledgers:** 13 core + 80 library historical games = **93 tracked**. Six archived duplicates ⇒ **87 proposed playable**, but **zero individually owner/AAA/device-approved**. Hence **413 additional *distinct, accepted* games** will eventually be needed after all current 87 qualify. The minimum public accepted-game shortfall remains 500 until approvals occur. The 26-workstream five-manual-release program has **0 evidence-approved**, while 15 security release gates have **0 independently VERIFIED**. These are evidence-completion counts, not estimates of how much code is written.

**New source-only work:** `4766653` changes Grow Op pests from unconstrained per-frame probability and never-expiring NPCs to seeded timed arrivals, bounded maximum **18** active actors and 9–14 second actor lifetime; aggregates pests by plant in one pass instead of six filtered scans every frame. `b2724c2` tests two reproducible simulated **12-minute** runs and verifies spawning, expiration, bounded retention and determinism. Latest exact game callback code evaluated in V8 shim with **238 assertions PASS**. Not measured phone FPS or full native Node/Docker.

**Release tracking:** `25b466d` introduces read-only `node tools/owner-release-readiness.js`, an honest R1–R5 operator scorecard from the workboard, security and game acceptance ledgers. A source-backed V8 IO shim verified the output: **BLOCKED**, 26 workstreams/0 approved, 15 security gates/0 verified, 87 proposed games/0 approved, 500 accepted-game shortfall. `dbca5b1` refreshes the workboard without falsely certifying game quality.

**Asset reality:** GitHub contains original commercial-use-eligible Kenney/other source GLBs for chase vehicles, but having binary assets staged is **not** proof they render, replace the procedural artwork in every game, or meet the desired AAA presentation. Asset presence and visual device approval remain separate.

**HOST:** owner screenshot last confirmed Deplexo CURRENT/READY `278af07`; auto-deploy remains **OFF**. Neither this source work nor prior full-overhaul commits are confirmed deployed. No new games admitted, no public deployment attempted. Preserve live data.

**Next resume:** execute full native Node Docker STEP11+STEP12 and source gates against a full checkout, diagnose all failures, complete R1 duplicate + gameplay acceptance, R2 licensed asset/render passes, R3 avatar/shop/Hub, R4 security/payment/real-phone stress, R5 owner UAT and one controlled release. Only afterward start importing the remaining games in *approved batches*; require 500 accepted distinct games for public launch.

## 2026-10-14 afternoon — owner readiness report + Grow Op one-tap fairness (NO DEPLOYMENT)

The owner requested actual proximity to the final 500-game intake and public deployment. Latest branch head was independently checked; the existing source-backed `tools/owner-release-readiness.js` reports **26 workstreams / 0 owner-approved**, **15 security gates / 0 verified**, **87 proposed playable of 93 registered**, **6 retired historical IDs**, **0 games individually approved**, **413 additionally approved games required for 500 active**. No defensible launch date from these numbers. Owner's latest screenshot remains Deplexo `278af07` CURRENT/READY; auto-deploy remains OFF. GitHub source work is NOT on that live build.

Concrete R1 source fix: `public/games-lib/grow-op/game.js` now handles each smartphone touch as exactly one action: nearest live pest within radius 26 gets hit, otherwise select the touched plant. Previously one pest tap could also switch selected plants and score two overlapping pests. No new game added or visuals/score rules inflated. Added actual callback regression `tools/test-grow-op-touch-fairness.js` to Docker STEP11. The committed source and test executed with V8 Node-file/VM shims **11 assertions PASS**; actual Node/Docker and physical Android+iOS NOT RUN. Commits: `000864d5` game; `67b9513e` test; `7f65bfc3` Docker hook.

Next precise R1 resume: run complete native Node 20 / Docker suite, finish 13 high-risk mechanic-family reviews including Haze Defense/Pop Defense/Keep Guard, repair source and mobile controls, obtain real phone screenshots/FPS and score replay negatives. R2 external assets across every active game; R3 modular avatar/shop/meta; R4 verified security; R5 private UAT. Game intake toward 500 starts only after existing Hub gates pass. **Do not turn auto-deploy on yet.**

## 2026-10-14 — prize-score repeat-admission regression (source only)

- Commit `838ff3a3dae5d32f59967b1c5b5ba04db3e1e820` adds negative assertions to `tools/test-prize-score-proof.js`: an already-held verdict stays held on a repeated admission, the missing-proof flag does not multiply, uncertified games remain ineligible even when `verify` is forged as `replay-ok`, and unsafe SQL-alias input cannot influence the empty certification filter.
- Only the test source changed; **no new game was certified** and there was **no deployment**.
- Verification in this continuation: GitHub confirmed the commit; native Node execution, Docker, HTTP integration and phone prize flow are **NOT RUN**. Execute `node tools/test-prize-score-proof.js` and the full offline release suite before interpreting the change as a passing regression.
- Next code focus: game-by-game touch/physics scoring audits and adversarial server replay, while keeping official prize eligibility fail-closed. Continue keeping Deplexo automatic deployment **OFF** until the manual release gate is satisfied.

## 2026-10-14 — same-day launch push: offline prize security coverage

- Source commit `c3ac4c67219bb2eff70ee8fd0988437da57b95cb` adds `tools/test-prize-score-proof.js` to the manual `scripts/offline-release-gate.sh` suite. This closes a verification-script omission: the official prize fail-closed regression was previously not included in the developer's consolidated offline gate.
- GitHub connector confirmed source commit; native execution of the combined suite, full Docker build, Android/iPhone testing, and a new Deplexo deployment are **NOT RUN**. Adding a test command is not evidence that the test passed.
- Owner requests rapid game expansion and public launch on 2026-10-14. Current admission queue contains five research-only candidates with unverified media rights/mobile score replay; **0 new imports approved**. Do not mislabel source registration as game or prize certification. First objective: offline suite and closed private phone QA; public security and payment gates remain mandatory.
- Auto-deploy remains OFF. Last owner screenshot-confirmed CURRENT READY image remains `278af07`; no new production build claimed.

## 2026-10-14 — condensed operator handoff, R1 offline QA wiring

- Commit `13702142568695506e2fe7c2f8bf71203451fd4b` adds **existing** owner gameplay-distinctness and cannabis/Grow Op touch/interaction regressions to `scripts/offline-release-gate.sh`. The scripts already existed but were missing from this consolidated offline gate; source integration only, no claim of newly fixed gameplay.
- Native Node/Docker tests **NOT RUN** in this connector-only edit; new Deplexo production deployment **NOT TRIGGERED**. Existing 87 proposed games still require phone-level acceptance; remaining 413-game expansion is on hold for public readiness, but candidate development may proceed separately.
- Exact resume: run `bash scripts/offline-release-gate.sh R1 --docker` from a full checkout with a local container engine; collect first failed log line and fix underlying cause; then run all R1 in-game touch/scoring tests on an actual phone. Do not promote source-only results as device approval. Owner need not toggle anything; **auto-deploy OFF**.

## 2026-10-14 — release gate refuses non-Docker source-only success

- Commit `165953eeeafac11a632441e07dbc7e26fad435b2` fixes a fail-open reporting gap in `scripts/offline-release-gate.sh`: omitting `--docker` previously printed SKIP without raising the failure count and could imply a completed local gate if all other checks were green. It now records Docker as NOT RUN, increments the failure count and returns nonzero; a release candidate must include the real container verification.
- GitHub accepted the source change. Local script execution and actual Docker image build remain **NOT RUN** in this session; no Deplexo push or deployment occurred. The new guard is source-reviewed, not an end-to-end passing audit.
- Exact continuation: run `bash scripts/offline-release-gate.sh R1 --docker` on a full checkout with Docker/Podman available; triage the first failing test, then capture Android+iOS touch/visual QA and owner signoff. Keep auto-deploy OFF until gates really pass. Game candidate screening may continue in parallel without counting research-only titles as playable.

## 2026-10-14 — Arrow Hero real gameplay collision fix and regression

- `f6f4c4aa477be64fcf36a777f60d457817078aad`: replaced frame-end-only arrow/enemy proximity with swept segment-to-circle detection in `public/games-lib/arrow-hero/game.js`. This corrects arrow tunneling when a fast projectile crosses an enemy between update ticks (common with lag or dropped mobile frames). No changes to damage, player movement, score awards or premium stat bonuses.
- `1caa9c68281026c34fc18b77bcdd4913cdbf6744`: added deterministic gameplay callback regression for direct segment crossing, tangential hit, near miss and pre-contact small timestep.
- `6fb8df48a34dd40ce07972c7b12bab1c1f71c7c4`: included this regression in the consolidated offline release gate.
- **Executed V8 test harness in the connected-tool environment against the fetched real source:** four scenarios returned [{score:25,remaining:0},{score:25,remaining:0},{score:0,remaining:1},{score:0,remaining:1}] — PASS. This is deterministic engine-callback testing, NOT native Node file execution or independent browser/Android/iOS visual QA.
- **Not run:** complete Node regression file in repo checkout, full Docker image, production Deplexo rollout, device FPS/touch tests, score replay security. No game is owner certified.
- **Resume:** expand this verified gameplay correction pattern across the existing 87 proposed active games; execute `bash scripts/offline-release-gate.sh R1 --docker` on a complete checkout before manual deployment. Avoid conflating one game regression with full Hub readiness. Auto-deploy remains OFF.

## 2026-10-14 — real Arrow Hero procedural room navigation repair

- `5763273e6f7c0b95e6898bf076b686e2644015f7`, finalized by `cea0eeb09074255d4accb579a09c0c3565461e4d`: obstacles in Arrow Hero rooms are now placed into lateral bands, preserving a central passage for the 12px-radius player from spawn to exit. The first attempt used a wide 62px band that did not guarantee clearance; the 36px bound fixes this. Treat the second SHA as the correction.
- `2e0a48f8027914863259d4fb17ddd24f1bc0b076`: adds a 1,000-room reachability test driving the actual room transition callback rather than merely matching source text.
- `4b7b6d2f539b6388f37c05efb503d683d9a452ec`: adds the new navigation regression to `scripts/offline-release-gate.sh`.
- **Executed source-level V8 room-transition probe against fetched game code:** 1,000 transitions, minimum measured centerline clearance 46.7px, zero path-blocking placements. This does not prove that all alternative obstacle/AI routes and device input are correct. Native Node file run, browser QA, Android/iOS QA, Docker build, Deplexo deployment remain **NOT RUN**.
- The production version remains screenshot-confirmed `278af07`; no release candidate was deployed. Resume by running the entire offline suite in a full repository checkout with Docker and correcting any failures before a deliberate private preview. Owner need not enable automatic deployment yet.

## 2026-10-14 — Arrow Hero hostile projectile collision fix

- `27f9099de573ac6f4f8151f4f8247c7a97eb063e` replaces end-point-only enemy bolt/player detection with a segment sweep; this prevents hostile bolts tunneling through the player on slow frames while preserving invincibility checks. Offscreen projectiles are still removed after collision adjudication.
- `228a62b8f2a6e916958b45b0487b17f68a6c4298` adds real game update callback regression for crossing hit, near miss, invincible player, and too-short flight. `1845e8ce48596f6a29064e2da15f98bc4cce83ee` adds it to the offline release gate.
- **Executed on fetched committed JS in an isolated V8 harness:** all four observed results matched expectations: crossing damage 7.5; other scenarios damage 0. No real phone frame measurement or full Node/Docker gate was run.
- **No production deployment**; owner should keep Deplexo automatic deploy OFF. Resume from current branch head, run Docker-based release checks and broader gameplay/device QA; catalog and public launch remain unapproved.

## 2026-10-14 — Arrow Hero post-movement contact fix and deployment boundary

- `3920b453b08892ef883d9d2d022793a8cb4db63c`: fixes enemy contact using stale positions computed before AI movement; contact is now checked at the enemy's final location in the update.
- `8db136c7b5671c7ca44cf7b57dd95bc4a9f87b21`: new contact-vs-near-miss callback regression. `8f2d29e0744d22f942d5965b2db0399e8ba81061`: wired into consolidated offline release suite.
- Executed against retrieved committed game code in V8: slime starting at y=428 reached y=424.5 and dealt 9 HP on contact; slime starting at y=460 reached y=456.5 and dealt 0 HP. Both expectations PASS. This is **not** proof of physical-device smoothness, whole-game balance, or complete Docker tests.
- Production unchanged; latest owner screenshot still identifies `278af07` as READY. Do not enable automatic deployment merely because source-level regressions pass.
- Next checkpoint: execute the complete Docker-backed offline release suite in full checkout, resolve failures, then verify mobile/visual/score/security approval for the private candidate. Expand research/intake in parallel but don't mark 500 admissions as completed.

## 2026-10-14 — Grow Op difficulty clock fix

- `ca5de37093104659d7511ac4b43cc854a3768ec6` corrects pest wave acceleration to use Grow Op's own elapsed clock (`g.time`) instead of host engine `g.t`, preventing progression from depending on unrelated host time state.
- `2658b797e5b1296329d206bbc582eb39abb15f3b` adds a three-interval game-callback regression; `c8219c2dd4d8639f6109a4f07638ea25f16706f9` wires it into offline release verification.
- Executed the updated real game callback using V8: at elapsed 0/300/10000 seconds, next wave intervals measured 4.49947/2.92053/0.75 seconds, with exactly one pest spawned each; expected difficulty acceleration PASS. This is not full Docker or Android/iOS device QA.
- No deployment initiated. Release remains BLOCKED and auto-deploy OFF; next step remains full Docker-backed preflight and cross-game phone acceptance, alongside additional genuine gameplay repairs.

## 2026-10-14 — Grow Op stalled-frame pest backlog control

- `2d08bb58db49a69275a727ed8e8b40ba0f71b99c`: preserve limited overdue pest waves on slow frames using bounded catch-up (maximum four waves per tick); reset stale backlog after suspension so there is no unbounded loop on mobile resume.
- `07f0f76dfcc6e78df8099aba1e3e682a307b5a8c`: deterministic callback regression for no early spawns, three overdue waves, and four-wave cap/reset under extreme backlog.
- `bd78a1aafcfde44b9dbee6727891e9d52c4a037a`: includes regression in consolidated offline release gate.
- Executed isolated V8 callback on fetched committed source: timer +0.1 => 0 pests; timer -2 => 3 pests and +0.25 timer; timer -99 => 4 pests and +0.75 timer. Expected results PASS. No native Node full-suite, Docker, phone performance, or host deployment verified.
- Owner must keep auto-deploy OFF; the five-release overhaul and game additions are not fully integrated or QA-certified. Continue with complete local Docker gate, gameplay/mobile UX/security checks, then controlled private release.

## 2026-10-14 — canonical release rehearsal coverage integration

- `67a2bd9f9f7de06fd49a87902727252ec403d232` adds eight existing game QA programs to `tools/offline-release-rehearsal.js`, including four Arrow Hero regressions, two Grow Op regressions, duplicate-mechanics review, and cannabis gameplay QA. Previously the primary `npm run verify:offline:full` path omitted these newer suites, despite a separate shell script containing them.
- Confirmed the GitHub write and script entries; **native Node test execution, Docker image build, and phone testing are NOT RUN**. The Dockerfile was inspected but a proposed modification was not committed, so do not claim these checks are part of Docker STEP11.
- This improves release verification coverage but does not advance 0 human-certified games or authorize a Deplexo deployment. Keep auto-deploy OFF. Next run full checkout `npm run verify:offline:full`, fix first failing command, obtain private phone and security evidence. This checkpoint remains source-only.

## 2026-10-14 — rehearsal fail-closed on missing Docker verification

- `bc1d6d701051c8c47a6152db07d4f0d20d42c1e0` changes `tools/offline-release-rehearsal.js`: source-only `npm run verify:offline` now records Docker as NOT_RUN and cannot report `allChecksPassed:true`; an explicit `dockerVerified` field only becomes true after successful complete Dockerfile build in `--full` mode.
- GitHub commit confirmed; full checkout Node execution, Docker build, browser QA, physical Android/iPhone and production smoke **NOT RUN**. No deployment initiated.
- Resume with `npm run verify:offline:full` on a full checkout and the current PR head, then fix any actual failing tests and gather physical phone/payment/score evidence. Auto-deploy remains OFF; 87 proposed playable, 0 quality certified, 0 additional games admitted. Source-only code changes do not confer approval.

## 2026-10-14 — container prelaunch integration and daemon verification

- `89565f2d0072908dd743bc97012344e8849a1359`: actual build-stage Dockerfile now runs six real Arrow Hero/Grow Op gameplay regressions alongside other prelaunch checks; earlier the checks ran only through detached offline scripts. The Dockerfile continuation syntax was read back and inspected after commit.
- `b699918183f76fcf4337fb638ed4ae93cd06c10d`: canonical full rehearsal now probes `docker info` (working daemon), not just `docker --version` (CLI existence). This avoids misleading readiness where Docker is installed but the engine is unavailable.
- Local container environment inspected in this continuation: Node v22.16.0 and git 2.47.3 exist; **Docker binary absent**; private GitHub repository cannot be cloned through public HTTPS due unavailable DNS/network in local runtime. GitHub app connector edits are confirmed but do not furnish a local checkout. Therefore **Docker image build, integrated HTTP tests, and physical iOS/Android QA NOT RUN**. Do not mark those gates green or authorize production deployment.
- Exact resume: obtain an executable checkout and Docker daemon, run `npm run verify:offline:full` for the full candidate SHA; triage failures, verify mobile/security/payment and owner acceptance, then explicitly authorize a controlled private Deplexo deployment. No expansion candidates certified. Auto deploy remains OFF.

## 2026-10-14 — Grow Op pest frame-spike birth order fix

- `cabf5679fbe39ff203b84314a49ac48b57375a1b`: active pests are aged/removed before overdue pest waves are born, preventing newly generated pests from immediately aging out in a long phone frame. The path also bounds lateral pest movement across frame spikes.
- `33c3971e35e37284ec7ac415f9f183cde2cebcb3`: regression ensures spawned pests start age 0 after a 10-second simulated gap and contribute to plant pest pressure.
- `f8d7ff731c942ec48c927a082974cfa090d661e3`, `ebaab7a0e90e519d341f232c7c33579934c59e46`, `962e1682b495b074f9cace13c78671010912e0b5`: added regression to canonical rehearsal, shell release gate and Docker image prelaunch.
- **Executed isolated V8 callback test on fetched committed source:** with healthy plants after simulated 10-second frame gap, 3 spawned pests persist with age 0 and no game-over. Native Node, entire Docker, physical devices and hosted rollout NOT RUN. This does not certify AAA visuals or entire-game fairness.
- Deplexo auto-deploy remains OFF. Resume with a runnable checkout for complete `npm run verify:offline:full` and Android/iOS verification; game intake and public launch require separate acceptance.

## 2026-10-14 — Grow Op immediate swat fairness

- `9a9a3561f7952a7917863518bbffdd67aa6e2ff1` fixes one-frame stale pest pressure: a touched, killed pest no longer damages its plant during the same update.
- `4f50717234673cfe8651d44bc85cdd3deec2dec2` adds real gameplay callback regression for swatted vs unswatted pest; `93b65248a6c2ef83177033ba2b9102785d13b7a5`, `f765c4e64393c082fbf684899f0cb0b5ade62f2a`, and `f43746575c2517b8a402a19b4f12caa2febda451` wire it into canonical rehearsal, offline shell gate and Dockerfile.
- Executed isolated V8 callback on fetched source: swatted earned 5 points and removed the pest, unswatted earned 0 with pest retained; swatted plant had higher health after identical tick. PASS. Complete Docker build, physical phone QA and security checks are NOT RUN.
- Existing Hub full AAA/game catalog certification remains pending and Deplexo auto-deploy stays OFF. Resume with full Docker-backed test on an executable checkout, then mobile verification and controlled private deploy.

## 2026-10-14 — Grow Op expired-pest fairness repair

- `0eec6d389da4b9725831edc725eedb66b7a72c16` moves plant-health processing after same-frame pest aging/removal and live pest-count reconciliation. Previously a pest expiring in the frame could still inflict stale damage.
- `0ebf9794033f45abbfa495add7f0f03831e2e880` adds a deterministic real update-callback regression. `6d3afc48a4d9debc016535c05c4f85012c8652cb`, `014315192f57f57f1aaf25bf2e330102d43dc714` and `709f73f2ed7ab0d2ba202e1cef111cc59c800263` integrate it in canonical rehearsal, offline gate and Docker build.
- Actual isolated V8 execution on fetched game code: expiring pest gives plant health delta +0.004 and active pest +0.001 for identical 0.1-second tick; expected difference PASS. Full native Node suite, Docker image, mobile devices, hosted HTTP and cash/score security acceptance remain NOT RUN.
- Release still unapproved. Keep auto-deploy OFF. Source-only progress must not be counted as completion of the avatar, shop, mobile, anti-cheat and 500-game goals.

## 2026-10-14 — Grow Op phone tab suspension health integrity

- `1e673f355abbef15948ac88deae340ac7319989b` bounds per-frame plant-resource, health and growth simulation to 0.25 seconds while retaining actual survival elapsed time and bounded pest-wave catchup. Without this, long mobile tab suspension can instantly eliminate plants on resume.
- `4950377336f97fef9a8b109b985f1640344d0cc5` regression simulates a 600-second phone tab suspension with healthy plants, asserts same plant health and water delta as a 0.25-second update, zero deaths, and full elapsed survival time.
- `602c030fe9bf7be28753aa78d707b9400cbdd91e`, `e4cadfbaa8b0ad36c6d2133f02c37e465179de12`, `e651fd07ddae5ce8288cde0eca55d3bde10d1e45` include regression in main rehearsal, offline gate, and Docker prelaunch.
- V8 executed updated real game callback: both .25s and 600s produced plant health .52, water .38875, deaths 0; long frame reported 600 elapsed seconds. PASS. Native Node full test, container build, device and live host not executed; game is not AAA certified.
- Deplexo screenshot remains CURRENT READY 278af07 on old QA branch. Source changes committed to PR #29 only. Auto-deploy must remain OFF pending integrated private candidate, full build and device acceptance.

## 2026-10-14 — shared Kit mobile lifecycle hardening

- `16a3985f8b64225e7d93b6830c7684daf383bc91` adds `pagehide` and `freeze` handling to the shared canvas Kit: revoke active touches, keys, virtual stick and on-screen button state; pause active play when mobile pages are frozen or navigated away. Existing `blur` and `visibilitychange` paths remain.
- `925e5921cd0a6214263f167698f2aeabe092edf7` adds static lifecycle source-contract test. `7c6248a780217f1b7f46735eb5b77a0720260092`, `8983dc2baa5836d26b45bc51dfd5c1a0ec71238d`, `36f5e4d67c91b5042d472a53fcb0e515d7250924` wire it into canonical offline rehearsal, shell gate and Docker image build.
- Repository source inspected and changes committed through GitHub connector. **The new static contract test, complete native Node suite, Docker build and physical Android/iOS lifecycle checks were NOT EXECUTED in a full checkout.** Do not infer release readiness.
- Production current screenshot remains 278af07 on old QA branch, unchanged. PR #29 is source only. Keep automatic Deplexo deployments OFF until complete candidate and host verification. Next action: integrated build QA and cross-game source/asset work.

## 2026-10-14 — Shared Kit result submission error recovery

- `66383337885f5a732eb3a6d0fcbc31804933bacf`: `public/games-lib/kit.js` now normalizes Hub.score submission into a Promise and catches synchronous/rejected network/API failures, resolves pending result with a user-readable failure instead of hanging forever. This changes the shared end-of-run path for Kit games, not a single game.
- `583a3f534fdc1c256c405c2ac1fe2b77ccaf9acc`: static failure-handling contract regression. `855acf79e8e2fafce1b7fffbc8a9afc4880cdf99`, `5a4d0ba6d359f9b5f62bfc4f5af0ecf52dcf3fbe`, `8835d93b2a24cfc80abf6bfa09811c98bcfa92c0`: wired test into canonical offline rehearsal, shell gate, and Docker prelaunch.
- Source-readback contract inspection on fetched code: sync conversion, rejection catcher, clearing pending result, updating lastSubmit all present (PASS). The Node test program, full Docker run, live HTTP score rejection, and Android/iOS QA are **NOT RUN**. Do not infer this fixes server-side score authorization or guarantees retryability.
- Screenshot-confirmed production remains `278af07`; PR #29 source work not deployed. Owner must keep Deplexo auto-deploy OFF until an integrated tested candidate. Next: test the actual browser failure UI under network loss, audit other shared-game API error paths, do full Docker-backed test and device acceptance. AAA art/avatar/shop and game intake remain unapproved.

## 2026-10-14 — Shared game start and score submission failure recovery

- `66383337885f5a732eb3a6d0fcbc31804933bacf`: shared Kit end-of-run score submission now clears pending state on rejected or throwing API calls; error shown in results instead of pending forever. `583a3f534fdc1c256c405c2ac1fe2b77ccaf9acc` adds static contract test, with release/Docker integrations through `8835d93b2a24cfc80abf6bfa09811c98bcfa92c0`.
- `b5a80688a55b7fbb1dd8dd9eeb8f6199b6930f6d`: shared Kit `begin()` now recovers from failed `Hub.start` to title state, showing 'Could not start game. Check connection and retry.' It does **not** create a run if start failed; player can retry. `451e826049c47db1d80dac664690e197988232e8`: source contract test. `e12f4c4b5af8d692fbc540e635b354ff37bb49af`, `cfc3ce7466badcc90c4e33bf09d733901ae6c760`, `d81ae2f6c2d31334c6471ec8f7de06b2edec97c9`: wired into offline rehearsal, shell gate and Docker.
- Fetched actual committed Kit source and checked expected start failure handler, visible title error and score rejection catcher exist (PASS source-readback). **Native Node execution, true browser network-offline test, Docker full suite, and physical Android/iPhone QA not executed**; these are not AAA certifications.
- User requested finished premium graphics, gameplay, avatar, shop, economy, security, 500 titles and visual examples after completion. These remain unfulfilled; don't present mockups as shipped visuals. Production remains 278af07 according to owner Deplexo screenshot; PR #29 is undeployed; keep automatic Deplexo deployments OFF. Resume by obtaining executable full repository checkout/working Docker engine, complete release suite, then actual phone QA and visual approval, then controlled private candidate.

## 2026-10-14 — Shared Kit cross-run score callback isolation

- `bd9bb458829ebbc18a08edb44c32d5c74f6b7dae` increments a unique run serial at start and captures a final score snapshot at run end. Asynchronous score responses (both success and rejection) are applied only to the original run, preventing a previous run's slow network completion from overwriting a later run's result.
- `046d43f5ad9aff3a2b284559841e4f0560c381d8` adds run callback isolation test; `8764853f63077bf59978eaaed325dc155f9b72bd`, `5d83f386321712bcd641eb6c1da8e2f875032f8e`, `f4de3fb64e6ac9adc0323b7a7d0777974c005b6c` wire it into canonical rehearsal, shell gate, Docker prelaunch.
- GitHub source readback confirmed serial increment, two stale callback guards, immutable submission score snapshot. This is a static source contract check, **not** executed in browser/Node full test, Docker, Android or iPhone. Score server anti-cheat remains independent and unverified.
- Current Deplexo screenshot remains old `278af07`; no deployment initiated. Keep auto deploy OFF pending all release gates. Next resume on PR #29 with actual build/test checkout and substantive visual/avatar/shop completion; do not count source mechanics as AAA-certified games.

## 2026-10-14 — Kit async game start while mobile tab hidden

- `163ecb7149f4e67535c88d6a720d7fd71053389c`: when a game start API call completes after the browser tab becomes hidden or the settings panel opens, Kit starts the game paused rather than silently running on the background tab. Power-up audio is also withheld while paused.
- `050d9af0e39902d22da413c575b812868b6804a3`: added a static regression contract for asynchronous start/hidden-page behavior. `671f0c2e33ce12e01e855a8dfa55c49c1ccc8f2e`, `a51d674a43b15bf21761912adb1d3e813075a70f`, `3262b2aae22e2325833cb6647629029372a621ea` wire it into canonical offline rehearsal, shell gate, and Docker prelaunch.
- GitHub changes committed, **new Node test not executed in full checkout; Docker/browser/device evidence not run**. Keep Deplexo auto deploy OFF. Production still screenshot-confirmed at `278af07` and no source-only fix qualifies game or hub as AAA-approved.

## 2026-10-14 — separate private preview preparation from public release signoff

- `05e49a7af612614d2de904f5dce231865881c7ec` adds a **read-only** `--private-preview` mode to `tools/preflight-manual-release.js`. The old strict owner/device/public approval behavior remains on its existing path. Private preview path lists predeployment requirements and deliberately reports `sourceReadyForPrivateDeployment:false` and `automaticDeploymentMustRemainOff:true`; with `--require-ready` it fails. This avoids conflating phone-testing access with finished public certification while never authorizing a release by mere flag.
- `3005302b029c3bbd2fe4b1c0809bd78ab2c734c9` adds static fail-closed preview contract test. `c8a8bba0f1c0c85c8063a1284ad5b012334073d4`, `e9450e61e274d62fd6726b723459b292cb6ea207`, `f1b1ad25eae224106ce7893ecfbecf6aed12224c` wire it into canonical offline rehearsal, shell gate and Dockerfile prelaunch.
- Fetched post-commit source and compiled JS using V8 Function after removing executable shebang: **syntax PASS**. New script not executed in actual native Node; full Docker, local server HTTP, Deplexo and physical device evidence still **NOT RUN**.
- Production screenshot still `278af07`, owner auto deploy OFF. Next milestone: exact candidate SHA complete Docker/HTTP checks, private access and payment/prize feature gates, backup rollback plan, then owner explicitly enables a **controlled private** deployment. None of the 87 proposed games has complete quality signoff; broader AAA visuals, avatars, shop and 500 titles remain outstanding.
