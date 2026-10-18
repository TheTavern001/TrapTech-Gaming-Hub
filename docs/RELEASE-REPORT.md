# Release report: public-testing readiness (Oct 17, 2026, ET)

Branch: v8-games-upgrade (production on Deplexo). The URL does not change. main is kept in sync by PR, never by direct push.
Rollback points: main before the v8 merge was 41ed48a (PR #37 merged as 58f293e).

## Checklist, verified against the live site (glassy-drifter-9532.de.deplexo.com)
| Item | State |
|---|---|
| No "Numbered" wording; unlimited prestige copies | Fixed: the live Terms text still said "numbered and limited" and now says unlimited designs. `/api/store` and the shop/prestige pages are otherwise clean. |
| No vault retirement; simplified collapsed "How is this priced?" | Verified in the browser earlier: it is collapsed by default. The shop never retires items. Items rest for a cooldown (60/120/180/270 days by rarity) and then return. **Reese: decide if you want the cooldown shortened or removed** (see below). |
| 6-tab bottom nav with Shop | Live at 390px: Home, Games, Ranks, Prizes, Social, Shop. |
| "Book a giveaway", no-price quote flow, "My giveaway affiliation" | Present on live /giveaways and /sponsor. The quote is private and no price is shown. test-systems-v8 and test-audience-v8 pass. |
| Audiences open / affiliated / invite-only; brand pages; Featured Brands | Implemented, with 26/26 audience tests and 64/64 brand tests. The live database has no brands or giveaways yet, so Featured Brands is hidden on live (see below). |
| No promised subscriber/follower results | Copy audit is clean. Brand pages say "We do not promise followers, subscribers, traffic or sales". |
| Privacy/security, export/delete | `/api/me/export` returns 200. Delete needs the username typed to confirm (live 400 check). CSRF/Origin guard, CSP, rate limits and 0 npm vulnerabilities. |
| Payments (BTC 32Y22JCbcemRzTV661yqYzG1PU6tnoE2rB) | Code and tests pass. Live checkout is OFF (see below). The player-facing message is now friendly and the operator hint is separate. |
| 20+ language switcher | 21 languages. 43 new strings added last round. e2e-i18n passes 39/39. |
| Giveaway rules (portrait, endless, uncapped, skill-only tie-breaks) | The generic /rules page showed raw placeholders ("[GIVEAWAY NAME]", "[ARV...]"). Replaced with plain wording. A sentence now states that giveaway games are endless, portrait-friendly and uncapped. Tie-breaks are skill-only and sudden-death (e2e-tiebreak 18/18). |
| Cannabis category; crown double-T logo | Present in the shop, cosmetics and games library. The logo is in the header, splash and footer. |

## Live smoke (signed-up test user, 390px, one browser at a time)
Loaded: /, /games, /giveaways, /shop, /sponsor, /settings, /season, /quests, /achievements, /community, /notifications, /prestige, /store, /friends, /tournaments, /search, /invite, /about, /terms, /privacy, /rules, /responsible-play, /signin, /signup, /forgot, 404, bad brand, bad invite.
- No overflow, no "undefined/NaN", no 4xx or 5xx on any of them.
- The sign-up rate limit works: after a few sign-ups from one IP, later pages in my run fell back to signed-out empty states, which look correct.
- Fixed: pages without a heading (notifications, invite, 404, bad brand/join) now get exactly one h1.
- Fixed: the console showed a CSP error for Cloudflare's analytics beacon, which the host injects. It is now allowed (one exact host).

## Changes in this round
- Terms wording (unlimited prestige).
- Friendly checkout-off message.
- Rules page placeholders removed.
- h1 on every page.
- A clear startup banner when ADMIN_PATH is unset or invalid. It says the admin is disabled, that /admin returns 404 by design, and which env vars to set (ADMIN_PATH, ADMIN_PASSWORD, optional ADMIN_USERNAME / ADMIN_RESET_TOKEN).
- A branded HTML error page for server errors on non-API routes. The API still returns JSON.
- Service worker cache `gh-shell-v15-public-20261017`.
- Last round: robots.txt, sitemap.xml (needs PUBLIC_URL), noindex on account pages, offline page, 43 translations, admin Badges fix.

## Tests (local fresh DB)
All pass: systems 52, security 30, audience 26, admin 12, tiebreak 18, e2e-api 324, avatars 14, economy 49, sponsor-brands 64, reward-startup 8, i18n 39, payments 32, cosmetic-orders 22. Memory peak 85 MB. npm audit: 0.
Not verified: e2e-mobile (headless Chrome crashes on game pages on this box), 3D on real devices, and the service worker offline flow.

## Needs Reese
1. **Admin and content:** I cannot see the host env vars. If ADMIN_PATH (a long random slug) and ADMIN_PASSWORD are not set, the admin dashboard is disabled by design. Either way, the live database has no giveaways, brands or featured brands, so /giveaways shows an empty state. Then sign in, add the authenticator, create the first brands, feature them, and book at least one live giveaway so public testers see content.
2. **Payments:** checkout is OFF on live (`prestige_sales_enabled=false`). To open it: PAYMENTS_LIVE_APPROVED=1 and BTC_ADDRESS=32Y22JCbcemRzTV661yqYzG1PU6tnoE2rB, and optionally PRESTIGE_SALES_ENABLED=1 and PRESTIGE_COMPATIBILITY_APPROVED=1. Then make one test purchase. Refund overpaid, underpaid or late orders by hand.
3. **PUBLIC_URL** = the live URL. This turns on canonical tags and the sitemap.
4. Have a lawyer review the DRAFT Terms (the draft marker is still in the text) and the Privacy Policy.
5. Decide on the shop cooldown: items return after 60/120/180/270 days. Your "no long cooldowns" wording may mean something shorter; tell me the numbers and I will change them.
6. Confirm the 2026-10-18 shop cutover.
7. Keep prize and official events locked until the games are certified.
8. Test 3D avatar/profile and the games on real phones. Have native speakers check the translations.
9. Merge the sync PR (v8-games-upgrade into main) when I ask.

## Round 4 — cache-proof assets, load test, Stripe-only (Oct 17–18 2026)

### Cache busting in code
Every JS/CSS/i18n/manifest URL carries `?v=<build id>` (hash of public assets, or `BUILD_ID`), the service worker is registered as `/sw.js?v=<id>` with its cache name keyed on the same id, and the import map is hash-pinned in the CSP. Cloudflare's 4 h override of origin cache headers no longer matters: a new deploy changes every URL. (`/games-lib/*` game assets are the game stream's area and are not versioned.)

### Load simulation (local, exact release, Dockerfile flags: `--max-old-space-size=72 --max-semi-space-size=1 --single-threaded --no-opt`, `MALLOC_ARENA_MAX=2`, `UV_THREADPOOL_SIZE=2`; live site never touched)
Generator: `tools/loadtest.js` (+ `tools/loadsrv.sh`): each virtual user has its own IP (X-Forwarded-For, one trusted proxy hop like Cloudflare/Deplexo), signs up, browses home/games/shop/giveaways/store, starts + submits a scored run, reads game + global leaderboards, achievements, notifications, enters a giveaway, signs out/in.
Findings and fixes (all measured by CPU profile):
1. **bcryptjs under `--no-opt` costs ~1.1 s of blocked event loop per hash** (70 ms with the JIT). 40 signups took 62 s and froze every other request. Replaced with native async `scrypt` in the libuv threadpool (`src/pwhash.js`, 8 MB per hash, 2 at a time); old bcrypt hashes still verify and upgrade on next sign-in; overload returns 503 + Retry-After instead of queueing forever. 300-user smoke: 62 s → 22 s, signup p95 21 s → 0.85 s.
2. `db.prepare()` re-parsed SQL on every request (15% CPU) → statement cache in `src/db.js`.
3. Leaderboard / profile / score-submit / achievements re-ranked every player per request (~20% CPU) → display-only 4 s memo (`BOARD_CACHE_MS`), own rank computed exactly on submit, equip busts the memo; prize/giveaway results are never cached.
4. Cosmetic CSS key regenerated every cosmetic per page render (~8%) → 30 s memo.
Same 1,500-user run: 110 s → 54 s, 0 errors.
Measured results (final build, staged ramps, 0 5xx):
| stage | virtual users | concurrency | requests | 5xx/network errors | server RSS end / peak (incl. ~48 MB shared binary pages; anon ≈ 77–100 MB) | DB |
|---|---|---|---|---|---|---|
| 1 | 3,000 | 100 | 56,179 | 0 | 107 / 126 MB | 7.5 MB (+2 MB WAL) |
| 2 | 3,000 | 200 | 56,213 | 0 | 124 / 146 MB | 14.4 MB |
Latency at 100–200 concurrent: p50 60–155 ms, p95 0.5–0.9 s, p99 0.7–1.4 s for signup/home/games/score/leaderboard/shop. Sustained ≈ 340 requests/s of this mix on one core. Rate limiter behaved as designed (6 signups per distinct-IP test were 400 validation, none 429 once IPs are distinct; with ONE shared IP only 10 signups/hour succeed — correct).
**Honest limits:** a 20,000-user *total* signup population with ~100–200 concurrent browsing sessions fits (DB stays tens of MB). 300+ simultaneous heavy sessions on this single 128 MB / single-thread host queue (seconds of latency) and in an earlier 300-concurrency run produced ~1% client-side errors and anon memory ≈ 119 MB, i.e. over the safe line. Realistic capacity: ~150–200 concurrent active players (roughly 1–2k users/hour of normal browsing); a 1,000-concurrent spike needs a bigger plan or a CDN-cached read path. Memory retained after load was ≈ 77–102 MB anon (no growth when idle).

### Payments
Stripe is the sole default checkout (`docs/PAYMENTS-STRIPE.md`): env names, webhook endpoint + events, and `tools/e2e-stripe.js` (18 checks: 4242-card flow simulated against a mocked Stripe API, signature/timestamp rejection, exact amount/currency/owner checks, idempotent duplicate webhooks, refund reversal, refund-before-completion, failed/expired). Bitcoin needs `BTC_CHECKOUT_ENABLED=1`. BTC audit (e2e-payments 32/32, e2e-cosmetic-orders 22/22): order creation, unique-amount address display, confirmation reconciliation, over/under-pay, late payments all pass. Full suite after changes: all green, mem-check peak 85 MB.
