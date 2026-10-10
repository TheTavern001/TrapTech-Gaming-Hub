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
Phases 1-9 DONE (incl. 8b i18n: 21 languages, body text of player pages, RTL; final crowned-TT logo; skill-only tie-break fix 855e530). All core suites green: e2e-api 374/0, anticheat 12/0, events 29/0, tiebreak 18/0, sponsor-brands 63/0, payments 32/0, avatars 13/0, timers 27/0, economy 49/0, admin 150/0, admin-sec 66/0, admin-tour 28/0, i18n 39/0, browser 202/0, mobile 176/0 (1,278 checks, 0 failures). Run them with `tools/run-all.sh`. Public favicon/app icon stays the Gaming Hub mark.

### B. Games library — `docs/GAMES-LIB.md`, code in `public/games-lib/`, `src/games-lib*.js`, tests `tools/e2e-games-lib.js`, audit `tools/games-lib-audit.js`, assets `public/games-lib/assets3d/ASSETS.md`, hunt log `docs/GAMES-LIB-ASSET-HUNT.md`
- 62 games registered, 100% giveaway-eligible (endless, uncapped, server-validated skill tie-breaks + sudden-death playoffs in `src/games-lib-playoff.js`).
- Rule (Reese): ONE game at a time. A game is done only when it rates 7+, its side-by-side `docs/audit/<slug>-vs-ref.jpg` reads as the same tier, and the bug pass is clean (`node tools/games-lib-bugpass.js <slug>`: seeded runs, pause, tab, rotate, 4x CPU throttle, memory). Commit after each.
- Status: Rail Rush DONE (3D, realistic PBR hero). Ruin Runner DONE 7/7 (turns, ravines, Poly Haven PBR). Lane Racer PASS tests. Bud Merge (vendored MIT 2048) PASS. Moto Lanes ON HOLD (Reese choosing realistic cars); passes tests + bug pass, visuals below tier (6/10): the reference is realistic and we only have the cartoon CC0 car pack.
- Hex Stack DONE (vendored Hextris, GPL-3.0, stripped ads/analytics/score beacon; e2e + bug pass PASS).
- Tools: `tools/e2e-games-lib.js` (supports DOM games via `#gl`), `tools/games-lib-bugpass.js`, `tools/games-lib-audit.js`. Bots: /tmp/jt.js (Ruin Runner turns), /tmp/lrbot2.js (racers, in-page).
- Sky Flap DONE (rebuilt with Kenney Tappy Plane CC0; Clumsy Bird rejected for copied art).
- Block Drop DONE (glossy tile renderer, clear/drop/lock FX).
- Maze Muncher DONE (neon tube maze, original hero + haze-wisp enemies).
- Shared car set DONE (assets3d/rc-*.glb from tools/blender/hub-cars.py, used by racer3x). Moto Lanes DONE 7/7 (near traffic + overtakers, overpasses, gantries, yellow edge line).
- Alien Rows DONE (Kenney Space Shooter CC0 art).
- Cloud Hopper DONE (Kenney Jumper Pack CC0 art).
- Road Hopper DONE (voxel three.js rebuild).
- Sling Siege DONE (Matter.js + Kenney Physics Assets CC0).
- Lawn Guard DONE (original vector cartoon art).
- Pop Defense DONE (Kenney TD CC0 + code balloons; speed bug fixed).
- Hill Hauler DONE (Matter.js car, code-drawn art).
- Most Wanted Run DONE (voxel three.js, instanced city).
- Cube Horde DONE (voxel 3D, instanced horde).
- Grid Wars DONE (spring grid + bloom + sparks).
- Jet Blaster DONE (lab parallax art rebuild).
- Moon Swarm DONE (Vampire Survivors-style, new; Kenney pixel CC0).
- Throttle Rider DONE (Traffic Rider-style, racer3x first-person cockpit).
- Wreck Ride DONE (Happy Wheels-style, Matter ragdoll).
- Rig Rally DONE (Bad Piggies-style builder).
- Goo Tower DONE (World of Goo-style).
- Keep Guard DONE (Kingdom Rush-style).
- Node Siege DONE (Infinitode-style maze TD).
- Orb Coil DONE (Zuma-style).
- Gem Rush (Bejeweled-style) DONE (06:05)
- Slab Stack (Stack-style) DONE (06:11)
- Neon Flipper (Pinball) DONE (06:32)
- Light Cycle (Tron) DONE (06:36)
- Toad Cross (Frogger) DONE (06:53)
- Roll Up (Cannabis rolling precision) DONE (06:56)
- Smoke Rings (Cannabis ring-blowing) DONE (07:00)
- Bud Sort (Cannabis sorting) DONE (07:03)
- Pest Patrol (Cannabis tap-squash) DONE (07:08)
- Cup Toss (Cannabis lounge cup pong) DONE (07:14)
- Beat Tiles (Piano Tiles) DONE (07:29)
- Moon Lander (Lunar Lander) DONE (07:35)
- Pin Strike (Bowling) DONE (07:47)
- Bullseye (Archery) DONE (07:50)
- Cup Toss harder: power meter + aim wobble, bot 68% (07:26)
- Bud Bar (Tapper) UPGRADED (06:46); polish backlog: Neon Flipper ramps + spinner
- Missile Guard (Missile Command) UPGRADED (06:44)
- Star Swarm (Galaga) UPGRADED (06:41)
- Knife Toss (Knife Hit) UPGRADED (06:08)
- Bubble Pop UPGRADED (Bubble Shooter art pass).
- Rock Buster (Asteroids) UPGRADED (06:39); Kenney CC0 art
- Next (Reese order): A-tier list one at a time (Bejeweled, Knife Hit, Stack, Pinball, Tron, Asteroids, Galaga, Missile Command, Tapper, Frogger) + remaining Cannabis; international search folded into each hunt. Then: the international source search, batches 4-8 toward 150+ (catalog `docs/REESE-MASTER-CATALOG.md`); then the bug pass and same-tier audit across all older games.

## Firm boundaries (Reese accepted)
- No ripped/commercial game assets, characters, logos, or pirated ports (declined: CoD zombies, GTA, Halo, Skate 3, PES, Simpsons H&R, Half-Life/CS, UT). Licences must allow commercial use (CC0/CC-BY/MIT etc.; no NC, editorial, engine-locked).
- Copy says "upcoming/independent", never "underground". 21+. High Times text-only.
- Paid items cosmetic-only; never affect scores, attempts, entries or eligibility.

## Launch steps after both streams finish
1. Ask Reese to approve push. 2. Create new Deplexo project named like `traptechgaminghub`, set env vars, restore DB from backup (`DEPLOY-DEPLEXO.md`), set `PUBLIC_URL`. 3. Run `tools/e2e-live.js`. 4. Send Reese the secret admin URL privately; help set up TOTP + new password. 5. Domain option: TrapTechGamingHub.com ≈ $10–12/yr.
Pre-giveaway reminders: lawyer review of rules/terms, winner ID checks, state sweepstakes/skill-contest rules, Deplexo + payment terms.

## Marketing
Reese's vendor flyer copy is ready; fill `[YOUR GAMING HUB LINK]` with the new URL and `[YOUR TRAP TECH CHANNEL LINK]` with https://dympt.org/TrapTechSolutions (Potato). Two CTAs: PLAY THE HUB / BOOK A GIVEAWAY.
