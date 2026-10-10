# V1 Launch Lock — The Gaming Hub

Status: launch requirements and implementation gate. This document does not itself deploy code or reset production data.

## Product versioning
- The public-facing product name remains **The Gaming Hub by Trap Tech Solutions**.
- All player-facing version labels, season labels, help text, footer/build metadata, admin screens and release notes must consistently identify the launch baseline as **V1**. Do not expose internal branch names such as v7-wip as the public product version.
- Keep internal engineering versioning separate from the public V1 product label.
- V1 means the launch baseline, not a promise that every third-party game has verified competitive scoring.

## Launch season reset
- Launch with a single, clearly labeled **Season 1 — V1 Launch Season** and an authoritative server-side start/end schedule.
- Do not let a pre-launch season or test progress bleed into launch standings. Preserve the production database and audit history; do not delete accounts or permanently erase records as a shortcut.
- Before public launch, run a reviewed, backed-up migration that archives test/pre-launch season state and initializes launch season progress according to an explicit reset policy. Do not run this reset automatically on every app boot or redeploy.
- Preserve account identity, lifetime achievements, moderation/security records, and audit logs. Reset only the season-scoped progress and standings that are explicitly in scope.
- The code currently defines Season 1 as starting 2026-10-01 and seasons as 56 days; if the actual V1 public launch differs, adjust the schedule through a tested migration/configuration rather than silently relabeling historical data.
- Smoke-test rollover, archived results, leaderboard snapshot, top-10 hall of fame and Champion title before opening public competition.

## Founder / owner account recognition
- The owner account must have a unique, visible **FOUNDER** identity badge/title (with an owner-only visual treatment) on the profile and beside the username in supported leaderboards/community surfaces.
- This is a platform identity marker, not a score multiplier, moderation bypass or giveaway advantage. It must not change rank, XP, achievement criteria, eligibility or prize outcomes.
- Assign it server-side to the actual Hub account using a stable internal user ID after account verification. Do not infer ownership from a display name, GitHub handle, client request, query parameter or local storage.
- Keep owner identity separate from admin/moderator permission. The badge itself grants no permissions. Permission continues to be enforced by the existing server-side role system.
- Before release, verify the owner's exact Hub account ID and apply the badge via a reviewed migration/admin operation. Do not guess the account based on the repository owner.

## Unified Hub identity
- One stable Hub user ID owns cross-game stats, accepted runs, achievements, XP, profile cosmetics, personal bests and historical competition placements.
- Library-game runs must feed the same accepted-run and achievement pipeline as core catalog games where the game integration provides sufficient validated evidence.
- External games without a permitted, trustworthy score integration remain one-click casual play and are labeled honestly; their client-reported scores must not be treated as verified or prize-eligible.
- Achievement awards and XP must be server-evaluated, idempotent and tied to accepted run evidence. Username changes must not orphan progress.

## Game launch and competitions
- Games should launch in one click and work on mobile where technically supported.
- Classify every game by launch mode, provider, rights/license, score evidence, validation tier, mobile test status and official-event eligibility.
- Default unreviewed games to casual-only. Only games whose scoring and event flow have been tested may be enabled in official prize competitions.
- Trap Tech / authorized Hub operators exclusively create and manage official giveaways. Vendors and ordinary players may share official Hub links but cannot independently create a competing giveaway through a game URL.
- Each official competition publishes its game(s), time window, scoring aggregation, minimum score, tie-break order, playoff rules and finalization state. Final standings are server-calculated and locked.

## Storage and delivery
- Keep game assets served from the current Hub origin until a configured object-storage/CDN migration is tested end to end. Cloudflare R2 is a candidate for large assets, not a replacement for the application server, identity, scoring API or persistent database.
- Do not move third-party game assets to R2 without redistribution rights. Keep signed run/session requests and score submission on the trusted Hub backend.

## Required V1 release gates
- [ ] Confirm the production host is deploying the intended GitHub repository and main branch / approved release commit.
- [ ] Confirm production health check, persistent database volume, secrets, canonical URL and rollback path.
- [ ] Verify public version labels consistently say V1.
- [ ] Back up production DB and perform the reviewed launch-season initialization exactly once.
- [ ] Verify the actual owner Hub account ID, then grant the FOUNDER badge server-side.
- [ ] Verify login, profile, achievement unlock, XP, season progression and profile persistence across multiple games.
- [ ] Test official giveaway creation, play, accepted score, deterministic ranking, tie resolution and locked final results end to end.
- [ ] Confirm unverified games are not prize-eligible and forged/replayed submissions are rejected.
- [ ] Test desktop and mobile navigation, all game launch modes, error states, and performance.
- [ ] Open the deployed site and verify its build/commit marker before sharing it as the V1 test release.

## Current status
Static integrity and browser smoke workflows have passed for the tested paths, including main Hub/library mobile navigation and the two original library games. These checks are not proof that the public host has deployed the latest commit, that every catalog game is verified, or that a production season reset/owner badge has been applied. This checklist must be completed against the actual host and production database before calling the site a finished V1 launch.