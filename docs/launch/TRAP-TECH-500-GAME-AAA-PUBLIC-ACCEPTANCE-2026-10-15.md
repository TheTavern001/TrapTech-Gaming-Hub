# Gaming Hub — owner-approved public launch acceptance & fresh Trap Tech Deplexo account

**Decision recorded:** 2026-10-15
**Status:** PLAN / ACCEPTANCE GATES ONLY. This document does not authorize a production deploy.
**Owner priority:** Absolutely premium *working* gameplay, graphics, avatars, cosmetics, shop, and especially giveaway booking + hosting.
**Project:** The Gaming Hub by Trap Tech Solutions — mobile-first Android and iOS web/PWA.

## Deployment topology and final migration decision

- Keep the **existing Deplexo app and URL** as the test/QA installation. Do not prematurely migrate it or disrupt any observed READY version.
- Owner has separately opened a **new Deplexo account under Trap Tech email**; designate that account as the eventual clean public launch environment, **not an active staging or experimental deploy target**.
- **Only after all below criteria are evidenced as passed**, prepare a single frozen, SHA-pinned public release candidate. Test the exact Docker image and HTTP server *off host* before first build on the new Deplexo account.
- Validate supported runtime port, persistent /data, object-storage assets, complete env-var configuration, logs, secrets, backups/restore, storage requirements, capacity and API permissions in an isolated environment before first new-account deployment. Keep auto deploy OFF during controlled promotion.
- Use a branded **custom HTTPS domain** owned and controlled by Trap Tech if available. Deplexo documents support for TXT ownership verification, CNAME routing, HTTPS; do not pick or assume an actual domain until ownership and availability are confirmed. Test Deplexo default hostname before DNS cutover.
- **Goal: zero failed deployments in the fresh production account.** This is a rigorous go/no-go target, **not a guarantee** against host/network outages. A failed image build or failing test may never be silently relabeled READY, fixed, or deployed. Capture root cause and rerun the full gate *off-production* first.
- Verify exact Git SHA and deployed runtime fingerprint, API routes, health checks and rollback readiness before enabling public traffic or auto deploy. Never conflate Git commit, local Node PASS, Docker PASS, Deplexo READY and real phone QA.

## Public launch release blockers (must all pass)

### 1. Exactly 500 genuinely playable, polished, distinct games

- **Public launch target: 500 fully playable, individually QA-approved games**, not catalog placeholder entries or near-duplicates. The user will test/approve games in manageable batches.
- Every title: recognizable, appealing original skill loop; must provide a fair contest winner by server-validated score/time/survival with transparent tie rules; games must not have unrecoverable caps or meaningless score farming.
- Audit each game for responsive input, movement, collision, level/difficulty pacing, pause/resume/background lifecycle, restart, touch and scaling, sound/VFX, render performance, score submission, anti-cheat and reconnect behavior. Real interaction/score proof required; canvas initialization alone is insufficient.
- No unlicensed copies or suspiciously close commercial clones; list third-party asset/code pack, exact license, source URL, modification and credit.
- Remove gameplay-family duplicates, broken titles, score exploits and noncompetitive shell games. Hold giveaway eligibility until each game passes server-integrity and device QA.

### 2. Actual premium graphics and near-instant fluid gameplay on phones

- Mobile-first UI and gameplay for Android + iPhone, with responsive safe areas and touch areas; also usable on desktop but mobile rules are primary.
- Cohesive dark/neon Trap Tech art direction, high-quality real licensed meshes, textures, shaders, animation, VFX, audio, readable silhouettes, satisfying impact/feedback, balanced contrast and polished transitions. Never satisfy an AAA request with empty mockups, flat placeholder images or generated inventory IDs alone.
- Target stable 60 fps on supported devices where practical, minimum acceptable sustained 30 fps on explicitly supported midrange devices **verified on hardware**; benchmark startup, high-load scenes, 1% lows, input delay, memory, thermal behavior, battery impact and frame allocation in long sessions. Degrade expensive effects gracefully rather than stutter. Never equate 4K art asset availability with a promise of 4K rendering on all phones.
- Verify every game at least on real representative Android and iPhone (including touch, orientation changes, tab suspension and recovery); owner visually signs off on each batch.
- Reuse licensed Kenney, Quaternius, Poly Haven and other verified assets where suitable and maintain exact source/credit ledger.

### 3. Working customizable neutral avatars, 1,000+ real cosmetics and a premium shop

- Every new player starts from an equal neutral basic avatar; meaningful customization is unlocked through play or purchase; no paid gameplay advantages.
- A real mobile-optimized avatar rig must render correctly with actual meshes/materials on profile, shop preview, lobby and supported games. Validate swap/purchase/equip/save/relogin on representative Android and iPhone.
- Every published cosmetic must have a real and inspectable asset, thumbnail/3D preview where appropriate, correct fit, variant/material, entitlement, persistence and accurate price. No filler catalog items with nonexistent meshes. Target >=1,000 meaningful items once genuinely implemented; rotating storefront displays curated selections.
- Keep low-cost entry items, earned rewards, transparent currency pricing and limited prestige collection (roughly 10–20 high-priced special items) without pay-to-win.
- Audit purchase failures, refunds/chargebacks, idempotence, wallet ledger and rollback so no free currency/item grants or disappearing purchases. Seasons, quests, streaks and achievements use consistent earned cosmetic/reputation rewards only.

### 4. Showcase-grade giveaway booking AND actual event hosting

- Both sponsor/vendor-facing booking and player-facing hosting must look like flagship products, consistent with premium lobby/shop design (not crude admin forms).
- Vendor flow: **Book a Giveaway**, select eligible certified game, select event type/duration/prize/rules, receive accurate quote, pay, verify settlement, submit for admin approval, schedule and publish only with owner authorization. No free event via sharing links, changing state or bypassing fees.
- Admin flow: approve/reject/pause/cancel, enforce age/compliance and event terms, inspect participants and signed runs, dispute/cheat review, audit payments and event ownership, controlled winner determination and official prize evidence.
- Player flow: premium promotional/event cards, clear entry requirements and countdowns, join/eligibility validation, seamless in-hub game experience, unambiguous live leaderboard, end-of-event freeze, clear fair results, claim instructions and notifications.
- Every state transition is server-authorized; creator-only actions remain creator-only. Test duplicate payments, late or refunded settlement, canceled events, invalid scores, replayed/tampered runs, multiple devices, broken links, full brackets/ties, timezones, errors, network retries and independent audit trails.
- No public cash/prize event until legal/compliance review and anti-cheat/event policy sign-off.

### 5. Production security, payments and reliability

- Server authoritative for scores, prizes, currencies, inventories and paid event access. Signed event and game runs, replay verification or appropriate server proof, rate limits, clock/RNG defenses, suspicious-score review, session revocation, admin MFA, CSRF controls, role separation and safe default denial.
- Stripe payment fulfillment only after authenticated webhooks and verified ledger settlement, plus refund/chargeback reversal. Crypto, if enabled later, only after adequate chain confirmation and server-side proof; never expose private keys/secrets. No hardcoded host secret or owner identifier.
- Complete repeatable Docker image build including tests, native SQLite, migration/backup/restore, consistent persistent storage, HTTP smoke, security validation, concurrent user/load tests, rollback test and monitored startup.
- Asset delivery for 500 games must stay responsive under realistic concurrent mobile traffic; validate object storage and cache policy instead of assuming free-host resources are sufficient.

## New-account migration sequence — conditional, no work before gates

1. Continue development/repairs and **private mobile acceptance** only on existing project environments. First unblock and verify the Docker build failure recorded for `8f118c8dbe0654056e532c8780d668fdf7f24f9b`.
2. Obtain owner visual/device sign-off for hub, every 500-game batch, real avatar+cosmetic sets, shop purchases, full vendor and player giveaway flows.
3. Freeze a final release SHA and asset manifest. Complete source, license, security, payment, storage, backup/restore, load and **exact full Docker** tests without relying on depleted GitHub Actions.
4. Configure brand-new Trap Tech Deplexo app only with owner authorization; connect the frozen branch/commit, set secrets through Deplexo environment settings, durable storage and permissions, leave auto deploy OFF.
5. Perform **one controlled initial deploy**, verify host logs, exact served commit/API fingerprint, physical Android/iPhone journeys, and provide rollback playbook. Investigate and fix *off host* before any subsequent attempt if anything fails.
6. Verify chosen owned custom domain and DNS/HTTPS, public SEO/share links/PWA install icons, accurate payout/prize terms and legal/compliance. Only then allow the owner to approve public traffic. Keep previous app until migration, rollback and data integrity are independently verified.
7. Report precise launch status as: code complete / source tests PASS / Docker PASS / staging READY / mobile QA PASS / new production READY / public approved; none implies any other.

## Starting evidence — NOT finished

At the time of the two owner-uploaded handoffs (2026-10-15), approximately 87–93 games were registered, **zero individually AAA/device-certified**, avatar and shop meshes/preview/entitlement paths were incomplete, prize anti-cheat, payments, mobile performance, and full Docker gates were not certified. Do not write release notes saying 500 completed or AAA certified until actual evidence replaces these blockers.

**Primary context documents:** `docs/TRAP-TECH-GAMING-HUB-AAA-DESIGN-HANDOFF.md`, `docs/audit/FINISH-GATES-PROGRESS-2026-10-15.md`, and `docs/audit/DEPLOYMENT-JOURNAL.json` (where present). Owner also provided handoffs titled `TRAP-TECH-GAMING-HUB-PROJECT-STATUS-MEMORY.md` and `TRAP-TECH-GAMING-HUB-AAA-DESIGN-HANDOFF.md`.

**Release authority:** Only owner approval after evidence; this document is a future launch requirement, not permission to deploy, merge into current production branch, create paid products, or start the new Deplexo account.
