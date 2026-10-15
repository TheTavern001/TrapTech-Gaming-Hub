# Existing Deplexo app — R1 restricted owner-review deployment

**Status:** Candidate prepared; no deployment made or approved by this document. Never confuse GitHub commits with a running release.

## Scope and environment

The existing single application is at `https://glassy-drifter-9532.de.deplexo.com` (dashboard app `20e0c3e0-87bf-4d2f-8c25-5e41401a5121`). Do not create another site and do not turn on unattended auto deployment during the first R1 test.

Before building, verify (in Deplexo, not from GitHub) which repository and branch are configured, persistent volume destination, and the existing image fingerprint. Preserve the currently working image as rollback material. The last screenshot **historically** indicated `278af07` and is not proof of the current running image.

The GitHub source for owner testing must be a frozen R1 candidate SHA, not a moving PR. Check its exact commit against the deployment logs.

### Required private-review environment

- `HUB_PRIVATE_REVIEW=1`
- `HUB_PREVIEW_USERNAMES=` a comma-separated list of **existing** player accounts that the owner controls. At least one real account is required; verify its ability to sign in first, or review will fail closed. Do not treat the secret admin path alone as a valid player login: its 2FA cookie is intentionally scoped to that path.
- Keep existing `ADMIN_PATH` (secret random slug of 16–128 characters), `ADMIN_PASSWORD`, and `SECRET`/derived session secrets intact. **Never share their actual values in a screenshot or chat.**
- Existing persistent `DATA_DIR=/data` / `DB_PATH` must point to the old database, not a fresh empty database.
- Keep Stripe/Bitcoin secrets as previously configured, but `checkoutState()` forces new purchases OFF while `HUB_PRIVATE_REVIEW=1` even if the admin toggle was on. Stripe webhooks still receive and validate signed events for prior orders.
- No official giveaways, paid checkout, or prestige sales are approved based on this private review. Server-side booking payment + game certification gates remain in effect.

### Safeguarded first release

1. Confirm a recoverable off-host copy/restore plan for the **current** live SQLite database before replacing an image. The image contains a consistent pre-migration backup hook under `/data/pre-release-backups`, but an in-volume snapshot alone does not protect against volume loss.
2. With automatic deploy **OFF**, configure exactly the frozen candidate source and do **one supervised manual deployment** on the existing Deplexo app. GitHub PR #29 remains DRAFT/unmerged; do not interpret PR status as deployed.
3. Review actual Docker prelaunch test output, especially PWA icons, 87-game structural inventory, wallet contracts, booking winner rules, owner preview security, and native `better-sqlite3` snapshot test. Failure means do not replace the existing image.
4. Observe runtime logs: look for `[pre-release-backup]` success (or fresh-install status **only** when no prior data existed), then server listening and healthy status. A corrupt backup or insufficient disk must block startup.
5. Verify the exact `/api/build` fingerprint, 87 proposed-playable catalog counts, and a 200 `/healthz`. Report the full **build fingerprint** rather than assuming the Git SHA equals the running image.
6. From an unauthenticated phone/browser, `/`, `/games`, all paid booking and score APIs must be denied for non-reviewers; `/signin`, `/api/me`, and static assets must work. Existing authorized Hub-account login then permits the owner's gameplay/UI review.
7. In the owner session: review Android and iOS home/PWA install branding, settings, avatar editor, wardrobe and Credits wallet, shop (purchases disabled), game navigation, every title's touch/fps/score proof, booking quote flow, unpaid booking lock, and clear leaderboard winner/tie rules.
8. Failures: record exact commit + running fingerprint + logs; disable new traffic/stop the candidate and restore the prior image and **compatible database snapshot if necessary**. Never assume a code rollback reverses SQLite schema/data migrations.
9. Once fully tested, owner can separately approve broader availability. Clear private review only after security, official event gates, payment processing and game scores are certified; public launch is a different decision.

### Source/test evidence vs actual host

The source-level V8 regressions for owner access and checkout lock pass. The Docker build, native database backup integrity tests, runtime accessibility, phone controls and full load tests are not yet executed by this assistant. No external tool currently exposes the private Deplexo app configuration. The user must inspect or share non-secret dashboard state before the first deployment decision can be verified.
