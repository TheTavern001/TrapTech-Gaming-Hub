# Controlled private candidate — 2026-10-16

This candidate fixes verified release defects. It is not a public-launch or AAA certificate. No Deplexo setting, production account, payment, or live database was changed during this work.

## Verified locally

- Node 24.19.0 and native better-sqlite3 12.11.1 (SQLite 3.53.2); Docker build/runtime both select Node 24 Bookworm. Package lock and engine agree.
- All 83 executable source checks from the actual Docker audit block passed through `tools/verify-candidate-native.js`; the complete Docker image itself has not been built here.
- Actual 64 MB heap server startup, 34 localhost deployment/asset checks and 17 session/login/revocation checks passed.
- 21 real-server private-review HTTP checks passed: guest/sign-up denial, existing authenticated reviewer access, copied-token revocation, payment lock and signature validation.
- 25 native SQLite / signed synthetic Stripe webhook checks passed: duplicate delivery, early refund, retry after financial reconciliation, original quote amounts, Prestige 2x, derived reward reversal, independent pass preservation and raw-XP Credit grants. These are local fixtures, not provider transactions.
- Economy regression: 49 passed, zero failed. Production dependency audit: zero known vulnerabilities reported at verification time; this does not establish penetration-test clearance.
- Consistent pre-migration SQLite backup, corruption rejection, original owner preservation and private backup permissions passed. The snapshot key now covers every server module, including payment/wallet migrations.
- Runtime fingerprint: `4d35a6d7dc30502f58d85893`.

## Defects fixed

- The final Docker stage copied original public files after build-time icon generation. It now copies the generated public tree that was tested.
- Five active core games referenced ten nonexistent card files. Deterministic cards now reuse their original shipped sprite art; every registered core cover is checked before deployment.
- Private HTML handlers overwrote the review middleware's no-store policy. Both plain and gzipped HTML now retain no-store.
- Imported Hex Stack still loaded a source-site Google Analytics beacon. Removed it and fixed coarse-pointer phone detection and viewport zoom.
- A long player name broke the mobile hero heading; game headers also squeezed the game title beside the username. Names now have their own greeting line and game controls retain 44px targets.
- Paid refund handling acknowledged failed reconciliation and lost refunds received before Checkout completion. Failures now request retry and signed refund tombstones prevent later re-grants.
- Prestige refunds now clear accelerated-only free/premium track items and equipped references while retaining raw XP and independently earned rewards. Later legitimate play can unlock them again.
- Premium Credit rewards previously followed boosted cosmetic levels. They now follow raw earned levels and grant once even when the cosmetic was claimed earlier.
- Standalone season/economy initialization no longer queries missing optional store tables.
- Several stale tests checked obsolete code strings or a wrong order reference. They now execute the real input/submission behavior, including multi-touch, asynchronous failures and stale run responses.

## Catalog / phone evidence

An initial complete 87-title Chromium phone-emulation pass found no JavaScript exceptions. It exposed five missing covers and the Hex Stack tracker; intentional QA score interception also generated misleading HTTP-403 console failures and has been corrected without submitting a score. Most games exceeded the 25ms frame-time threshold in this software-rendered environment. These are recorded failures, not phone performance certification.

Final Node 24 results, fingerprint `4d35a6d7dc30502f58d85893`:

- 87/87 titles reached play and passed functional smoke, with zero JavaScript exceptions, console errors or missing local assets. This is a short startup/error/asset smoke, not full collision, exploit, game-balance or completion acceptance.
- The strict browser suite exited **1**: 79 titles exceeded the 25ms emulated frame-time budget, so only eight rows passed the combined smoke. No performance threshold was lowered and no game was certified from these results. An isolated active-frame probe confirmed the browser uses ANGLE/SwiftShader software rendering; Void Swarm still measured about 100ms p95 over 178 active frames at DPR 1.5. This does not establish phone performance.
- 20/20 Hub page checks passed at 360px and 430px, including lobby, games, shop, store, avatar, season, quests, achievements, booking and leaderboard. These are Chromium phone-emulation layout/load checks, not real Safari or physical-device evidence.
- Fresh `npm ci --omit=dev` succeeded from the lockfile, and the independently installed SQLite and SVG native modules executed successfully.
- All 1,029 tracked runtime inputs were compared byte-for-byte with their staged Git blob hashes before the final native run. Eight existing asset license files had been materialized with LF line endings; their words were checked against original Git blobs and retained unchanged. Those LF bytes are now included in the candidate so the deployed fingerprint matches the tested artifact.

Raw results, native logs, source manifest and dependency/public-gate reports are in `docs/audit/reports/2026-10-16/`. The source architecture ledger still reports zero approved 3D wearables and no certified neutral starter; the avatar overhaul is not complete.

## Final branch reconciliation

The eight R1 commits ending at `5fb461c077bfa42fe17f8a4333c730c7d73af2a8` were inspected before combining the watched QA branch with this candidate. Their auditor regression, immutable order-reference fixture, touch/submission regressions, icon/versioned-URL checks and historical failed-build records are preserved alongside the newer fixes. Historical auto-deploy ON text is retained as history and does not override the latest request to finish before re-enabling deployments. The actual dashboard remains unverified.

The complete reconciled native pipeline passed again with **83** executable Docker-block checks and the same runtime fingerprint. No browser/UI/runtime inputs changed during this reconciliation, so the 87-title and 20-page results remain tied to the same artifact.

## Existing Deplexo app: first controlled review

1. Keep automatic deployment OFF. Use the existing app and persistent `/data`; do not create another app.
2. Preserve existing runtime secrets, admin path and database. Set `HUB_PRIVATE_REVIEW=1` and `HUB_PREVIEW_USERNAMES` to an existing active Hub player account. An admin username alone is not a player account; the server deliberately rejects a nonexistent reviewer.
3. Select the exact candidate commit/branch on that app. The last saved host evidence watched `qa/gameplay-distinctness-and-collision-20261013`, not current main; simply toggling automatic deployments would not select these changes.
4. Build once manually. The host must run the Docker checks, take the pre-migration snapshot and become healthy. If any check fails, retain/restore the previous image and inspect its log; do not bypass the check.
5. Verify `/api/build` against the fingerprint above, authenticated reviewer access, guest 503 responses and disabled checkout before phone review. Run `BASE=https://existing-host node tools/verify-private-preview-live.js` for the anonymous restrictions, then sign in as the approved reviewer on the phone to check owner access separately.

The Deplexo dashboard was opened read-only in this session and stopped at its sign-in screen. No authenticated dashboard/settings/deployment state could be verified. Public endpoint fetches were inaccessible through the web checker, which does not establish downtime. No Deplexo setting was changed.

Automatic deployment, public access, paid/Prestige launch and prize certification remain unapproved. The read-only public gate still exits 1 with all nine required acceptance records missing. Public release still needs actual host/image evidence, Android/iPhone gameplay/performance and visual acceptance, complete avatar/wearable assets, provider settlement/refund verification and security/score acceptance. There are 87 playable titles, not 500 quality-approved titles.

## Reproduce

Use Node 24, `npm ci`, then `npm run verify:candidate:native`. This runs the Docker source audit block, prepares assets and starts only isolated local servers/databases. Use `tools/qa-mobile-hub.js` and `tools/qa-87-browser.js` with an authenticated reviewer storage state for browser evidence; no real scores or purchases are submitted.

Runtime support reference: https://nodejs.org/en/about/eol
Webhook ordering/retry reference: https://docs.stripe.com/webhooks
