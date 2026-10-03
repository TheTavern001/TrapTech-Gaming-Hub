# The Gaming Hub by Trap Tech Solutions

Mobile-first game hub with accounts, leaderboards, giveaways, a booking request system and an admin dashboard, designed,
built and operated by **Trap Tech Solutions**. 8 original HTML5 games, daily quests, login streaks, XP levels, a free season
track, tournaments (timed and bracket), friends, notifications, share cards and invite codes. Everything is **points and
cosmetics only, with no real money**. Adults only (21+). See `RESEARCH.md` for the v3 feature-gap research and sources.

- Local URL: http://localhost:8787 (port is set by `PORT` in `.env` or the environment)
- Public leaderboard: `/leaderboard` · Giveaways: `/giveaways` · Admin: `/admin` (password = `ADMIN_PASSWORD` env var / `.env`)

## Run / restart
```bash
./scripts/start-server.sh      # background server with auto-restart on crash (logs/server.log)
./scripts/restart-server.sh    # restart after code or .env changes
./scripts/stop.sh [server|tunnel]
./scripts/start-tunnel.sh      # Cloudflare quick tunnel (URL changes every restart) - see "Public URL" below
```
These are plain `nohup` background processes, so they stop if the machine reboots. Run `start-server.sh` again after a reboot.

## Public URL
`scripts/start-tunnel.sh` runs `cloudflared tunnel --protocol http2 --url http://localhost:8787` and writes the
`https://*.trycloudflare.com` URL to `logs/public-url.txt`. **On this box it can't connect:** outbound traffic only gets through
on HTTPS/443 via a proxy, and cloudflared needs port 7844 (QUIC/UDP and HTTP/2 both timed out). Tunnelmole (needs port 8083),
SSH tunnels like localhost.run, serveo and pinggy (need raw TCP), localtunnel (random high port) and bore (7835) are also blocked.
On a host with normal outbound access the script works as-is. For a permanent URL, deploy to Render (see below).

## Configuration (environment variables)
All settings come from environment variables. Locally, `src/config.js` also reads a `.env` file (copy `.env.example`); real env vars win over `.env`.
`.env` is git-ignored and is never committed.

| Variable | Required | Purpose |
| --- | --- | --- |
| `ADMIN_PASSWORD` | yes | Password for `/admin` |
| `SECRET` | yes* | One random secret. Session-cookie and anti-cheat run-token secrets plus the IP-hash salt are derived from it |
| `SESSION_SECRET`, `RUN_SECRET`, `IP_SALT` | no | *Use these instead of `SECRET` if you prefer (each one overrides the derived value) |
| `PORT` | no | HTTP port (default 8787; Render sets this for you) |
| `DATA_DIR` | no | Folder for the SQLite file `hub.db` (default `./data`; `/data` on Render) |
| `DB_PATH` | no | Full path to the SQLite file (overrides `DATA_DIR`) |

If you change the secrets, everyone is signed out and runs that are still in progress get rejected. `GET /healthz` returns `{"ok":true}` (it's the health check).

## Deploy to Render (recommended)
`render.yaml` is a Render Blueprint: a Node web service on the **Starter** plan with a **1 GB persistent disk** at `/data` (the SQLite DB).
1. Push this repo to GitHub (private is fine).
2. In Render: **New > Blueprint**, connect your GitHub account, pick the repo, then click **Apply**.
3. When Render prompts for **`ADMIN_PASSWORD`**, enter a long random password. `SECRET` is generated automatically.
4. Wait for the deploy to finish, then open `https://gaming-hub-xxxx.onrender.com` (the exact URL is shown on the service page).
   The site starts empty (no demo data). Sign in to `/admin` and create your first giveaway.
5. Optional: add a custom domain under the service's Settings > Custom Domains.

**Cost:** Starter is about $7/mo, plus $0.25/GB/mo for the disk ($0.25 for 1 GB), so about **$7.25/mo**. Render takes daily disk snapshots.
**Free plan tradeoff:** Render's free web services can't have a disk. If you set `plan: free` and remove the `disk:` block, the
database is **erased on every restart or redeploy**, and the service sleeps after 15 min idle (the first visit then takes about 30-60 s).
Only use that for a throwaway preview. A disk also limits the service to 1 instance, and each deploy has a few seconds of downtime.

**Demo data in production:** nothing is seeded automatically. To show sample content, use Admin > Settings > Load demo data,
or run `npm run demo:seed` in the Render Shell. Remove it with Wipe demo data / `npm run demo:wipe`.

**Backups:** download CSVs from Admin > Reports, or take a consistent DB copy in the Render Shell:
`node -e "require('better-sqlite3')('/data/hub.db').backup('/data/hub-backup.db').then(()=>console.log('ok'))"`.

### Docker alternative
```bash
docker build -t gaming-hub .
docker run -d -p 8787:8787 -v hubdata:/data -e ADMIN_PASSWORD='long-random-password' -e SECRET="$(openssl rand -base64 32)" gaming-hub
```
This works on Fly.io, Railway or any VPS. Always mount a volume at `/data`, or the database is lost when the container is replaced.

## Using it
**Players:** open the site, then choose Get Started (sign up with a Potato username and password) or Continue as Guest.
Signed-in players' runs are scored automatically when the run ends (or from Pause > **End run & save score**). Guests can play
practice runs, but those scores aren't saved.

### Games (all 12 playable)
Every game is an original HTML5 canvas game (touch + mouse + keyboard) built on `public/js/games/engine.js`, and every one uses the
same signed run-token flow. Casino-style games use **free points only**: no real money, no purchases, no cash value.

| Game | How it scores | Per-game cap (server) |
|---|---|---|
| Jetpack Dash | meters flown | 30 m/s + 25 |
| Drift Rush | meters driven + banked drift points (drift x chain up to x4; lost if you go off-road or hit a cone). 45 s timer, +10 s per 1,000 m, nitro orbs | 240/s + 200 |
| Plinko | 10 free chips; slot values 200/50/20/5/100/5/20/50/200; aim + 3 nudges per chip; golden pegs x2 then x4 | 700/s + 900, max 8,000 |
| Spin to Win | 5 free spins (BONUS adds one, max 8); hold-to-charge power meter, same power = same landing; x2 doubles the next spin; BUST = 0 | 700/s + 2,000, max 16,000 |
| Memory Match | 100 x combo (up to x5) per pair + 10 per second left on clear; levels grow 4x3 to 6x5; time runs out = end | 1,100/s + 500 |
| High Score | reflex targets: (10 + up to 15 accuracy) x combo multiplier (up to x5), gold = x2, bombs/misses cost 1 of 3 lives | 900/s + 300 |
| Blazed Roulette | 1,000 free chips, 8 spins, max 100 per spin (10 on 0); timed DROP lands within 2 pockets of the marker; score = chips left | 120/s + 1,000, max 3,800 |
| Terp Tapper | 4-lane rhythm: perfect 100 / great 60 / good 30 x combo multiplier (up to x4); 5 lives; tempo rises 96 to 168 BPM | 3,000/s + 500 |
| Stack 2048 (v5) | slide-and-merge chips; score = value of every merge; run ends when no move is possible | 150/s + 400 |
| Munchies Snake (v5) | 10 per bite (+5 per 10 segments), gold coin +50; wall/tail = end | 60/s + 150 |
| Brick Breaker (v5) | 10 per brick (gold 50) x level x chain (up to x4) + level-clear bonus; 3 balls | 600/s + 600 |
| Sky Hopper (v5) | towers passed; one hit ends the run | 1.6/s + 5, max 100,000 |

Caps live in `src/config.js` (`GAMES[].ac`) and are checked against **server-measured** run time; `tiers` are the
Bronze/Silver/Gold thresholds used by achievements.

### Achievements & cosmetics (cosmetic only, no cash value)
`src/achievements.js` defines **84 achievements** in 6 categories: game milestones (5 per game: bronze/silver/gold score, 10 runs,
3-run streak), overall (runs, total points, days played, variety), giveaways (enter 1/5/25, podium, win 1/3), community (hype posts,
equip cosmetics, collector), leaderboards (weekly top 10/3/1, monthly #1, global top 10, #1 in 3 games) and 9 hidden secrets.
They are evaluated **on the server** after every accepted run, signup, equip, hype, admin draw and profile view, from data the server
already validated; the client can't claim an unlock. Rarity = % of players who have it.
Every unlock gives a badge plus a cosmetic from `src/cosmetics.js`: **39 profile banners, 19 avatar frames, 35 titles** (all original
CSS/SVG, served as `/cosmetics.css`). Players equip a banner, frame, title and featured badge on their profile (Customize); these
show on leaderboards, giveaway entrants, home and community posts.

### Giveaway packages (/host)
Basic / Premium / Elite tiers with "who it's for", feature lists, a 13-row comparison table and an FAQ. Names, prices
(placeholders $49 / $149 / $399), notes, badges, features, the comparison table and the FAQ are all editable in
**Admin > Settings > Hosting packages** (stored in the `settings` table; "Reset to defaults" restores `src/packages.js`).
The booking form carries the chosen tier and the server stores a price snapshot (e.g. "Elite - $399 per 30-day campaign").

**Create a giveaway:** fastest way: Admin > **Games** > **Create giveaway for this game** (prefilled title, art, game and a 7-day
window). Or Admin > Giveaways > New Giveaway. Pick one or more games in the visual game picker, then title, host, prize, image,
start/end (browser time zone), package tier, brand color + logo URL, Featured toggle (home slot; Elite + Featured = home hero takeover),
minimum score, prize tiers (one per line) and rules, then Save.
**One-click linking:** each game card in Admin > Games lists live/upcoming giveaways with an on/off toggle; flip it to make that game
count (a giveaway always keeps at least one game).
Every signed-in player who **starts and finishes** a run of any linked game inside the window (and meets the minimum score) is an
entrant. With several games, the giveaway score is the sum of the player's best score in each linked game. Higher scores rank higher. A run that starts before the start time or is submitted after the end time is saved to the global
boards but doesn't count for that giveaway.

**Draw winners:** open Admin, go to Giveaways, and click Manage on the giveaway.
- **Draw Random Winner**: a uniform random pick (Node `crypto.randomInt`) among entrants who haven't won this giveaway yet.
- **Pick Top N**: takes the N highest-scoring entrants who haven't been drawn yet.
- **Entrants - Top N view**: shows the top N entrants. **Export CSV** downloads every entrant with a winner flag. **Clear winners** resets the draw.
Winners show up on the public giveaway page, in the Community feed and in each winner's profile stats.

**Other admin pages:** Dashboard (stats and recent activity), Games, Bookings (change status, add notes, export CSV), Players (search,
ban, reset password, delete), Leaderboards (global or per game, all time / 7 days / 30 days, export CSV), Announcements (post to the
Community feed), Reports (CSV exports and rejected anti-cheat submissions), Settings (wipe or load demo data).

### v3: engagement, social, PWA, legal (all points/cosmetic only)
- **21+ age gate**: a neutral date-of-birth screen on first visit (not a yes/no button). It is remembered in localStorage for 30 days, and under-21 is blocked for the session.
  Signup sends the DOB and the **server** rejects anyone under 21 (`403 underage`). `birth_date` is stored. Legal pages (/terms,
  /privacy, /rules, /responsible-play, /about) stay readable without passing the gate. Limitation: the gate itself is client-side
  (it's a content notice). The enforced check is at signup, and real prize winners should be verified with ID before fulfilment.
- **XP and levels** (`src/progress.js`): each run gives 10 XP plus 10 per tier reached, achievements give 25-400, and quests and check-ins add more.
  Level L needs 100·(L-1)·L/2 XP in total. Level-ups show a toast, post a notification and (every 5th level) appear in the community feed.
- **Daily check-in streaks**: opening the home page checks you in (+20 XP, +5 per streak day up to +50). `/quests` shows the streak.
- **Daily quests**: everyone gets the same 3 quests each day (midnight ET reset). They are claimed for XP, and an all-clear bonus adds +100 XP.
- **Seasons**: calendar quarters. Season 1 "Neon Genesis" runs Oct 1 - Dec 31 2026, with 20 tiers × 300 season XP, a **free track only**
  (no paid pass) and cosmetic rewards at tiers 3/5/10/20. There's also a season leaderboard.
- **Tournaments** (`src/tournaments.js`, Admin > Tournaments): *timed* events rank the best single score in a window. *Brackets* run
  a qualifying window, then the top 8 play 3 async knockout rounds (QF/SF/Final). In each round the higher best score inside the round
  window advances, and ties go to the higher seed. Creating a tournament broadcasts a notification. Prizes are cosmetic unless you link a real giveaway.
- **Friends**: follow/unfollow on profiles, follower/following sheets, a **Friends** toggle on leaderboards (you plus the players you follow),
  and a Community "Following" tab.
- **Notifications center** (`/notifications`, bell badge): achievements, level-ups, follows, referrals, giveaway wins, plus
  broadcasts (new giveaways, tournaments, announcements).
- **Invites/referrals**: every player gets a code (`/invite`, `/r/CODE`). A referral counts once the friend finishes a first scored
  run, and unlocks Crew Builder (1), Squad Goals (5) and Party Starter (15) cosmetics. The friend also gets the "Newcomer" title.
- **Share cards**: each saved run has `/s/:id`, a score card page with its own OG/Twitter meta. OG images are rendered as PNGs on the server
  with resvg: `/og/default.png`, `/og/run/:id.png`, `/og/giveaway/:id.png`, `/og/u/:name.png`, `/og/tournament/:id.png` (1200×630,
  Trap Tech "Built by" footer). Giveaway, profile and tournament pages have share buttons. Sharing unlocks "Hype Sharer".
- **Search** (`/search`): games, players, giveaways and tournaments.
- **PWA**: `manifest.webmanifest` ("The Gaming Hub by Trap Tech Solutions", 192/512/maskable icons, shortcuts) and `sw.js`, which uses
  network-first and caches the app shell for offline. It never caches `/api`, `/og` or `/admin`. Settings has an Install button and a reduce-motion toggle.
- **Legal templates**: `/terms`, `/privacy`, `/rules` (Official Giveaway Rules template) and `/giveaways/:id/rules` (filled-in rules
  per giveaway: NO PURCHASE NECESSARY, 21+, US/DC, the host as Sponsor, **Trap Tech Solutions as operator/administrator**, dates, free
  entry method, skill/random selection, odds, notification, winners list), plus `/responsible-play`. **These are templates. Have counsel
  review them before running prize promotions.** The rules state that no cannabis/THC/nicotine/alcohol products are awarded as prizes.
- **Trap Tech branding**: the age gate, splash ("Built by"), sign-in and sign-up ("Powered by Trap Tech"), the footer on every page (full on
  desktop, compact on mobile) and the drawer, the game loading screen ("A Trap Tech game"), achievements ("Achievement system by
  Trap Tech"), the host page ("Trap Tech Solutions builds your brand's game"), the booking confirmation, the admin header and login ("Powered by Trap Tech
  Solutions"), giveaway rules (operator), `/about`, page titles and meta author, OG images and the PWA manifest.
- **UX polish**: skip link, focus-visible rings, aria labels, live regions, reduced-motion support, skeleton loaders, empty states,
  page-in animations, an offline banner, and wider desktop grids. There's also a "more" menu on desktop.

### v4: giveaways with 100+ players: clear winners, locked results, live tracking
- **Deterministic winner rules.** Score giveaways rank each entrant by their best qualifying score. A qualifying run starts and finishes inside the window,
  meets the minimum score and is within the game's plausibility cap for its server-measured duration; with several linked games it is the sum of the best per game.
  Tiebreakers, shown on the giveaway page, the live board and in Official Rules section 5:
  (a) higher score wins; (b) if tied, whoever reached that score first (server timestamp of the run that set it); (c) then fewer attempts (runs in the window);
  (d) then the earlier-submitted run (lower run ID). Every place is unique.
- **Verifiable random draws** (`win_method=random`) use commit-reveal. When the giveaway is created, the server picks a secret seed and publishes
  `draw_commit = SHA-256(seed)`. At the end it locks the entrant list, publishes `entrants_hash = SHA-256(lines "rank|username|score|run_id|reached_at|attempts")`
  and reveals the seed. Draw keys are `HMAC-SHA256(seed, entrants_hash + ":" + username)`, sorted ascending. One entry per player, so nobody can be drawn twice.
  `/giveaways/:id/results` re-checks the hash, the commitment and the draw order in the browser (WebCrypto).
- **Final standings lock.** A 15 s sweep (and any read of an ended giveaway) snapshots the standings into `giveaway_results`
  (rank, username, best score, run id, reached-at, attempts, draw key/position). SQLite triggers block UPDATE/DELETE on it, so late or back-dated scores can't change it.
  After the lock, dates, games, minimum score and winner rules are read-only (409). Winners show as **"Winner pending verification"** until an admin confirms.
- **Admin winner workflow** (Admin > Giveaways > manage). The review queue shows the top N (default 10) with every run: client vs server duration, score rate vs the
  game's per-second cap, % of cap, IP/device hashes and flags (same IP + device as another account, shared IP hash, over-cap runs, near-cap, duration mismatch,
  new account). It also lists runs excluded for breaking the cap. Actions: **Confirm winner**, **Disqualify** (reason required; the next place is promoted
  automatically and notified), Reinstate, and **End now & lock results**. Everything is written to an audit log shown on the page. Winners get in-app
  notifications for provisional, promoted, confirmed and disqualified.
- **Live score tracking.** `/giveaways/:id/live` shows "You are #X of N", best score, attempts, gap to the next place and to a winning place, with 10 s polling,
  25 per page, username search and "jump to me". `/giveaways/:id/results` is a printable / save-as-PDF results page.
- **Exports**: `GET /api/admin/export/giveaway/:id/runs.csv` (every entrant with every run in the window, cap/over-cap/counted columns) and
  `.../final.csv` (locked standings with place, DQ reason and winner state).
- **Scale test**: `node tools/e2e-scale.js` seeds 300 players and ~3,500 runs (designed ties, an over-cap cheat run, and an alt account on a shared IP + device).
  It checks every rank against an independent recomputation, API latency, the automatic lock, late-score immutability, disqualify/promote/confirm, CSVs and the
  random draw. It saves screenshots to `screenshots/v4/` and removes everything afterwards.

## Demo data
Sample players such as BlazedKing and TerpQueen, sample giveaways ("$250 Store Credit", "PS5 + Games Bundle", ...), 2 bookings,
1 announcement, 3 tournaments (live timed cup, bracket, upcoming), follows, streaks and broadcast notifications are tagged **DEMO** in the UI (`is_demo=1` in the database). Remove them with Admin > Settings > Wipe demo data, or
`npm run demo:wipe`. Load them again with `npm run demo:seed`. Demo accounts have random passwords, so nobody can log into them.

## Anti-cheat (basic)
- `POST /api/run/start` (signed-in only) returns an HMAC-signed, single-use run token tied to the player and game.
- `POST /api/score` must include the token. Requests are rejected if the token belongs to another player, was already used,
  has been tampered with, or has expired (2 hours). Each game has its own caps (table above): scores above
  `perSec x server-measured elapsed seconds + grace`, above the game's absolute `max`, or with implausible coin counts are rejected.
- Rate limits: 20 run starts per minute per player (40 per IP) and 30 score submissions per minute per IP. Login, signup and booking
  are rate-limited per IP. IPs are stored only as salted hashes.
- Limitation: it's a client-side game, so a skilled cheater can still script plausible scores. Use the admin tools before paying out prizes:
  the winner review queue (flags, per-run rate vs cap, shared IP/device), ban, and the runs CSV. Giveaway standings also re-check every run against the caps,
  so a run inserted past the API is excluded and flagged.

## API (summary)
`POST /api/auth/signup|signin|signout`, `GET /api/me`, `GET /api/games`,
`GET /api/leaderboard?game=global|jetpack-dash&period=all|weekly|monthly&giveaway=ID`,
`POST /api/run/start`, `POST /api/score`, `GET /api/giveaways?status=active|upcoming|past`, `GET /api/giveaways/:id`,
`GET /api/profile/:username`, `GET /api/community`, `POST /api/community/react {key}`, `GET /api/packages`, `POST /api/bookings {package,...}`,
`GET /api/achievements[?user=]`, `GET /api/cosmetics`, `POST /api/me/cosmetics {banner,frame,title,badge}`, `GET /cosmetics.css`,
and `/api/admin/*` (cookie session after `POST /api/admin/login`), incl. `GET /api/admin/games` (with linked giveaways),
`POST /api/admin/giveaways/:id/games {game_id, linked}`, `GET|PUT /api/admin/packages`, `POST /api/admin/packages/reset`, `GET /api/admin/achievements`.
v3: `POST /api/checkin`, `GET /api/quests`, `POST /api/quests/:idx/claim` (3 = bonus), `GET /api/season`, `GET /api/tournaments[/:id]`,
`POST|DELETE /api/follow/:username`, `GET /api/follows/:username?type=followers|following`, `GET /api/leaderboard?...&friends=1`,
`GET /api/notifications`, `POST /api/notifications/read {id?}`, `GET /api/referral`, `GET /r/:code`, `POST /api/share {kind,ref}`,
`GET /api/runs/:id`, `GET /api/search?q=`, `GET /og/...png`, `GET|POST /api/admin/tournaments`, `PUT|DELETE /api/admin/tournaments/:id`.
Signup now requires `dob: 'YYYY-MM-DD'` (21+) and accepts `ref`.
v4: `GET /api/giveaways/:id/standings?page=&per=&q=&around=me` (rows, total, me {rank, of, score, attempts, gap_to_next, gap_to_win}, winners + states, tiebreak rules),
`GET /api/giveaways/:id/verify`, admin `GET /api/admin/giveaways/:id/review?n=10`, `GET .../audit`, `POST .../finalize|confirm|disqualify|reinstate {user_id|username, reason}`,
`GET /api/admin/export/giveaway/:id/runs.csv|final.csv`. Giveaway create/update accepts `win_method` (score|random) and `winner_count` (0 = one per prize tier).

## File layout
```
src/server.js        Express app: auth, runs/anti-cheat, leaderboards, giveaways, bookings, admin API, CSV, static
src/db.js            SQLite schema (better-sqlite3), database at $DATA_DIR/hub.db (default data/hub.db)
src/config.js        env/.env loader, secrets, game catalog, anti-cheat constants
src/demo.js          demo seed/wipe
src/boards.js        leaderboards + giveaway entrants (multi-game, min score) + campaign stats
src/achievements.js  105 achievements (8 categories), server-side evaluation, rarity, unlock notifications
src/progress.js      XP/levels, check-in streaks, daily quests, seasons
src/tournaments.js   timed boards + async 8-seed brackets
src/notify.js        notifications (per-user + broadcast)
src/og.js            OG/share image renderer (resvg), fonts in src/og-fonts/
src/results.js       v4 standings (tiebreaks, cap re-check), final-standings lock, commit-reveal draws, confirm/disqualify/promote, audit
src/v4.js            v4 routes (live standings, verify, admin review queue, finalize, exports)
src/v3.js            v3 routes (quests, season, tournaments, follows, notifications, referrals, share, search, OG, admin tournaments)
src/cosmetics.js     banners / frames / titles (original CSS) -> /cosmetics.css
src/packages.js      default Basic/Premium/Elite package copy (admin-editable)
public/index.html    player SPA shell (per-page meta injected server-side), manifest.webmanifest + sw.js (PWA); public/js/app.js (router and all pages), public/js/jetpack.js (Jetpack Dash)
public/js/games/     engine.js (shared canvas game base + WebAudio synth) and the 7 other games
public/admin.html    admin SPA; public/js/admin.js, public/css/admin.css
public/css/app.css   theme (dark navy, neon purple-to-blue, glowing cards, bottom tab nav)
public/assets/       brand/, cards/, giveaways/, badges/, packages/, avatars/ (from mockups), game/ + sfx/ (Kenney CC0)
public/fonts/        Orbitron + Exo 2 (OFL)
mockups/             the owner's original mockup PNGs (reference only, not served)
tools/               extract_mockup_art.py, render-cover.js, e2e-api.js, e2e-browser.js, e2e-scale.js, compare.py
screenshots/         mobile-*.png, desktop-*.png, v2/, v3/, v4/ (m*-*.png = mobile 390x844, d*-*.png = desktop 1440x900), compare/ (generated by the tests, git-ignored)
scripts/             start/stop/restart scripts
.env                 local dev secrets (chmod 600, git-ignored); see .env.example
render.yaml          Render Blueprint (web service + 1 GB disk at /data)
Dockerfile           container alternative (volume at /data)
```

## Tests
```bash
node tools/e2e-api.js                      # API checks incl. every game, linking, packages, achievements (BASE=... to point elsewhere)
node tools/e2e-browser.js                  # headless-Chrome checks + screenshots (screenshots/, v2/, v3/); both clean up after themselves
# signup is limited to 10/hour per IP (in memory): run ./scripts/restart-server.sh before re-running the browser test
node tools/e2e-scale.js                    # v4 scale test: 300 players / ~3.5k runs, ranking + tiebreaks, lock, DQ/promote, latency, screenshots/v4/
python3 tools/compare.py                   # mockup vs built side-by-side images
```


## How to open the hub in Potato

1. **Share the link in any Potato chat/channel** (e.g. `https://<your-domain>/`). Tapping it opens the hub in Potato's built-in browser - no install needed. Everything works there: sign-up, every game, giveaways, sharing (copy sheet when the system share sheet isn't available).
2. **Pin it in your channel**: post the link with a short line ("Play free, win prizes") and pin the message so members can reopen it any time.
3. **As a bot game (optional)**: create a bot with Potato's bot creator, register a game with `/newgame`, send it with `sendGame` and answer the game callback with the hub URL (e.g. `https://<your-domain>/play/jetpack-dash`). Potato opens it in its built-in browser. (Potato has no Telegram-style mini-app SDK; the hub needs none.)
4. If a phone's in-app browser blocks cookies/storage, the hub keeps you signed in for that visit via an in-memory session; open in Safari/Chrome (menu > "Open in browser") to stay signed in between visits.
5. Test locally: `node tools/e2e-mobile.js` (Pixel 7, iPhone 14, Android WebView, iOS in-app, locked WebView).
