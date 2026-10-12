# Release Readiness, Rotating Quests, and Cosmetic Art Acceptance

**Snapshot date:** 2026-10-12  
**Decision:** NOT APPROVED FOR PUBLIC LAUNCH. This ledger defines executable checks and evidence required; it does not mark unrun checks as passed.

## Release invariants

- Free play remains continuously available. Paid items are cosmetic/profile-only and never affect score, game difficulty, event entry, eligibility, or tie-breaks.
- Public game URLs never create official giveaways, entrant lists, bookings, or prize records. Only authorized Hub-managed, payment-confirmed/comped bookings can activate official events.
- The server is authoritative for XP, quest progress, achievement unlocks, ownership, rotation, score acceptance, and event eligibility. A client-supplied completion or reward claim is never trusted.
- The owner/staff identity is server-authorized. No cosmetic, achievement, profile label, or user-editable field can grant or imply staff/founder authority.
- No live payment processing is enabled until the exact business model and competition/prize mechanics are approved in writing by the selected provider. A successful mocked payment test is not provider approval.
- Never deploy a candidate over the live instance until a recoverable database backup and rollback target are confirmed.

## Workstreams and stop-ship acceptance

### 1. Exact-candidate application checks

- [ ] Record the exact commit SHA being tested and the version/build fingerprint returned by the app.
- [ ] Run the repository's fresh-database API suites, anti-cheat, events, tie-breaks, sponsor/brand, mocked payments, avatar, timer, economy, admin, admin-security, admin-tour, Games Library, i18n, browser, and mobile suites.
- [ ] Run `node tools/verify-prelaunch.js` and `node tools/prelaunch-deep-audit.js`; save the generated JSON report and review every blocker rather than only checking the process exit code.
- [ ] Run the production Docker build locally. A clean source parse is not a substitute for module loading, database migrations, server startup, HTTP tests, or a browser session.
- [ ] Verify API negative cases: forged score, replayed run/event token, cross-user object access, repeated claim, duplicate payment webhook/transaction, stale rotation purchase, concurrent purchase of one-of-one item, refunded/revoked item reissue, unpaid booking activation, and permission escalation.
- [ ] Repeat migration checks against a copy of the prior production database; confirm user accounts, run history, achievements, cosmetics, bookings, event entries, and ownership remain intact.

### 2. Browser, mobile, and gameplay acceptance

- [ ] Test the full public flow: age gate, signup/sign-in/sign-out, password recovery, profile, avatar editor, cosmetic preview/equip, achievements, quests, XP, season/leaderboards, game search/category filters, launch/restart/pause/resume/game-over, and support/legal links.
- [ ] Test booking and official-event flow with operator and ordinary-user accounts, including unpaid, paid, comped, refunded, expired, and revoked states.
- [ ] Test every registered game on desktop and a real Android phone; include keyboard, mouse, touch, orientation, safe areas, browser back, background/resume, low-memory reload, denied localStorage, reduced motion, muted audio, and offline/slow-network failure.
- [ ] Save screenshots/video, device/browser/viewport, exact build SHA, reproducible steps, defect ID, and pass/fail for every game and Hub screen. Do not label a game AAA-ready on source checks alone.
- [ ] Audit the known overlapping mechanics clusters (Moto Lanes / Throttle Rider / Lane Racer; Rail Rush / Ruin Runner; Gem Rush / Strain Crush; Sky Flap / Hoop Flap; Bat Boy / Long Ball) and document whether each pair is intentionally differentiated enough in mechanics, not just skin/theme.
- [ ] Profile startup, frame-time, memory, input latency, layout shifts, asset loading, and long-session stability. Fix or disable titles with repeatable P0/P1 defects before public release.

### 3. Cosmetic catalog and art asset acceptance

The 1,200-item universe is catalog metadata, not proof that 1,200 finished, unique pieces of art exist. The target is an individual, legible, enticing thumbnail for every sellable cosmetic and profile item.

- [ ] Export a machine-readable manifest containing stable item ID, display name, category, rarity, rotation, thumbnail path, full-size preview path, ownership/equip slot, and rights/source status.
- [ ] Ensure every catalog item has a thumbnail at the expected path, correct aspect ratio, safe margins, useful silhouette at small card sizes, and an identifiable visual difference from neighboring items.
- [ ] Generate or author art from original designs or commercially cleared sources only. No scraped game assets, trademarked characters, unlicensed fonts, or remote third-party images that can disappear at runtime.
- [ ] Add an automated asset audit that checks missing files, duplicate hashes, empty/invalid SVG/JSON, malformed raster files, broken references, oversized files, remote dependencies, embedded scripts, and unsafe SVG content.
- [ ] Produce contact sheets grouped by category/rarity and visually inspect them at actual shop-card size on desktop and phone. A unique filename or generated hue alone does not count as unique art.
- [ ] Verify lazy loading, responsive sizes, caching/version invalidation, alt text, loading/error fallbacks, and that each item detail view shows the same art as the shop card and avatar equip preview.
- [ ] Give each of the 12 Prestige originals its own finished, clearly distinguishable hero render, thumbnail, 2D avatar treatment, 3D preview/effect, and ownership/supply label. Keep sales disabled until compatibility and legal review pass.

### 4. Deep achievements and rotating quest economy

Existing achievements and the 48-quest Season Pass chain are separate systems. They do not by themselves satisfy a several-thousand-entry, continuously rotating quest library.

- [ ] Implement a versioned quest-template library with several thousand deterministic, unique quest definitions generated from curated objectives, supported game mechanics, difficulty tiers, time windows, and reward tiers.
- [ ] Generate per-user daily/weekly/season/event rotations deterministically from a server secret plus stable user/period inputs. Store assigned quest IDs and generation version so restarts, retries, clock changes, or deployment do not reroll a player's objectives.
- [ ] Use a finite validated objective vocabulary (honest completed runs, score thresholds, distinct games, play days, streaks, verified social actions, tournament placements, and season progress). Do not create objectives for telemetry the server cannot reliably verify.
- [ ] Each quest needs a stable ID, category, tier, prerequisites, objective parameters, progress rule, start/end timestamps, expiry behavior, repeat policy, XP value, reward pool, and accessibility-friendly description. Never reuse an ID for a changed definition.
- [ ] Calculate progress only from accepted server-side events and exclude held, invalid, replayed, or later-revoked runs. Deduplicate event processing and reward claims transactionally.
- [ ] Award XP idempotently; keep paid purchases from increasing quest XP, challenge strength, scores, eligibility, or reward odds. Avoid pay-to-win boosts and keep a free progression route.
- [ ] Rare accessories should be earned through disclosed, achievable quest milestones or transparent deterministic reward tracks. Publish rarity/odds where randomized rewards exist; use pity protection or guaranteed milestones to prevent impossible streaks; never require a purchase to claim an earned reward.
- [ ] Prevent impossible, mutually exclusive, stale, or exploitably easy quest combinations. Simulate player cohorts and completion rates across new/casual/regular/skilled players before shipping reward values.
- [ ] Add tests for midnight/week/season boundaries, DST, concurrent progress, duplicate event delivery, expired quest claims, user isolation, server restart, migration, reward inventory exhaustion, and abuse through repeated low-cost actions.
- [ ] Keep permanent achievements permanent; keep rotating quests clearly labeled with reset time and what happens to unfinished progress.

### 5. Security, privacy, legal, and operational readiness

- [ ] Confirm every privileged route uses server-side authorization, CSRF protection where applicable, rate limits, safe session cookies, input validation, and audit logging without leaking secrets or personal account traces.
- [ ] Check that official Trap Tech identity/channel links are canonical and scam warnings are visible; users cannot create official-looking staff badges or bypass the 30-day affiliation cooldown.
- [ ] Complete asset-license review and legal/provider review for contests, prizes, age restrictions, privacy policy, terms, refunds, and any jurisdiction-specific rules.
- [ ] Verify production secrets are present only in hosting settings, admin URL is private, owner recovery is tested, logs do not expose credentials, and database/backups are access-controlled.
- [ ] Restore a backup to an isolated instance and prove rollback steps work before deploying.
- [ ] After the single planned deployment, verify the deployed SHA/build fingerprint, `/healthz`, `/api/build`, homepage assets, authentication, persistence after restart, game launch/score submission, booking visibility/authorization, admin access control, and payment gates. Save evidence and monitor errors.

## Release decision rule

Public launch remains blocked while any security/payment/event-integrity P0/P1, data-loss, broken critical flow, unresolved asset-rights issue, or required human visual/gameplay acceptance remains open. If a title fails, fix and retest it or explicitly remove/disable it from the public catalog; do not convert an unknown status into a pass.

## Evidence ledger

For each run, attach: commit SHA, command or manual test, environment, timestamp, result, pass/fail count, log/report path, defect links, and reviewer. Record source/static checks separately from runtime/API/browser/device/human-art-review results.

## Branch work recorded on 2026-10-12

- Added a deterministic generated SVG thumbnail renderer for all six generated cosmetic types: banner, frame, color, title, badge, and effect.
- Expanded `/shop/art/:id.svg` from banner/badge-only responses to all generated cosmetic types, with an SVG content type and `nosniff`.
- Added API regression assertions that each type can be discovered and its art endpoint returns SVG.
- These changes are committed on `audit/release-readiness-and-assets`; the API suite and browser/device checks have **not** been executed against this branch in this session. Treat the new route as implemented but not yet runtime-verified until the tests run and the shop thumbnails are visually inspected.
