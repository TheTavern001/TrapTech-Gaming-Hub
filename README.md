# The Gaming Hub by Trap Tech Solutions

Mobile-first game hub with accounts, leaderboards, giveaways, a booking request system and an admin dashboard.
The first playable game is **Jetpack Dash**, an original HTML5 canvas side-scroller. Other games are "Coming soon" cards.

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

### Games (all 8 playable)
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

## Demo data
Sample players such as BlazedKing and TerpQueen, sample giveaways ("$250 Store Credit", "PS5 + Games Bundle", ...), 2 bookings and
1 announcement are tagged **DEMO** in the UI (`is_demo=1` in the database). Remove them with Admin > Settings > Wipe demo data, or
`npm run demo:wipe`. Load them again with `npm run demo:seed`. Demo accounts have random passwords, so nobody can log into them.

## Anti-cheat (basic)
- `POST /api/run/start` (signed-in only) returns an HMAC-signed, single-use run token tied to the player and game.
- `POST /api/score` must include the token. Requests are rejected if the token belongs to another player, was already used,
  has been tampered with, or has expired (2 hours). Each game has its own caps (table above): scores above
  `perSec x server-measured elapsed seconds + grace`, above the game's absolute `max`, or with implausible coin counts are rejected.
- Rate limits: 20 run starts per minute per player (40 per IP) and 30 score submissions per minute per IP. Login, signup and booking
  are rate-limited per IP. IPs are stored only as salted hashes.
- Limitation: it's a client-side game, so a skilled cheater can still script plausible scores. Use the admin tools (ban, top-N
  review, runs CSV) before paying out prizes.

## API (summary)
`POST /api/auth/signup|signin|signout`, `GET /api/me`, `GET /api/games`,
`GET /api/leaderboard?game=global|jetpack-dash&period=all|weekly|monthly&giveaway=ID`,
`POST /api/run/start`, `POST /api/score`, `GET /api/giveaways?status=active|upcoming|past`, `GET /api/giveaways/:id`,
`GET /api/profile/:username`, `GET /api/community`, `POST /api/community/react {key}`, `GET /api/packages`, `POST /api/bookings {package,...}`,
`GET /api/achievements[?user=]`, `GET /api/cosmetics`, `POST /api/me/cosmetics {banner,frame,title,badge}`, `GET /cosmetics.css`,
and `/api/admin/*` (cookie session after `POST /api/admin/login`), incl. `GET /api/admin/games` (with linked giveaways),
`POST /api/admin/giveaways/:id/games {game_id, linked}`, `GET|PUT /api/admin/packages`, `POST /api/admin/packages/reset`, `GET /api/admin/achievements`.

## File layout
```
src/server.js        Express app: auth, runs/anti-cheat, leaderboards, giveaways, bookings, admin API, CSV, static
src/db.js            SQLite schema (better-sqlite3), database at $DATA_DIR/hub.db (default data/hub.db)
src/config.js        env/.env loader, secrets, game catalog, anti-cheat constants
src/demo.js          demo seed/wipe
src/boards.js        leaderboards + giveaway entrants (multi-game, min score) + campaign stats
src/achievements.js  84 achievements, server-side evaluation, rarity
src/cosmetics.js     banners / frames / titles (original CSS) -> /cosmetics.css
src/packages.js      default Basic/Premium/Elite package copy (admin-editable)
public/index.html    player SPA shell; public/js/app.js (router and all pages), public/js/jetpack.js (Jetpack Dash)
public/js/games/     engine.js (shared canvas game base + WebAudio synth) and the 7 other games
public/admin.html    admin SPA; public/js/admin.js, public/css/admin.css
public/css/app.css   theme (dark navy, neon purple-to-blue, glowing cards, bottom tab nav)
public/assets/       brand/, cards/, giveaways/, badges/, packages/, avatars/ (from mockups), game/ + sfx/ (Kenney CC0)
public/fonts/        Orbitron + Exo 2 (OFL)
mockups/             the owner's original mockup PNGs (reference only, not served)
tools/               extract_mockup_art.py, render-cover.js, e2e-api.js, e2e-browser.js, compare.py
screenshots/         mobile-*.png, desktop-*.png, v2/ (mobile 390x844 shots of the v2 features), compare/ (generated by the tests, git-ignored)
scripts/             start/stop/restart scripts
.env                 local dev secrets (chmod 600, git-ignored); see .env.example
render.yaml          Render Blueprint (web service + 1 GB disk at /data)
Dockerfile           container alternative (volume at /data)
```

## Tests
```bash
node tools/e2e-api.js                      # API checks incl. every game, linking, packages, achievements (BASE=... to point elsewhere)
node tools/e2e-browser.js                  # headless-Chrome checks + screenshots (screenshots/, screenshots/v2/); both clean up after themselves
python3 tools/compare.py                   # mockup vs built side-by-side images
```
