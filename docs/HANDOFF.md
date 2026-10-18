# HANDOFF — The Gaming Hub (Trap Tech) — written Oct 18 2026 12:4x AM ET

Self-contained so any assistant (ChatGPT etc.) can continue without breaking anything. Be honest in every report; never claim "done" without a command or screenshot that proves it.

## 0. START HERE (state in 10 lines)
1. Repo `TheTavern001/gaming-hub-2`, work branch **`v8-games-upgrade`** (Deplexo production tracks it). Live: https://glassy-drifter-9532.de.deplexo.com (URL must never change).
2. Node 20 / Express / better-sqlite3 SPA (`public/js/app.js`), deployed from the Dockerfile on Deplexo free plan: 0.25 vCPU, 128 MB RAM, 250 MB disk, no card.
3. Last pushed head at time of writing: `38c35c8` (+ this handoff). main was synced earlier via PR #37 (merge 58f293e, rollback point 41ed48a); main is behind v8-games-upgrade — sync only through a PR merged in the GitHub web UI.
4. Done: security module, audiences/invite-only/brand pages, cosmetic shop + cash orders, admin (secret ADMIN_PATH, TOTP), i18n 21 languages, code-level cache busting (`?v=<build id>`), Stripe-only checkout (Bitcoin off), load-test fixes (scrypt, statement cache, board memo).
5. Test suites last run all green: systems 52, security 30, audience 26, admin 12, tiebreak 18, api 324, avatars 14, economy 49, sponsor-brands 64, rewards 8, i18n 39, payments 32, cosmetic-orders 22, stripe 18; mem-check peak 85 MB.
6. Games: 74 library games exist (+13 core). **None is truly AAA.** Honest classes below: 17 rebuilt, 9 art-rebuilt, rest overlay/art-upgraded. **The remaining mission is to go through EVERY game, worst first, and redo with real new gameplay + original art.** 
7. Capacity: free host realistically handles ~150–200 concurrent active players; 10k concurrent needs a different host (section 7).
8. Stripe sandbox is connected by Reese; webhook secret/keys/test purchase still need him (section 11).
9. Every push redeploys and takes the site down ~3 min: **batch pushes**.
10. Never print secrets; outgoing messages (email/Slack/posts) need Reese's explicit approval.

## 1. HARD RULES (do not break)
- **Never push to main directly.** Push only to `v8-games-upgrade`; keep main in sync with a PR that Reese/an agent merges in the signed-in GitHub web UI (the box has no git credentials; connector `create_pull_request` only shows a form).
- Deplexo tracks `v8-games-upgrade`; each push = redeploy ≈ 3 min downtime. Batch changes; ≤4 files per `push_files`; check remote head first; verify blob SHAs after push (`git hash-object file` vs the SHA the connector returns).
- **URL cannot change.** Free hosting only, no card. Dockerfile CMD must stay: `node --max-old-space-size=72 --max-semi-space-size=1 --single-threaded --no-opt src/server.js` (ENV: NODE_ENV=production PORT=8787 DATA_DIR=/data MALLOC_ARENA_MAX=2 MALLOC_TRIM_THRESHOLD_=65536 UV_THREADPOOL_SIZE=2). Only `docs/pass-quests.json` and `docs/score-ranges.json` are copied from docs/ into the image; anything else read at runtime must live in src/ or public/. Root FS is read-only; writable: /data (noexec) and /tmp (100 MB).
- **Memory:** idle ≈ 79 MB RSS, mem-check peak must stay < 100 MB (budget). `--no-opt` makes pure-JS CPU work ~15x slower (bcryptjs = 1.1 s/hash blocked loop) — never add heavy sync JS; use native/async (scrypt via `src/pwhash.js`).
- **Assets/IP:** only CC0 or original assets; never copy commercial art/code/names; exact copies of commercial games are impossible (and not wanted). Keep CREDITS.md per game accurate (Kenney CC0 etc.). No third-party stock clones (the original audit flagged bud-merge=2048 MIT, hex-stack=Hextris, dino-dash=T-Rex).
- **Giveaway game rules:** portrait layout, endless, uncapped score, skill-only tie-breaks, **no luck games** (roulette/plinko/spin-to-win style games are "just for fun", never giveaway-eligible).
- **Shop/prestige rules:** no "Numbered x of y" wording; prestige is unlimited (one per player); no vault retirement (retired items return after long cooldowns: common 60 / rare 120 / epic 180 / legendary 270 days); scarcity price clamp MIN_ACTIVE_FOR_SCARCITY=500.
- Keep brand colors/theme and the crown double-T logo (Trap Tech).
- **Payments: Bitcoin checkout disabled by default; Stripe-only.** Bitcoin only with `BTC_CHECKOUT_ENABLED=1` (+BTC_ADDRESS+PAYMENTS_LIVE_APPROVED). `sk_live_` keys need `PAYMENTS_LIVE_APPROVED=1`.
- Do not touch game folders when you are the systems stream and vice-versa (two streams pushed concurrently; always re-fetch head before pushing).
- Outgoing messages (email, Slack, posts, tickets) need explicit approval of recipient+text.
- Reese is in America/New_York; report times in ET.

## 2. ARCHITECTURE MAP
- `src/server.js` Express app, auth (scrypt via `src/pwhash.js`, legacy bcrypt verified+upgraded on sign-in), limiters, leaderboard (cached display boards in `src/boards.js`, 4 s memo, `BOARD_CACHE_MS`), run start/score, SPA shell (`INDEX_HTML`, build-id transform), `/sw.js` route.
- `src/build-id.js` build id (hash of public/js, css, i18n, index.html, sw.js, manifest or env `BUILD_ID`) → `?v=` on all assets, SW cache name, import-map hash pinned in CSP (`src/v8-sec.js`). `public/sw.js` keyed on it.
- `src/db.js` SQLite (WAL, 2 MB page cache, statement cache wrapper). `src/config.js` GAME_MAP (13 core + library).
- Games: core in `public/js/games/*.js`; **library games** in `public/games-lib/<slug>/{index.html,game.js,CREDITS.md,thumb.jpg}`, shared `kit.js` (canvas/input/touch/particles/WebAudio/juice allowlist), `adapter.js` (POST /api/run/start signed token, event telemetry, score submit, guest mode: plays signed-out with soft "sign in to save" toast), `carart.js`/`topcar.js`/`sky3d.js` shared art modules. Registry: `src/games-lib.js` (category, tier, scoring, giveaway_eligible, anti-cheat L2 ceiling, source, licence, playable flag; served `GET /api/games-lib`). Docs: `docs/GAMES-LIB.md` (generated by `node tools/games-lib-build.js`, do not hand-edit tables), `tools/e2e-games-lib.js`.
- **Add a game:** make `public/games-lib/<slug>/` (portrait 390x780-friendly, uses kit.js + adapter.js, endless, uncapped score, skill-only), add registry entry in `src/games-lib.js`, thumb.jpg (`tools/games-lib-thumb.js`), CREDITS.md, run `tools/e2e-games-lib.js <slug>` (loads, random input, accepted legit score, forged score rejected, no console errors, fps), then `tools/games-lib-build.js`.
- Cosmetics/shop: `src/shop.js` (rotation simulation, `cssKey` 30 s memo), `src/shop-gen.js` (generated item SVG/CSS), `src/cosmetics.js`, `cosmetic-*.js`, `avatars.js`, prestige in `monetize.js`; `/cosmetics.css`, `/cosmetics-mine.css`.
- Audiences/brands: `src/brands.js`, `eligibility.js`, giveaways `admin-giveaways.js`, `v5.js`, results `results.js`, tie-breaks (skill-only) `e2e-tiebreak`.
- Payments: `src/monetize.js` (Stripe checkout + webhook `/api/store/webhook/stripe`, BTC optional), `src/btc.js`, `docs/PAYMENTS-STRIPE.md`, `docs/ECONOMY.md`.
- Admin: hidden at `/<ADMIN_PATH>/` (16–128 chars A-Za-z0-9_-; `/admin` is 404); `admin-sec.js` (TOTP, roles), `admin-users/ops/roles/giveaways/profiles/media/v7`. **The actual ADMIN_PATH value is in Deplexo's Environment tab, not in the repo.**
- Backups: `src/backup.js` (daily gz to /data/backups; optional private GitHub repo).
- Env var NAMES (no values): PORT DATA_DIR DB_PATH NODE_ENV SECRET (or SESSION_SECRET/RUN_SECRET/IP_SALT) ADMIN_PASSWORD ADMIN_USERNAME ADMIN_PATH ADMIN_RESET_TOKEN PUBLIC_URL CANONICAL_REDIRECT TRUST_PROXY_HOPS TRUST_CF_IP HUB_PREVIEW_USERNAMES HUB_PRIVATE_REVIEW HUB_TZ CSP_MODE BUILD_ID BOARD_CACHE_MS PW_MAX_PENDING SQLITE_CACHE_KB RATE_LIMIT_MAX_KEYS RUN_TOKEN_KEEP_DAYS OG_CACHE_MAX_MB COSMETIC_CACHE_MAX BACKUP_* (DISABLE, KEEP, MAX_MB, INTERVAL_HOURS, GITHUB_TOKEN/REPO/BRANCH/KEEP) STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET (STRIPE_API_BASE is test-only) PAYMENTS_LIVE_APPROVED BTC_CHECKOUT_ENABLED BTC_ADDRESS BTC_EXPLORER_URL BTC_PRICE_URL PAY_NO_SWEEP PRESTIGE_SALES_ENABLED PRESTIGE_COMPATIBILITY_APPROVED CLOUDFLARE_R2_* PRIZE_PROOF_TEST_APPROVE (test only; production ignores).

## 3. TOOLING GOTCHAS (learned the hard way)
- The GitHub connector **truncates file reads at ~19 KB** (and tree listings at ~70–85 entries). Never edit a big file from a truncated read and push it back. Edit local copies and push with `push_files` (≤4 files/commit); the executor can pass `$file:/abs/path` so bytes go straight from disk. Verify SHAs after push.
- Box git has no credentials: no `git push`/`clone` of the private repo. PRs/merges only via the signed-in GitHub web UI.
- **Corruption incident:** truncated base64 inside SVG cards (void-swarm, grow-guard, sling-smash, haze-defense) broke thumbnails; replaced with original vector art. Always check pushed images render and sizes match local.
- Browser: one Chrome at a time; `pkill chrome` after each run; software GL only (SwiftShader) so fps is relative (<30 flags heavy), not real phone numbers. Box memory pressure can crash Chrome; `e2e-mobile` may not run on the box.
- `--no-opt` in the Dockerfile CMD: profile before adding CPU-heavy JS. Load generator and docs: `tools/loadtest.js`, `tools/loadsrv.sh`.
- Test runner pattern: fresh DB + server on a private port (`tools/fresh-api.sh tools/<test>.js`); prize-proof gates need NODE_ENV=test + PRIZE_PROOF_TEST_APPROVE.
- Cloudflare in front of Deplexo overrides cache headers (max-age 14400); that is why assets use `?v=` build ids. `/games-lib/*` assets are NOT versioned yet (rename-on-change or add `?v=` in game index.html when changing them).

## 4. PER-GAME TABLE (74 library games; source docs/GAME-STATUS.md + game-audit.md)
Classes: **rebuilt** = new gameplay+art; **art-rebuilt** = new rendering/art, same core loop; **overlay** = decorative art layer (art.js) over old core; **art-upgraded** = added sprites/scenery, mechanic unchanged; **juice-only** = layout fix + shared FX only; **retired** = 6 duplicate slugs not playable by design (drift-king, dune-glide, egg-roll, monster-crush, rig-rally, wreck-ride; aliases of hill-hauler/drift-rush). Signed-in score submit verified ok:true for all playable on a local server (bot scores do not prove fun). Core 13 games (public/js/games) were never fully audited signed-in — do that too.
Ordered worst first:

| game | audit tier (1 worst) | honest class today | remaining work |
|---|---|---|---|
| rail-rush | 4 | overlay | FULL REDO: overlay art is decoration on the old core; rebuild mechanic + art |
| throttle-rider | 4 | overlay | FULL REDO: overlay art is decoration on the old core; rebuild mechanic + art |
| cloud-hopper | 3 | overlay | FULL REDO: overlay art is decoration on the old core; rebuild mechanic + art |
| road-hopper | 3 | overlay | FULL REDO: overlay art is decoration on the old core; rebuild mechanic + art |
| wanted-run | 3 | overlay | FULL REDO: overlay art is decoration on the old core; rebuild mechanic + art |
| block-drop | 2 | overlay | FULL REDO: overlay art is decoration on the old core; rebuild mechanic + art |
| rock-buster | 2 | overlay | FULL REDO: overlay art is decoration on the old core; rebuild mechanic + art |
| star-swarm | 2 | overlay | FULL REDO: overlay art is decoration on the old core; rebuild mechanic + art |
| grid-wars | 2 | overlay | FULL REDO: overlay art is decoration on the old core; rebuild mechanic + art |
| moon-swarm | 2 | overlay | FULL REDO: overlay art is decoration on the old core; rebuild mechanic + art |
| smoke-rings | 2 | overlay | FULL REDO: overlay art is decoration on the old core; rebuild mechanic + art |
| beat-tiles | 2 | overlay | FULL REDO: overlay art is decoration on the old core; rebuild mechanic + art |
| glow-echo | 2 | overlay | FULL REDO: overlay art is decoration on the old core; rebuild mechanic + art |
| orb-coil | 4 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| neon-flipper | 4 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| cup-toss | 4 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| pin-strike | 4 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| bullseye | 4 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| spot-kick | 4 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| knockout | 4 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| cue-club | 4 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| long-ball | 4 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| rally-court | 4 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| ice-snipe | 4 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| reel-deal | 4 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| hoop-streak | 4 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| maze-muncher | 3 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| pop-defense | 3 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| light-cycle | 3 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| missile-guard | 3 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| bubble-pop | 3 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| knife-toss | 3 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| bud-bar | 3 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| roll-up | 3 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| bud-sort | 3 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| pest-patrol | 3 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| moon-lander | 3 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| putt-party | 3 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| kickflip-city | 3 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| tunnel-hop | 3 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| neon-circuit | 3 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| hill-hauler | 2 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| arrow-hero | 2 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| goo-tower | 2 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| green-dash | 2 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| cab-rush | 2 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| road-brawl | 2 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| derby-smash | 2 | art-upgraded (scenery/sprites, same mechanic) | FULL REDO: same mechanic with added sprites/scenery; add new gameplay + real art pass |
| skee-roll | 4 | art-rebuilt | REDO gameplay: new art exists, core loop unchanged |
| helix-drop | 3 | art-rebuilt | REDO gameplay: new art exists, core loop unchanged |
| hex-spin | 3 | art-rebuilt | REDO gameplay: new art exists, core loop unchanged |
| color-hop | 3 | art-rebuilt | REDO gameplay: new art exists, core loop unchanged |
| mole-whack | 3 | art-rebuilt | REDO gameplay: new art exists, core loop unchanged |
| strain-crush | 3 | art-rebuilt | REDO gameplay: new art exists, core loop unchanged |
| tile-twin | 3 | art-rebuilt | REDO gameplay: new art exists, core loop unchanged |
| no-brakes | 3 | art-rebuilt | REDO gameplay: new art exists, core loop unchanged |
| paper-toss | 3 | art-rebuilt | REDO gameplay: new art exists, core loop unchanged |
| alien-rows | 2 | rebuilt | Re-verify on real phone; polish; no further rebuild unless QA < 7/10 |
| hex-stack | 2 | rebuilt | Re-verify on real phone; polish; no further rebuild unless QA < 7/10 |
| cube-horde | 2 | rebuilt | Re-verify on real phone; polish; no further rebuild unless QA < 7/10 |
| keep-guard | 2 | rebuilt | Re-verify on real phone; polish; no further rebuild unless QA < 7/10 |
| node-siege | 2 | rebuilt | Re-verify on real phone; polish; no further rebuild unless QA < 7/10 |
| roof-runner | 2 | rebuilt | Re-verify on real phone; polish; no further rebuild unless QA < 7/10 |
| zig-path | 2 | rebuilt | Re-verify on real phone; polish; no further rebuild unless QA < 7/10 |
| bug-blaster | 2 | rebuilt | Re-verify on real phone; polish; no further rebuild unless QA < 7/10 |
| grow-op | 2 | rebuilt | Re-verify on real phone; polish; no further rebuild unless QA < 7/10 |
| trim-rush | 2 | rebuilt | Re-verify on real phone; polish; no further rebuild unless QA < 7/10 |
| dirt-dash | 2 | rebuilt | Re-verify on real phone; polish; no further rebuild unless QA < 7/10 |
| dunk-flick | 2 | rebuilt | Re-verify on real phone; polish; no further rebuild unless QA < 7/10 |
| duck-shot | 2 | rebuilt | Re-verify on real phone; polish; no further rebuild unless QA < 7/10 |
| rift-survival | 2 | rebuilt | Re-verify on real phone; polish; no further rebuild unless QA < 7/10 |
| bud-merge | 1 | rebuilt | Re-verify on real phone; polish; no further rebuild unless QA < 7/10 |
| dino-dash | 1 | rebuilt | Re-verify on real phone; polish; no further rebuild unless QA < 7/10 |
| mine-sweep | 1 | rebuilt | Re-verify on real phone; polish; no further rebuild unless QA < 7/10 |

**Explicit remaining work (no skips):** go through EVERY game above, in this order, and redo each with genuinely new gameplay mechanics and original art (not recolors, not overlays): worst-first = juice-only, then overlay, then art-upgraded (tier 1–2 first), then art-rebuilt, then re-QA rebuilt ones. Each game needs: portrait 390x780 layout, endless/uncapped/skill-only, ≥7/10 on the quality gate (section 8), CREDITS.md, thumb, e2e pass, 0 console errors, real-phone check. Also fix the heavy-3D perf list (road-hopper, rail-rush, hill-hauler, wanted-run, cube-horde, grid-wars, throttle-rider, tunnel-hop, strain-crush: instancing, DPR cap, LOD; target <2 MB gzip per game).

## 5. SYSTEMS STATUS (non-game)
Done/verified: logo, shop timers + seasons (S1 56 days, 60 levels), cosmetic generation, admin, i18n(21), audiences (open/affiliated/invite-only), brand pages + featured brands, security module, cache busting, Stripe flow. Known gaps/honest notes: shop item art quality and name variety (S1/S2 plan in docs/SYSTEMS-PLAN.md), avatar 3D editor shows "compatibility preview · rigged wardrobe asset pending", rotating-quest templates preview-only, Season Pass UI shows 60 levels but premium needs checkout live, `elig_followers_only` field name misleading (copy must never promise follower goals), shop balance card wrapped at 390px (verify fixed). Re-read docs/SYSTEMS-PLAN.md and docs/RELEASE-REPORT.md before editing.

## 6. PAYMENTS (Stripe-only)
See docs/PAYMENTS-STRIPE.md: env names, webhook `https://glassy-drifter-9532.de.deplexo.com/api/store/webhook/stripe` with events checkout.session.completed / async_payment_succeeded / async_payment_failed / expired / charge.refunded; grants only on signed webhook, idempotent, refunds reverse, mismatches flagged. `tools/e2e-stripe.js` (mocked API). Anonymous-crypto options researched there (xpub + mempool.space watcher is the best fit later; BTCPay does not fit 128 MB).

## 7. SCALE PLAN for 10k+ concurrent users
Measured (local, exact Dockerfile flags): after fixes, 200 concurrent virtual users, 0 server errors, p95 0.5–0.9 s, ≈340 req/s, RSS peak 146 MB incl ~48 MB shared binary pages (anon 77–100 MB); at 300 concurrent: ~1% client errors and anon ~119 MB. **Honest capacity of the free host: ~150–200 concurrent active players.** A run to the full 20,000 users at 500–1000 concurrent was NOT completed cleanly.
What failed/was fixed: sync bcrypt under --no-opt (fixed: scrypt), per-request SQL prepare (cache), per-request full leaderboard re-rank (memo), cosmetic CSS regeneration (memo). Still needed for 10k concurrent: (1) move off the 0.25 vCPU/128 MB plan (≥2 vCPU, 1–2 GB) and drop `--no-opt`/tiny heap flags; (2) put ALL static assets behind a CDN with long immutable cache + versioned URLs incl. games-lib (server then serves only /api); (3) cache read endpoints (leaderboards, shop, giveaways, games list) at the edge with short TTL and ETags; (4) SQLite is single-writer: fine for ~hundreds of writes/s; beyond that move to Postgres or shard by feature, batch score writes, keep WAL checkpointing; (5) horizontal option: stateless app nodes behind a load balancer need shared DB (Postgres) and shared rate-limit store (Redis); signed run tokens already stateless; (6) avoid websockets; keep polling ≥15–30 s with jitter and ETag/304; (7) rate limits per IP/user exist (signup 10/h, signin 20/15 min, run start 20/min/user) — keep per-IP keyed by trusted proxy hop (`TRUST_PROXY_HOPS`, `TRUST_CF_IP`); (8) re-run `tools/loadtest.js` on the new host (never on the live free host).

## 8. PLAN TO GROW TO ~500 GAMES
Batches of 10: pick category gaps from docs/GAME-CANDIDATES.md and game-candidates-120.md; build original code + art (CC0 sources: Kenney, OpenGameArt CC0, Quaternius — record in CREDITS.md; or code-drawn); each batch → static check (`tools/games-lib-static-check.js`), e2e (`tools/e2e-games-lib.js`), integrity audit, thumbnails, registry entry, credits; **quality gate: every game rated ≥7/10 by a human/screenshot review on portrait 390x780 (fun in 30 s, readable, juicy, fair, no console errors, <2 MB gzip, ≥30 fps)**; giveaway-eligible only if endless/uncapped/skill-only; luck games "just for fun". Memory: library is static files, server cost is registry size only; keep registry lazy. Do not ship a batch that lowers the average; quarantine (`playable:false`) instead of deleting.

## 9. FULL BROWSER PASS CHECKLIST (do at 390px and desktop, signed-out and signed-in, EN + one RTL language)
Home, Games (cards, filters, search), each game launch/guest mode/sign-in-to-save, Leaderboards (all/weekly/monthly/friends/per game), Giveaways list/detail/join/rules/eligibility messages, Tournaments, Season pass, Quests, Achievements, Community/profile/follow/invite, Shop (rotation, countdowns, price modal, buy with Credits, cash checkout), Store/Packs/Pass, Avatar editor, Settings/privacy/delete account/export, Notifications, Sponsor/brand pages + featured brands, Terms/Privacy/About/Rules, sign-up (21+ DOB gate), sign-in/out/password change, offline page, 404/error pages, share links `/s/<id>` OG images, SW update after deploy, admin (/<ADMIN_PATH>/: login+TOTP, players, giveaway builder, shop, store checkout switch, systems, backups). Check console errors, layout overflow, i18n missing keys (`tools/i18n`), a11y focus/contrast.

## 10. DEFINITION OF DONE
All suites green (section 12); no console errors on any page/game; every game ≥7/10 and honestly classified; mem-check < 100 MB and load test <1% errors at the supported concurrency; Stripe sandbox purchase + refund verified end-to-end by a real test card; docs updated; main in sync via PR; live verified by simple GETs (no load) after deploy.

## 11. OPEN ITEMS NEEDING REESE
- Stripe: create webhook endpoint (URL/events in docs/PAYMENTS-STRIPE.md), paste `STRIPE_WEBHOOK_SECRET` + `STRIPE_SECRET_KEY` in Deplexo env, do a 4242 test purchase + a refund; later live keys + `PAYMENTS_LIVE_APPROVED=1`.
- `ADMIN_PATH` value lives in the Deplexo Environment tab; set up TOTP for the owner account.
- Create the first brand + first giveaway; decide official prize/rules text.
- Lawyer review of Terms/Privacy/official rules/sweepstakes law (21+ audience, cannabis-brand sponsors).
- Real-device testing (iPhone + Android) for performance/touch/audio; domain decision (free plan has platform subdomain only).
- Approve the v8-games-upgrade → main sync PR when ready.

## 12. VERIFICATION COMMANDS
```
node --check src/server.js
tools/fresh-api.sh tools/e2e-api.js            # also: e2e-payments, e2e-cosmetic-orders, e2e-economy, e2e-avatars, e2e-sponsor-brands, e2e-tiebreak, e2e-i18n
tools/fresh-api.sh tools/test-systems-v8.js    # + test-security-v8, test-audience-v8, test-admin-v8
STRIPE_API_BASE=http://127.0.0.1:8798 STRIPE_SECRET_KEY=sk_test_x STRIPE_WEBHOOK_SECRET=whsec_testsecret PUBLIC_URL=https://example.test tools/fresh-api.sh tools/e2e-stripe.js
BASE=http://localhost:8795 node tools/e2e-games-lib.js <slug>
bash tools/mem-check.sh                        # peak must stay < 100 MB
BASE=http://127.0.0.1:8899 PID=<server pid> DB=/tmp/load/hub.db USERS=3000 STAGES="100:3000" node tools/loadtest.js   # LOCAL only (bash tools/loadsrv.sh starts the server)
npm audit --omit=dev
curl -s https://glassy-drifter-9532.de.deplexo.com/healthz   # live smoke, no load
```
Also read: docs/RELEASE-REPORT.md, docs/SYSTEMS-PLAN.md, docs/GAME-STATUS.md (on the branch), docs/GAMES-LIB.md, docs/ECONOMY.md, DEPLOY-DEPLEXO.md.
