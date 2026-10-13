# Gaming Hub Master Checklist and Project Source of Truth

**Product:** The Gaming Hub by Trap Tech Solutions  
**Repository:** `TheTavern001/gaming-hub-2`  
**Production candidate:** `main` (the exact deployed commit must be verified from `/api/build`)  
**Primary goal:** Make the existing Hub fully reviewable and testable before public release; then expand toward 500 distinct, launch-ready games.  
**Cost constraint:** $0 additions unless the owner explicitly approves a cost.  
**Last reconciled:** 2026-10-13 (see live release journal; historic sections may be stale)

> This file is the navigation index and durable requirements ledger. It is not proof that a feature works. A checked box means source work or a named check is present; it does not replace live, browser, device, security, legal, or owner acceptance evidence. Update this file and the detailed tracker in the same commit whenever scope or status changes.

## Current evidence checkpoint — 2026-10-13

**Read [the deployment journal](DEPLOYMENT-JOURNAL.md) and run `node tools/release-status.js` before starting another deployment.** The earlier October 12 table below is historical, not the latest live state. Observed Deplexo READY at `8489b41`; a newer Skee Roll candidate `58a9f52` failed and `b7be1ec` was last seen BUILDING 35%. Final Deplexo outcome is **unknown** at this checkpoint. This status is screenshot-evidenced; it must be updated against the next build log and exact current `/api/build` SHA.

**Active baseline:** 13 core + 80 library = 93 titles. To reach 500 active titles requires **407 accepted distinct additions**; research candidates do not count. Import changes must never overwrite license/credits, regress accessibility, or count untested titles as AAA. The canonical machine-readable event history is `docs/audit/DEPLOYMENT-JOURNAL.json`.

## 1. Status vocabulary

- **DONE—SOURCE:** implementation or documentation exists in the current source tree.
- **AUTOMATED:** a named repeatable check exists; record its latest run/commit.
- **NEEDS TEST:** real browser, API, production, desktop, or Android verification remains.
- **BLOCKED:** a known blocker prevents release or verification.
- **OWNER REVIEW:** the owner must visually inspect or approve the result.
- **NOT STARTED:** no implementation/evidence found yet.

Never convert NEEDS TEST to DONE merely because a file exists, the Docker build succeeds, or a page loads.

## 2. Current release situation

- [x] Deplexo receives GitHub commits from `main`.
- [x] Older commit `ab4cdbb` was shown as READY in Deplexo.
- [x] Failed build at `bb2346e` captured the actual failure: `tools/prelaunch-deep-audit.js` reported `missingManifestIconRoutes: 1`, `blockers: 1`, then exited with status 1.
- [x] Root cause identified: the audit treated a manifest icon as missing unless its URL appeared literally in `src/server.js`; valid assets served through the public static-file middleware were incorrectly rejected.
- [x] Corrected audit committed to `main` as `ea454f93a05ecf715d880d880e42228327f0a7b6`; it now accepts either an explicit server route or an existing file under `public/`.
- [ ] Verify the next Deplexo deployment uses `ea454f9` or newer and reaches READY.
- [ ] Confirm `/healthz` returns 200.
- [ ] Confirm `/api/build` reports the same commit/build fingerprint as the intended source.
- [ ] Confirm `/api/audit/report` is available and reports zero structural blockers.
- [ ] If another build fails, record the exact first failing command and complete error in the release log below before changing code.

## 3. Single source of truth and update rules

### Canonical sources

| Area | Source of truth | Required companion evidence |
|---|---|---|
| Core game registry | `src/config.js` | `docs/audit/GAME-QA-TRACKER.md`, per-game QA evidence |
| Games Library registry | `src/games-lib.js` | `public/games-lib/catalog.json`, `docs/GAMES-LIB.md` |
| Server/API and account logic | `src/server.js` plus the imported `src/*.js` module | API regression results and security notes |
| Core game client modules | `public/js/games/*.js` and registered modules in `public/js/` | Core game QA records |
| Games Library implementations | `public/games-lib/<slug>/` | per-game license, visual, gameplay, and device records |
| Avatar system | `src/avatars.js`, `public/js/avatar-editor.js`, `public/js/avatar-3d.js` | avatar matrix, ownership tests, mobile captures |
| Shop/inventory/economy | `src/shop.js`, `src/shop-gen.js`, `src/monetize.js`, related client modules | pagination, rotation, purchase atomicity, ownership tests |
| Brand/giveaway flow | `src/sponsor.js`, giveaway/event modules, settings UI | booking, eligibility, permission, and cooldown regressions |
| Build/release | `Dockerfile`, `.dockerignore`, `package.json`, `package-lock.json`, `deplexo.yaml` if supported by the host | Deplexo build log, exact deployed SHA, endpoint checks |
| Structural audit | `tools/prelaunch-deep-audit.js`, `tools/verify-prelaunch.js`, `tools/games-lib-static-check.js`, `tools/verify-game-syntax.js` | generated `docs/audit/prelaunch-structural-audit.json` |
| Product requirements | This file + `docs/PUBLIC-LAUNCH-500-GAME-AND-AVATAR-SHOP-AUDIT.md` | change log and release checklist |

### Mandatory maintenance protocol

1. Before changing a feature, read this file and the linked detailed tracker for that feature.
2. Change implementation and relevant automated tests together.
3. Update documentation counts/status from the actual source of truth; never hand-maintain conflicting catalog counts.
4. Run the relevant static/audit commands; retain actual output and commit SHA.
5. Update this master checklist and detailed feature tracker in the same commit.
6. Never label an untested feature verified. Mark the exact test needed and evidence location.
7. After every build-related change, inspect the Docker build context and run all build-time checks before adding unrelated features.
8. Keep a concise entry in the release log for each deployment attempt: timestamp, source SHA, result, first error, fix SHA, and verification outcome.

## 4. Product and platform scope

### 4.1 Hub shell, navigation, identity and responsive redesign
- [x] Keep the full Hub shell; the Games Library must remain integrated rather than replace the Hub with a game-only site.
- [x] Homepage redesign stylesheet and canonical Trap Tech twin-T crown branding exist in source.
- [x] App/browser icon references use the canonical Trap Tech artwork.
- [ ] OWNER REVIEW: inspect the entire home screen and all primary sections at phone and desktop widths.
- [ ] NEEDS TEST: navigation, browser history, refresh/deep links, loading/error/empty states, offline/slow-network states.
- [ ] NEEDS TEST: confirm the same logo/brand system is consistent across favicon, PWA icons, splash, profile, game cards, and relevant admin screens.
- [ ] NEEDS TEST: check contrast, readable type, touch targets, safe-area insets, reduced motion, and keyboard access.

### 4.2 Accounts, profile, sessions and security
- [ ] NEEDS TEST: signup, sign-in, sign-out, session persistence, password change, age gate, validation and rate limits.
- [ ] NEEDS TEST: profile/avatar save-load, logout/login persistence, malformed IDs, unknown users, banned accounts and unauthorized API access.
- [ ] NEEDS TEST: no secrets in client assets, logs, audit report, build output, or public API responses.
- [ ] NEEDS TEST: CSRF/origin protections, session cookie flags, rate limits, input validation, safe dynamic HTML and error handling.
- [ ] NEEDS TEST: database backup/restore, schema migration, persistent volume behavior and restart survival on the actual host.

### 4.3 Wallet, points, rewards and economy
- [ ] NEEDS TEST: inspect and document every wallet/points balance, source, earning rule, spending rule, expiry/reset rule, and UI label.
- [ ] NEEDS TEST: test concurrent requests, retries, duplicate grants, insufficient balance, transaction rollback, database restart, and audit logging.
- [ ] NEEDS TEST: ensure points/cosmetics are not presented as cash, investment, or guaranteed prize value.
- [ ] NEEDS TEST: verify daily quests, streaks, achievements, reward claims, leaderboards and notifications are consistent across API and UI.
- [ ] NEEDS TEST: ensure gameplay cosmetics never alter score, physics, hitboxes, competitive advantage, or event eligibility.

### 4.4 Games: core Hub catalog
- [ ] Audit all currently registered core games from `src/config.js`; do not rely on stale fixed counts.
- [ ] NEEDS TEST for every game: launch, loading, controls, mobile touch, keyboard, pause/resume, restart, game over, scoring, score submit, errors, visibility changes and responsive layout.
- [ ] NEEDS TEST: signed-run validation, forged/replayed/invalid score rejection, tie handling, rate limits and server/client score agreement.
- [ ] OWNER REVIEW: each game needs its own polished art direction, readable HUD, distinct mechanics, transitions, sound/impact feedback and no obvious placeholders.
- [ ] NEEDS TEST: real Android performance and desktop performance; capture repeatable P50/P95 frame times, sustained drops, memory/heat and stress behavior.
- [ ] Record evidence and PASS/FIX/REPLACE decisions in `docs/audit/GAME-QA-TRACKER.md`.

### 4.5 Games Library: current baseline and 500-game target
- [x] Current generated inventory is 80 Games Library entries, reconciled against registry/catalog/docs by the structural audit.
- [ ] NEEDS TEST: play all 80 entries; structural checks are not a gameplay or AAA-quality pass.
- [ ] NEEDS TEST: verify every game's license, attribution, code/art/audio/font/model source, redistribution rights and required notices.
- [ ] NEEDS TEST: identify near-duplicate experiences by actual loop, visuals, sounds, controls and level design—not just titles or hashes.
- [ ] NEEDS TEST: broken asset URLs, console errors, loading failures, zoom, orientation, safe areas, touch and game-over state.
- [ ] Target: 500 **distinct, launch-ready** games. Do not inflate the count with placeholders, external redirects, renamed copies, palette-only recolors, or untested registry entries.
- [ ] Add games in reviewable batches (target up to 100 per batch); capture candidate commit, tests, fixes, licenses, owner review and acceptance before accepting a batch.
- [ ] After every batch, re-run shared engine, signed-run, account, leaderboard, event, navigation and mobile regressions.

### 4.6 AAA-style visual/gameplay acceptance
Each game must have:
- [ ] title/menu, active gameplay, pause/resume, game-over/results and restart verified;
- [ ] coherent, intentional art direction and original/distinct player-facing identity;
- [ ] responsive layout, readable HUD, safe touch targets and accessible text/contrast;
- [ ] satisfying animation, transitions, audio/impact feedback and input response;
- [ ] no blocking console errors, broken local assets, freezes, softlocks or severe performance spikes;
- [ ] valid score flow and server-side rejection of forged/replayed results where competitive;
- [ ] documented license and asset provenance;
- [ ] desktop and real Android evidence, owner review, final PASS/FIX/REPLACE decision.

### 4.7 Avatar and profile customization
- [ ] NEEDS TEST: 3D avatar renderer, fallback path, model loading, camera/turntable, animation, lighting and mobile performance.
- [ ] NEEDS TEST: presentation/body choices, skin/face/eyes/hair/facial hair, outfits, headwear, accessories, held items, profile backgrounds and future slots.
- [ ] NEEDS TEST: representative cross-slot combination matrix for clipping, floating parts, scale, attachment points, material mismatch and incompatible rigs.
- [ ] NEEDS TEST: preview reflects saved/equipped/owned state; failed server save never displays false success.
- [ ] NEEDS TEST: server-side ownership/unlock authorization for every item; client-side UI is not a security boundary.
- [ ] NEEDS TEST: persistence, logout/login, public profile rendering, unknown/malformed IDs, default avatar, WebGL failure and reduced motion.
- [ ] NEEDS TEST: avatars remain cosmetic only and consistent across games.

### 4.8 Shop, cosmetics and rotating catalog
- [x] Source generator currently produces a 1,200-item rotating catalog with stable generated definitions; the source-level generation test found unique IDs/names across its sampled calendar.
- [ ] NEEDS TEST: live API catalog total, page sizes, offsets, no duplicates/overlaps, valid item details, images and preview states.
- [ ] NEEDS TEST: 1,000+ genuinely useful cosmetic/profile customization items with deliberate design differences; generated variants must not be misrepresented as 1,000 bespoke 3D assets.
- [ ] NEEDS TEST: continuous daily/weekly/seasonal rotation, reset timing, time-zone boundaries, stable IDs, no reroll exploit and expired-item behavior.
- [ ] NEEDS TEST: owned/equipped/locked/preview/limited states, item availability and inventory persistence.
- [ ] NEEDS TEST: atomic server-side currency debit + ownership grant, concurrency, retry/replay, insufficient balance, database failure and audit logs.
- [ ] NEEDS TEST: mobile/desktop shop performance, pagination, search/filter/category/sort, image fallback and accessibility.
- [ ] Preserve the target of roughly 10–20 prestige originals at $1,000+ only as preview/disabled until explicit compatibility, legal, security, payment and owner approval.
- [ ] One-of-one items require database-level uniqueness and concurrency tests; UI labels alone are not proof.

### 4.9 Giveaways, brand affiliation, sponsor booking and admin
- [x] User-facing wording was changed from “Sponsor a Host” to “Book a Giveaway.”
- [x] Brand settings explain that affiliation affects giveaway eligibility; they do not connect or administer an external channel.
- [x] Source UI describes the 30-day switch cooldown and warns about active member-only entries.
- [ ] NEEDS TEST: booking request, approval/decline/status transitions, admin permissions and operator/vendor boundaries.
- [ ] NEEDS TEST: a brand cannot create an official giveaway solely by attaching a channel; valid Hub records and authorization must control official events.
- [ ] NEEDS TEST: missing/invalid/expired/mismatched event references, entrant list, eligibility, winner selection and score validation.
- [ ] NEEDS TEST: cooldown timing, leaving/switching brand, existing entries, persistence and UI/API consistency.
- [ ] NEEDS TEST: admin audit log, MFA/lockouts, secret admin path, unauthorized access and safe failure.
- [ ] Document the platform boundary: public casual game links can be shared externally; Hub must not authorize official Hub scoring, entrants, bookings or winners without valid server-side records.

### 4.10 Payments and premium features
- [ ] BLOCKED/OWNER DECISION: confirm whether Stripe is enabled, test mode or production mode; do not infer from source presence.
- [ ] NEEDS TEST: webhook signature verification, idempotency, duplicate/out-of-order events, refunds/disputes, reconciliation and failure states.
- [ ] NEEDS TEST: real-money purchase UX, tax/legal/consumer disclosures, receipts, support/refund policy and secret handling before enabling sales.
- [ ] Keep prestige real-money sales disabled unless all explicit gates are met; free testing and preview must work without paid services.

### 4.11 Android / PWA / future Play Store
- [ ] NEEDS TEST: PWA install prompt, manifest, all icon sizes/purposes, standalone mode, splash, orientation, safe-area, deep links and offline fallback.
- [ ] OWNER REVIEW: install/test on the owner's Samsung Galaxy S21 FE and capture actual defects.
- [ ] NEEDS TEST: Android back behavior, external links, virtual keyboard, focus, sound/audio unlock, performance, memory and background/resume.
- [ ] Play Store packaging/release is a later decision; first stabilize and validate the responsive web/PWA build. Do not incur paid tooling or store fees without owner approval.

### 4.12 Operations, deployment, observability and recovery
- [ ] Docker build must include required docs/tools while respecting `.dockerignore`; validate build-context inputs.
- [ ] Keep `package.json` and `package-lock.json` synchronized.
- [ ] Build must run syntax checks, rotating-quest checks, Games Library static integrity, game syntax, prelaunch audit, deep audit, prebuild asset generation and temporary-server HTTP smoke tests.
- [ ] Build failure must stop before image release and report the first failing command with useful context.
- [ ] NEEDS TEST: deployment uses intended commit; health endpoint, build fingerprint, API routes, static assets and audit endpoint respond.
- [ ] NEEDS TEST: persistent database/volume, restart, backup/restore, low-memory behavior, read-only root filesystem and production logs.
- [ ] Maintain a known-good rollback point, but record which data/schema migrations are reversible before rolling back.
- [ ] Avoid speculative commits: every build failure must produce a root-cause note and one targeted fix.

## 5. Repeatable local/build checks

Run from repository root in a Node 20 environment:
```sh
node tools/test-rotating-quests.js
node tools/verify-game-syntax.js
node tools/games-lib-static-check.js
node tools/verify-prelaunch.js
node tools/prelaunch-deep-audit.js
```

The Docker build additionally runs prebuild asset generation, native-module smoke checks and a disposable local server test with `tools/verify-live-deployment.js`. A structural audit that reports zero blockers still does not prove gameplay, visual quality, licensing, production reachability, payment correctness or real-device performance.

## 6. Deployment attempt log

| Date/time | Source SHA | Result | First error / observation | Fix SHA | Verification |
|---|---|---|---|---|---|
| 2026-10-12 | `bb2346e51ab91ee34a4293e969a40c801f27ec3a` | FAILED | Deep audit false positive: manifest icon path existed as a static public asset but was not hard-coded in `src/server.js`; `missingManifestIconRoutes: 1`, build exit 1 | `ea454f93a05ecf715d880d880e42228327f0a7b6` | Awaiting Deplexo build |
| 2026-10-12 | `bb9352ec8a9511003b1c443c3afc05af146587b8` | FAILED | Earlier build attempt; first failure not captured in the supplied log | — | Not established |

Add each subsequent deployment here, including successful deployments. Do not overwrite prior failure history.

## 7. Evidence locations to maintain

- Structural audit output: `docs/audit/prelaunch-structural-audit.json` (generated during build; do not hand-edit).
- Per-game status/evidence: `docs/audit/GAME-QA-TRACKER.md`.
- 80-game inventory: `docs/GAMES-LIB.md` (generated from canonical registry).
- Release gates and platform regression: `docs/RELEASE-CHECKLIST.md`.
- Full game/avatar/shop 500-game policy: `docs/PUBLIC-LAUNCH-500-GAME-AND-AVATAR-SHOP-AUDIT.md`.
- This project-wide requirements index: `docs/HUB-MASTER-CHECKLIST.md`.

## 8. Change log

- 2026-10-12: created consolidated source-of-truth checklist and recorded the Deplexo failure from build output.
- 2026-10-12: fixed manifest-icon audit logic to accept existing static public assets as well as explicit server routes; commit `ea454f93a05ecf715d880d880e42228327f0a7b6`.
