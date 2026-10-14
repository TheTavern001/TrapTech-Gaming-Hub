# Deployment, audit, and 500-game release ledger
Last reconciled: **2026-10-13 (GitHub head: `b7be1ec` at the time of review)**.

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

