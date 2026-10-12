# Owner prelaunch test — current release gate

This is the safe path to validate the current work without spending GitHub Actions minutes or exposing an unverified build to the public.

## Current status — not deployment-ready

- The latest four GitHub Actions workflows failed before their first test step ran. The runner/job records expose no executed steps and no retrievable logs. This is an infrastructure/orchestration failure of unknown cause, **not evidence that the application tests passed or failed**.
- A parser-only V8 syntax check passed for 14 changed JavaScript files on the current candidate. Import/export statements were stripped for that check; it is not equivalent to native Node syntax validation, module resolution, runtime tests, or API/browser tests.
- The current payment-gate/avatar branch is `fix/payment-required-event`, head `3a0915c8397e72be5ac0e1ddc3ad486c1cf27214` at the time this status was recorded. PR #8 is a draft and targets `games/deep-distinctness-audit`, **not `main`**.
- Branches have diverged materially. Do not retarget or merge PR #8 blindly.
- All 100 games remain NOT SIGNED OFF for human visual/gameplay quality and asset rights. No AAA quality or production readiness is certified.

## Existing live deployment

Deployment dashboard: https://deplexo.com/apps/20e0c3e0-87bf-4d2f-8c25-5e41401a5121

Known app URL: https://glassy-drifter-9532.de.deplexo.com

The deployed commit and live health could not be verified from this environment. Do not assume the live site contains the candidate. Do not switch its production branch to the draft branch merely to test it; that can replace the public app and risk the persistent database.

## Zero-cost validation without GitHub Actions

1. **Keep the release candidate isolated.** Do not merge the draft PR or change production payment settings while test execution is unavailable.
2. **Use a non-production runtime.** The safest path is a separate private preview with its own persistent database and dummy secrets. The currently documented Deplexo free tier allows one project, so if the existing app occupies that slot, do not overwrite it to create a preview. A second host or an owner-created separate preview project is required for true staging.
3. **Run the exact source in a normal Node 20 environment without Actions.** From a clean checkout of the candidate branch, install with `npm ci`, then run:
   - `node tools/v1-checklist-test.js`
   - `tools/fresh-api.sh tools/e2e-sponsor-brands.js`
   - `tools/fresh-api.sh tools/e2e-avatars.js`
   - `tools/fresh-api.sh tools/e2e-games-lib.js`
   - `tools/fresh-api.sh tools/e2e-browser.js`
   - `tools/fresh-api.sh tools/e2e-hub-library.js`
   - `npm test` and `npm run test:browser`
   
   Use only throwaway test data and test-only environment secrets. Do not point these tests at the production database. Some scripts may require Playwright/browser dependencies; install only from the committed lockfile and record any environment-specific failures separately from product failures.
4. **Build the production container without deploying it:** `docker build -t gaming-hub:candidate .`. Then smoke-test the image locally with a disposable named volume, a test-only `ADMIN_PASSWORD`, a long random `SECRET`, a private random `ADMIN_PATH`, and port 8787. Do not reuse production secrets or database.
5. **If Docker/Node are not available locally:** a no-cost hosting build can be used only in a separate preview app. Deplexo supports private Git repositories, Dockerfile builds and dashboard-managed runtime secrets; a push triggers deployment only if the app is connected to that repository/branch and automatic deployment is enabled. Confirm the deployment's commit and logs before testing.
6. **Verify the deployed preview:** `/healthz` returns `{"ok":true}`; sign-up/sign-in works; a game can launch, submit a server-validated score, and appear on the leaderboard; avatar looks persist after reload; booking/giveaway endpoints reject unpaid or mismatched events; and data survives restart. Confirm the persistent volume is mounted at `/data`.

## Android owner playtest

Once a private preview of the exact candidate is available:

1. Sign up with a disposable test account, not the only owner account.
2. Test at least five game genres: start, pause if supported, restart, game over, return to Hub, and score submission.
3. Test touch controls and landscape rotation where supported.
4. In Avatar Studio, change body/build, face/skin/hair, outfit, headwear, accessory, held prop and background; save, reload and verify persistence.
5. Check profile, achievements, quests, season pass, store and giveaways. Free games must remain playable without purchases.
6. Confirm paid items are cosmetic/profile-only; no paid XP multiplier, score boost, extra attempt, extra entry or easier eligibility.
7. Keep Stripe disabled unless the provider has approved the exact business model in writing. Do not make real purchases during QA.
8. Attempt expected-denial cases: forged score, replayed submission, browser-edited product price, guessed admin URL, and incomplete required giveaway checklist. Server-side validation must reject unauthorized changes.
9. Record each issue with game, device/browser, steps, expected/actual result and screenshot/video. A score/eligibility exploit, crash or game-breaking control bug blocks that game from release.

## Release blockers

- Reproducible runtime/API tests and browser tests on the exact release candidate.
- Safe integration to `main` after branch differences are reconciled; PR #8 must not be merged or retargeted blindly.
- A private preview deployment and verified commit/health/persistence.
- End-to-end booking/payment/giveaway permissions, event-reference validation, score anti-forgery and replay rejection.
- Android and desktop visual QA, especially avatar rendering and the game catalog.
- Per-game asset/license review and human quality sign-off; catalog path presence or automated smoke tests do not establish rights or AAA quality.
- Production database backup, environment-variable audit, recovery/rollback plan, and deployed-SHA verification.

## Owner-side access needed

To complete the final hosting step, the owner must have access to the Deplexo dashboard (or another zero-cost host) and the connected Git provider. If a separate preview cannot be created on the free plan, provide a preview project/host rather than switching the existing production app to an unverified branch. Never paste passwords, API keys, webhook secrets, Cloudflare secret keys, or wallet seed phrases into chat or source files.
