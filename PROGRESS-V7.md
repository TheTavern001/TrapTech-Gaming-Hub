# v7 progress log (resume from the first NOT DONE)

| Phase | Status | Proof |
|---|---|---|
| 1a Stabilize uncommitted games work | DONE | commits bab9683, 6c0b348; e2e-api 383/0 (fresh DB), e2e-mobile 206/0, e2e-browser games section: all 16 games start, play via bots and save; game-run: 0 JS errors, L3/L4 ok |
| 1b docs/ANTI-CHEAT.md + tests | DONE | tools/e2e-anticheat.js 12/12 |
| 2 Official events vs free play | DONE | commits 3fd3f3d + phase-2 UI commit; tools/e2e-events.js 29/29, e2e-api 386/0 (fresh DB); skill-only tie-breaks + playoffs: tools/e2e-tiebreak.js 17/17; chance games retired (13 games, all giveaway-eligible) |
| 3 Booking flow verify | DONE | client details (prize, brand color, length, games, competition, dates, notes) + summary without prices; admin quote from price sheet; accept -> one-click official event (+QR on the vendor's quote page, admin button); e2e-sponsor-brands 63/63 (SEED=1 fresh DB) |
| 4 Monetisation (Bitcoin to one BTC_ADDRESS, cosmetic only) | DONE | src/monetize.js + src/btc.js + src/pass-quests.js; /store, /store/order/:ref (QR, exact amount, copy, txid paste), /prestige wall; admin Store & orders (verify/grant/refund, prices, checkout switch) + Official events page (share kit, playoffs); tools/e2e-payments.js 32/32 with a mocked explorer; docs/PASS-QUESTS.md |
| 5 Avatars | DONE | src/avatars.js (server SVG /avatar/<name>.svg, 12 kinds / 70+ parts: free, Crowns, achievement-earned, Prestige-only held items/crown/backgrounds), editor /avatar (live preview, buy with Crowns), shown on every board/profile/winner list, Prestige showcase on profiles; tools/e2e-avatars.js 13/13 |
| 6 Shop + timers | DONE | rotating shop (daily/weekly/event sections, 79 items) verified; fixed progress.dayStart on DST days (Nov 1 reset fired at 01:00 ET); client countdowns use server clock offset; tools/e2e-timers.js 27/27 (DST fall-back/spring-forward, year end, 45-min BTC quote), e2e-economy 49/49 |
| 7 Trap Tech logo / About / landing | NOT DONE | |
| 8 Admin completeness | NOT DONE | |
| 9 Finish / HANDOFF | NOT DONE | |

Notes: never push; scripts/build-assets.js stays untracked. Restart server before e2e-api (rate-limit buckets are in memory).
