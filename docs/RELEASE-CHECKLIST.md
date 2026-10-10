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

- [x] Registry, catalog, and documentation reconcile at 100 entries.
- [x] No external game redirects are configured in the library registry.
- [x] Add original Neon Circuit and Rift Survival implementations and SVG cover art.
- [x] Apply L3 score-event validation to both new originals, including per-game point-value rules and progress-marker exclusion.
- [x] Add game-specific skill tie-break metrics for energy cells and rift shards.
- [x] Add static CI checks for JavaScript syntax and registry/catalog/docs/local-asset consistency.
- [ ] Browser-test both new games: title/start, controls, scoring, game-over, retry, score submission, mobile touch, and console errors. A new GitHub Actions browser workflow now performs this smoke test, but it has not yet completed successfully.
- [ ] Run existing E2E checks for the full library and verify forged-score rejection.
- [ ] Verify game licenses and assets independently; do not equate a catalog flag with legal or competition approval.
- [ ] Profile Desert Dash, Rail Rush, Lane Racer, and Moto Lanes on the intended phone; capture reproducible frame-time data.
- [ ] Confirm thumbnails and cards visually, including missing-image fallback.

## Release gates

- [x] Static CI passed on earlier branch revisions; each new commit must pass its own checks.
- [ ] Latest commit CI is green.
- [ ] Browser/E2E results are green for the release candidate.
- [ ] Mobile smoke test completed.
- [ ] Booking/event permission regression completed.
- [ ] Deployment URL is reachable and all intended new games can be launched from the Hub.
- [ ] No merge or production deployment until the release gates above are reviewed.

## Current boundary

This branch is based on `v7-wip` and preserves its Hub application files. The current edits add to the Hub navigation/library experience; they do not replace the rest of the Hub. Static checks cannot substitute for the browser, mobile, booking-permission, or anti-cheat checks above.
