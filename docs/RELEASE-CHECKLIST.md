# Release Checklist — Hub + Games Library

This checklist deliberately covers the main Hub application as well as the Games Library. The feature work already present on `v7-wip` must not be lost while merging the library rebuild.

## Hub shell and navigation

- [x] Keep the current `v7-wip` base as the pull request target; do not replace the Hub shell with a standalone game-only site.
- [x] Keep the main `/games` route and add a working entry point to `/games-lib/index.html`.
- [x] Replace the stale hard-coded “150+ more games” label with a count fetched from `/api/games-lib`.
- [x] Add a new-game spotlight, category/status filters, search, and result counts on the dedicated library page.
- [x] Load the library registry into the main Hub's route state so official giveaway links can resolve library game IDs.
- [x] Route `/play/<library-game-id>?event=...` launches into the corresponding library game while preserving query parameters.
- [x] Forward `event`, `event_code`, `giveaway_id`, and legacy `giveaway` query parameters through the library adapter to server-side run validation.
- [x] Include only Neon Circuit and Rift Survival in the admin giveaway builder's library-game options, rather than enabling all 100 unverified library entries.
- [ ] Browser-test the full official event flow end to end for a library game; source wiring alone is not proof of a working event.
- [ ] Visually inspect the main Hub at phone and desktop widths after deployment.
- [ ] Verify auth, navigation, leaderboard, profile, bookings, giveaways, admin, and mobile layout remain intact after the release.

## Official giveaway / booking boundary

- [ ] Regression-test the booking request flow and admin booking status transitions.
- [ ] Verify that only authorized, valid Hub event/giveaway records can create official competition entries and score submissions; test missing, invalid, expired, and mismatched event references.
- [x] Restrict the admin giveaway builder's new library-game options to the two original titles, Neon Circuit and Rift Survival; other library entries remain excluded from this new-game addition.
- [ ] Verify the builder's rendered game picker and publish flow for both originals in a real browser. The new originals still require browser test results before production giveaway use.
- [ ] Verify vendor/host permissions: vendors must not be able to create or activate an official giveaway or playoff without the required operator/admin authorization and booking approval.
- [ ] Verify a normal shareable game URL permits casual play but does not by itself create an official giveaway, prize, paid booking, or official entrant list.
- [ ] Verify leaderboards and winner selection consume server-validated score/run records, not a client-side displayed score.
- [ ] Confirm the booking fee and approval state are represented in the real booking/business workflow, not only in page copy.
- [ ] Document the limitation: software cannot prevent a vendor from informally sharing a public game link or independently claiming to run a private contest elsewhere. It can prevent Hub-managed official events, scoring, entrants, and winner selection from being authorized through an invalid Hub flow.

## Games Library

- [x] Registry, catalog, and documentation reconcile at 80 active Games Library entries.
- [x] No external game redirects are configured in the library registry.
- [x] Add original Neon Circuit and Rift Survival implementations and SVG cover art.
- [x] Apply L3 score-event validation to both new originals, including per-game point-value rules and progress-marker exclusion.
- [x] Add game-specific skill tie-break metrics for energy cells and rift shards.
- [x] Add static CI checks for JavaScript syntax and registry/catalog/docs/local-asset consistency.
- [x] Automated browser smoke tests passed for both new originals on desktop and iPhone-sized viewports on commit `303570b`; the main Hub/Games Library mobile navigation test also passed. This is smoke coverage, not exhaustive gameplay, anti-cheat, physical-device performance, or full score-submission certification.
- [ ] Run existing E2E checks for the full library and verify forged-score rejection.
- [ ] Verify game licenses and assets independently; do not equate a catalog flag with legal or competition approval.
- [ ] Profile Desert Dash, Rail Rush, Lane Racer, and Moto Lanes on the intended phone; capture reproducible frame-time data.
- [ ] Confirm thumbnails and cards visually, including missing-image fallback.

## Release gates

- [x] Static CI passed on earlier branch revisions; each new commit must pass its own checks.
- [x] Latest verified static-check and browser-smoke workflows are green on commit `303570b` (2026-10-10).
- [ ] Full API E2E suite, official-event end-to-end path, and forged/replayed score rejection are green for the release candidate.
- [ ] Mobile smoke test completed.
- [ ] Booking/event permission regression completed.
- [ ] Deployment URL is reachable and all intended new games can be launched from the Hub.
- [ ] No merge or production deployment until the release gates above are reviewed.

## Current boundary

This branch is based on `v7-wip` and preserves its Hub application files. The current edits add to the Hub navigation/library experience; they do not replace the rest of the Hub. Static checks cannot substitute for the browser, mobile, booking-permission, or anti-cheat checks above.


## Verified CI update — 2026-10-10

- Static workflow: passed on `303570b`: JavaScript syntax, inline library-page JavaScript, registry/catalog/docs consistency, and local asset checks.
- Browser workflow: passed on `303570b`: main Hub and Games Library navigation at a mobile viewport; Neon Circuit and Rift Survival smoke tests at desktop and iPhone-sized viewports; performance-risk diagnostic completed as a non-blocking step.
- These workflows run against an isolated CI database and local test server. They do not verify Deplexo's deployed commit, persistent production storage, all catalog games, payment processing, or the complete official giveaway flow.


## Consolidated release candidate update — 2026-10-11

This repository's current `main` contains the Hub v7 work, the Games Library integrity-audit integration, and the responsive homepage redesign. It is the candidate to prepare for a single final Deplexo deployment. The older statement above that the current edits are still an unmerged branch is historical context and is superseded by this update.

- [x] Main Hub retained; the library is integrated rather than replacing the app.
- [x] Homepage redesign committed on `main` (`c98dc18935232b8c71e6cc0fce1a6512d22608b9`).
- [x] Catalog and registry reconcile at 80 active Games Library entries; long-term release target is 500 distinct, launch-ready games, added only after the baseline passes.
- [x] New library integration limits the new-game giveaway-picker additions to Neon Circuit and Rift Survival.
- [ ] Confirm blocking CI workflows finish green on the exact finalization commit.
- [ ] Full official-event flow for a library game, including invalid/expired/mismatched event references and replay/forged-score rejection.
- [ ] Browser regression for booking status, operator/vendor permissions, giveaway publishing, winner selection, and the rest of the core Hub.
- [ ] Fresh phone and desktop review of the live homepage and navigation.
- [ ] Real-device performance, art quality, and licensing reviews for the games that remain unverified.
- [ ] Back up production data, deploy the latest `main` SHA once, and verify health, persistence, player flows, event controls, and admin access on the live URL.

**Do not interpret “100 catalog entries” as “100 verified giveaway-ready games.”** The user-facing requirement is one consolidated release; the responsible release gate still requires documenting unresolved verification items rather than hiding them. The vendor control boundary is official Hub-managed events and score records: public casual game links can be shared, but a link alone must never authorize a Hub giveaway, paid booking, official entrant list, or winner selection.


## Current master tracker (2026-10-12)

Use [docs/HUB-MASTER-CHECKLIST.md](HUB-MASTER-CHECKLIST.md) as the project-wide source-of-truth index for all requirements, subsystem status, test gates, evidence locations, and deployment history. This file retains detailed release-specific checks; when the two appear inconsistent, reconcile both against the current source and record the correction rather than relying on historical notes.

- [x] Root cause for the `bb2346e` Deplexo build failure identified from the supplied build log: the deep audit incorrectly rejected a valid static manifest icon because its URL was not hard-coded in `src/server.js`.
- [x] Audit logic corrected in `ea454f93a05ecf715d880d880e42228327f0a7b6` to accept a manifest icon when either a server route is declared or the corresponding file exists under `public/`.
- [ ] Verify Deplexo build reaches READY on the fix commit or later.
- [ ] Verify live `/healthz`, `/api/build`, and `/api/audit/report` on the exact deployed build.
