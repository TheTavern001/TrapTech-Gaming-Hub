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
