# Zero-cost release verification path

**Policy:** no new spending, no plan upgrades, no paid hosting, no live payment setup, no production deployment without separate owner approval.

This checklist is deliberately conservative. A test that has not actually executed must remain NOT RUN; a source review is not a passing test.

## Current confirmed constraints

- GitHub Free included Actions allowance was shown as 2,000 / 2,000 minutes used for October 2026.
- The account Actions budget was shown as $0 with **Stop usage: Yes**.
- The owner has chosen to keep incremental spending at $0.
- Recent workflow attempts failed before their first step and did not assign a runner. This is consistent with a usage restriction, but the billing screenshots do not expose GitHub's internal dispatch error.
- Do not change the budget, spending limit, payment method, subscription, or plan as part of this workflow.
- Do not repeatedly dispatch workflows while the account remains blocked; retries do not provide test evidence.

## What can proceed at $0

1. Review repository code and diffs through the existing GitHub integration.
2. Fix clearly demonstrated source defects on an isolated branch and keep changes in draft PRs.
3. Prepare deterministic test commands, fixtures, regression cases, and a test-results template.
4. Perform source-level checks and record them accurately as source review, not executed runtime tests.
5. Review deployment configuration and prepare a rollback/backup checklist without changing hosting.
6. Inspect game implementations for duplicate mechanics, missing input paths, unsafe score trust, accessibility gaps, and missing asset/license evidence.
7. Use the owner's existing Android device and existing browser to manually inspect the already-deployed public site if it is accessible. This is manual inspection, not proof of the draft branch.

## What cannot be certified without execution/access

- PR branch runtime tests, integration tests, and browser automation.
- Android touch, viewport, audio, performance, and in-app-browser acceptance for the candidate build.
- Candidate build deployment identity, environment variables, persistent disk, backup/restore, and rollback on the host when the host dashboard is inaccessible.
- Real payment-provider approval or live payment/webhook validation.
- Asset provenance/licensing for every game and media file.
- Play Store package signing, policy declarations, review, or publication.

## Ordered verification plan when free runners are available again

Run on the exact PR head SHA and preserve the complete logs/artifacts:

1. Dependency installation from lockfile and all JavaScript syntax checks.
2. Games Library static/catalog/license checks.
3. Unit/integration tests, including cosmetic economy, Stripe mocks, R2 mocks, Bitcoin mocks, and sponsor booking/payment-gate regressions.
4. Full API end-to-end tests against an isolated temporary database.
5. Browser smoke and full page-flow tests with screenshots for desktop and 390x844 mobile.
6. Scale/ranking/anti-cheat tests and final standings immutability checks.
7. Candidate-only deployment to a free, non-production preview if an available host supports the required persistence and secrets without payment. Do not use a free ephemeral database for any real users or prizes.
8. Manual acceptance on the owner's Android phone: sign-up/sign-in, avatar, all games, touch controls, run tokens, leaderboard, official giveaway, booking/payment state, account settings, mobile navigation, reload and session persistence.
9. Security/configuration review, backup and restore proof, deployment SHA confirmation, rollback rehearsal.
10. Separate business/legal approval for prizes, eligibility, privacy, and processor restrictions.

## Release rules

- Do not merge a draft PR solely because CI is unavailable.
- Do not describe any game as AAA or launch-approved without current-build playtest evidence.
- Do not run paid prize competitions until the official event payment/authorization gate, winner verification, applicable rules, and provider/legal requirements have been reviewed.
- Keep live checkout disabled unless the provider has approved the exact business model in writing and test-mode release gates pass.
- Keep production untouched until the exact candidate SHA, backup/restore, rollback, and owner acceptance are recorded.
- A public launch remains BLOCKED while critical tests are NOT RUN or known gameplay defects remain unresolved.
