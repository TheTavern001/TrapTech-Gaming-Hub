# Release Checklist — Hub + Games Library

## Current one-deployment release candidate (2026-10-11)

Candidate branch: `release/consolidated-v1`; PR [#2](https://github.com/TheTavern001/gaming-hub-2/pull/2). Keep production unchanged until the final candidate is approved. Feature work may create multiple commits and run CI, but must result in one merged release and one production deployment.

- [x] Make `/games` one unified 150-entry catalog with search and category filtering; remove the separate core-game section.
- [x] Add a synchronized weekly rotating catalog spotlight on the homepage, changing every Monday UTC.
- [x] Add a shared responsive visual system to the main app shell and major reusable UI surfaces.
- [x] Add CI coverage for main-screen catalog presence/search/filter (candidate CI must pass).
- [x] Reach 150 registered catalog entries. This is a catalog-count milestone only, not proof that all entries are playable, competition-safe, or license-cleared.
- [ ] Validate 150+ genuinely testable games through runtime, score-acceptance, mobile, anti-cheat, and licensing checks. Current registry has 150 entries; test completion and certification remain open.
- [ ] Launch-test every listed game and classify failures, mobile support, external dependencies, score integration and licensing status.
- [ ] Verify official event permissions, server-validated scores, anti-cheat and tie-break rules for any game promoted as competition-eligible.
- [ ] Complete desktop and mobile visual regression across home, library, game player, auth, profiles, leaderboards, quests, tournaments, giveaways, bookings, vendor pages, store, settings and admin tools.
- [ ] Verify production Deplexo deploy branch, config, health, auth, live catalog, data persistence and rollback plan.
- [ ] Merge the approved candidate and deploy exactly once; verify the merged SHA is the deployed SHA before asking the user to review.


This checklist deliberately covers the main Hub application as well as the Games Library. The feature work already present on `v7-wip` must not be lost while merging the library rebuild.


## User-approved design corrections — blocking

- [ ] Customer-facing booking is named **Book a Giveaway** throughout; remove the misleading **Sponsor a Host** framing and explain that Trap Tech creates/manages the official giveaway.
- [ ] Giveaway team selection must clearly distinguish a Hub team affiliation from connecting the user's own external channel. Team switching is immediate; switching closes active entries in the previous team's members-only giveaways.
- [ ] Avatar Studio must retain the approved collectible player-card direction and provide deep customization; current editor now has 17 categories, but the full visual/profile pass still needs visual verification.
- [ ] **Game art and gameplay are not release-ready merely because the catalog count is 150.** User requires recognizable titles labeled as *Hub Version* when they are independent adaptations, meaningfully different gameplay (not reskinned copies), high-quality visuals, score/leaderboard integration, mobile controls and anti-cheat. The 50-title Arcade Pack currently uses nine shared mechanic families and must be individually redesigned/replaced before it can be treated as finished.
- [ ] Keep production unchanged until the unique-game visual rebuild, full desktop/mobile review, score integrity, licensing and booking/official-event gates are complete.

## Hub shell and navigation

- [x] Keep the current `v7-wip` base as the pull request target; do not replace the Hub shell with a standalone game-only site.
- [x] Keep the main `/games` route and add a working entry point to `/games-lib/index.html`.
- [x] Replace the stale hard-coded “150+ more games” label with a count fetched from `/api/games-lib`.
- [x] Add one unified catalog, weekly rotating homepage feature, category filters, search, and result counts on the dedicated library page.
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
- [x] Automated browser smoke tests passed for both new originals on desktop and iPhone-sized viewports on commit `303570b`; the main Hub/Games Library mobile navigation test also passed. This is smoke coverage, not exhaustive gameplay, anti-cheat, physical-device performance, or full score-submission certification.
- [ ] Run existing E2E checks for the full library and verify forged-score rejection.
- [ ] Verify game licenses and assets independently; do not equate a catalog flag with legal or competition approval.
- [ ] Profile Desert Dash, Rail Rush, Lane Racer, and Moto Lanes on the intended phone; capture reproducible frame-time data.
- [ ] Confirm thumbnails and cards visually, including missing-image fallback.

## Release gates

- [x] Static checks passed on candidate `4e05e90cc8bcec4912d1cd300d518f82733e0b0a`.
- [ ] Browser suite must finish green on the exact final candidate SHA; main Hub navigation, major-screen smoke tests, and the two original games passed on the current run, while the 50-game desktop/iPhone run was still in progress at the last check.
- [ ] Full API E2E suite, official-event end-to-end path for a library game, and forged/replayed score rejection are green for the release candidate.
- [ ] Booking/event permission regression completed.
- [ ] Fresh desktop/mobile visual review completed.
- [ ] Deployment URL is reachable and all intended new games can be launched from the Hub.
- [ ] No merge or production deployment until the release gates above are reviewed.

## Current boundary

This branch is based on `v7-wip` and preserves its Hub application files. The current edits add to the Hub navigation/library experience; they do not replace the rest of the Hub. Static checks cannot substitute for the browser, mobile, booking-permission, or anti-cheat checks above.


## Current candidate validation status — 2026-10-11

- Candidate branch: `release/consolidated-v1`; PR #2 targets `v7-wip` to preserve the existing Hub work.
- Latest static-check workflow passed on `4e05e90cc8bcec4912d1cd300d518f82733e0b0a`.
- Browser run `38102971508` passed main Hub/library navigation, major-screen mobile/desktop smoke tests, and Neon Circuit/Rift Survival. The 50-game Arcade Pack desktop/iPhone gameplay run was still in progress at the last check; no result is claimed until it completes.
- Registry and catalog contain 150 entries. That count is not a claim that all 150 have passed runtime, scoring, anti-cheat, mobile, or licensing review.
- These checks run against an isolated CI database and local server. They do not verify Deplexo's deployed commit, production persistence, or the live admin/player flows.

## Consolidated release boundary

The release must retain the existing Hub application, use one unified catalog with a weekly featured title, and preserve the official-event boundary. Sharing a public game link or playing the weekly featured game must never create an official giveaway, booking, entrant list, or winner selection.

- [ ] Finish browser and gameplay validation for the candidate.
- [ ] Run the full API E2E suite and verify library-game event references, including invalid, expired, mismatched, forged, and replayed submissions.
- [ ] Review event permissions, booking status transitions, vendor/operator roles, publishing, and winner selection.
- [ ] Complete desktop/mobile visual review and asset/licensing review.
- [ ] Verify Deplexo's deployment branch, config, health, auth, persistent storage, backups, and rollback plan.
- [ ] Merge the approved candidate into `v7-wip`, deploy the exact resulting SHA once, and verify the live deployed SHA before asking the user to review.

**Do not merge or deploy while any blocking gate remains open.**
