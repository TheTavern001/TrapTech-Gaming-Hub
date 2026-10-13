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
