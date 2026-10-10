# Gaming Hub by Trap Tech Solutions — Agent Handoff (Oct 10, 2026)

Owner: Reese Norris (America/New_York). GitHub: TheTavern001. Casual, wants every request tracked DONE / NOT DONE with proof (screenshots).

## Where things are
- Code: `/workspace/jetpack-hub` on the shared box (Node/Express + better-sqlite3). Local: `http://localhost:8787`, restart with `scripts/restart-server.sh`.
- Repo: private `TheTavern001/gaming-hub-2`, branch `main`. Last pushed: `b2a1978` (v6). **Everything after is local, unpushed.** Ask Reese before pushing (push auto-deploys).
- Live (v6, 12 games): https://glassy-drifter-9532.de.deplexo.com — Deplexo Free (128 MB RAM, 0.25 CPU, no card), Frankfurt, account "The Tavern" (norrisreese4@gmail.com via GitHub login). Dockerfile build, volume `/data`, DB `/data/hub.db`.
- Live env vars: `ADMIN_PASSWORD`, `SECRET`, `PORT=8787`, `DATA_DIR=/data` (values are in Deplexo's env settings; Reese knows them). New for v7: `ADMIN_PATH`, TOTP enrolment, `ADMIN_RESET_TOKEN`, `PUBLIC_URL`, `BTC_ADDRESS=32Y22JCbcemRzTV661yqYzG1PU6tnoE2rB`. See `.env.example`, `docs/ADMIN-AUTH.md`.
- `scripts/build-assets.js` is untracked — leave it.

## Two workstreams (both commit locally, never push)
### A. Core hub v7 — progress log `PROGRESS-V7.md`
Phases 1–7 DONE (games stabilized + anti-cheat L1–L4 `docs/ANTI-CHEAT.md`; official events vs free play with private event codes `/event/TT-XXXX`, signed single-use run tokens, event-only leaderboards, official-giveaway notice; skill-only tie-breaks + seeded sudden-death playoffs; booking flow with NO client-visible prices, admin quote → one-click event + QR; cosmetic-only store: Hub Crowns, Season Pass, 48-quest free-next-pass chain (~top 5%), 3 numbered Prestige items, Bitcoin checkout to one address with unique sat offsets + mempool.space matching; avatars `/avatar`; shop/timers verified incl. DST `tools/e2e-timers.js`; About/landing).
Remaining:
- Phase 8 admin completeness (manage everything: bookings, events, games flags, shop, seasons/pass, currency, prestige, avatars, badges, quests, players, announcements, roles—owner-only appoints, settings).
- i18n: 20+ languages, auto-detect, RTL; rules English-authoritative.
- LOGO (final, Reese decided): white angular double-T with gold crown on navy — `/home/box/agent-data/agents/2ae0f2cf-a7ad-48c4-8255-9801bf7c3d9b/attachments/b291265eac2d3d7149b6100f9a620e9e0d21d10b593d71c451c2e928808ac27e.jpg`. Rebuild as SVG, use everywhere, keep site theme/colors unchanged.
- Phase 9: v6→v7 migration test, memory <~100 MB, all suites green, screenshots `screenshots/v7/final/`, `HANDOFF.md`, `FINALIZE.md`.

### B. Games library — `docs/GAMES-LIB.md`, code in `public/games-lib/`, `src/games-lib*.js`, tests `tools/e2e-games-lib.js`, audit `tools/games-lib-audit.js`, assets `public/games-lib/assets3d/ASSETS.md`, hunt log `docs/GAMES-LIB-ASSET-HUNT.md`
- 60 games, 100% giveaway-eligible (endless, uncapped, skill tie-breaks). Passing the AAA bar so far: Rail Rush, Lane Racer, Moto Lanes (3D, three.js) and Castle Crush (Matter.js).
- Reese's bar: every game looks/plays like its reference title (Subway Surfers, Temple Run, etc.) or better, with original characters/names/logos — NO blocky art, smooth realistic 3D characters, zero bugs. Side-by-side `docs/audit/<slug>-vs-ref.jpg` must read as same tier. Phone budget: <150 draw calls, <150k tris, DPR ≤2.
- Next: realistic smooth hero rework for the three 3D games; Ruin Runner (path turning); vendor full open-source games (2048, Hextris, Clumsy Bird…) with adapter; international source search (Gitee, Cocos, BOOTH, etc.); batches 4–8 to reach 150+ (catalog `docs/REESE-MASTER-CATALOG.md`, candidates `docs/GAME-CANDIDATES.md`); add cannabis branding elements + brand ad slots; per-game bug sweep.

## Firm boundaries (Reese accepted)
- No ripped/commercial game assets, characters, logos, or pirated ports (declined: CoD zombies, GTA, Halo, Skate 3, PES, Simpsons H&R, Half-Life/CS, UT). Licences must allow commercial use (CC0/CC-BY/MIT etc.; no NC, editorial, engine-locked).
- Copy says "upcoming/independent", never "underground". 21+. High Times text-only.
- Paid items cosmetic-only; never affect scores, attempts, entries or eligibility.

## Launch steps after both streams finish
1. Ask Reese to approve push. 2. Create new Deplexo project named like `traptechgaminghub`, set env vars, restore DB from backup (`DEPLOY-DEPLEXO.md`), set `PUBLIC_URL`. 3. Run `tools/e2e-live.js`. 4. Send Reese the secret admin URL privately; help set up TOTP + new password. 5. Domain option: TrapTechGamingHub.com ≈ $10–12/yr.
Pre-giveaway reminders: lawyer review of rules/terms, winner ID checks, state sweepstakes/skill-contest rules, Deplexo + payment terms.

## Marketing
Reese's vendor flyer copy is ready; fill `[YOUR GAMING HUB LINK]` with the new URL and `[YOUR TRAP TECH CHANNEL LINK]` with https://dympt.org/TrapTechSolutions (Potato). Two CTAs: PLAY THE HUB / BOOK A GIVEAWAY.
