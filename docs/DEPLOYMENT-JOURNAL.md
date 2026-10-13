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
