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
Signed-in players' runs are scored automatically when they die. Guests can play practice runs, but those scores aren't saved.

**Create a giveaway:** go to Admin, then Giveaways, then New Giveaway. Fill in the title, host, prize, image (pick one or paste a URL),
start and end date/time (in your browser's time zone), entry method "Play Games", the linked game, the rules and the Active toggle, then click Save.
Every signed-in player who **starts and finishes** a run of the linked game inside the window is an entrant.
Higher scores rank higher. A run that starts before the start time or is submitted after the end time is saved to the global
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
  has been tampered with, or has expired (2 hours). Scores above `30 m/s × server-measured elapsed time + 25 m` are rejected,
  and so are implausible coin counts. The game's top speed is 24 m/s.
- Rate limits: 20 run starts per minute per player (40 per IP) and 30 score submissions per minute per IP. Login, signup and booking
  are rate-limited per IP. IPs are stored only as salted hashes.
- Limitation: it's a client-side game, so a skilled cheater can still script plausible scores. Use the admin tools (ban, top-N
  review, runs CSV) before paying out prizes.

## API (summary)
`POST /api/auth/signup|signin|signout`, `GET /api/me`, `GET /api/games`,
`GET /api/leaderboard?game=global|jetpack-dash&period=all|weekly|monthly&giveaway=ID`,
`POST /api/run/start`, `POST /api/score`, `GET /api/giveaways?status=active|upcoming|past`, `GET /api/giveaways/:id`,
`GET /api/profile/:username`, `GET /api/community`, `POST /api/bookings`, and `/api/admin/*` (cookie session after `POST /api/admin/login`).

## File layout
```
src/server.js        Express app: auth, runs/anti-cheat, leaderboards, giveaways, bookings, admin API, CSV, static
src/db.js            SQLite schema (better-sqlite3), database at $DATA_DIR/hub.db (default data/hub.db)
src/config.js        env/.env loader, secrets, game catalog, anti-cheat constants
src/demo.js          demo seed/wipe
public/index.html    player SPA shell; public/js/app.js (router and all pages), public/js/jetpack.js (game)
public/admin.html    admin SPA; public/js/admin.js, public/css/admin.css
public/css/app.css   theme (dark navy, neon purple-to-blue, glowing cards, bottom tab nav)
public/assets/       brand/, cards/, giveaways/, badges/, packages/, avatars/ (from mockups), game/ + sfx/ (Kenney CC0)
public/fonts/        Orbitron + Exo 2 (OFL)
mockups/             the owner's original mockup PNGs (reference only, not served)
tools/               extract_mockup_art.py, render-cover.js, e2e-api.js, e2e-browser.js, compare.py
screenshots/         mobile-*.png, desktop-*.png, compare/ (generated by the tests, git-ignored)
scripts/             start/stop/restart scripts
.env                 local dev secrets (chmod 600, git-ignored); see .env.example
render.yaml          Render Blueprint (web service + 1 GB disk at /data)
Dockerfile           container alternative (volume at /data)
```

## Tests
```bash
node tools/e2e-api.js                      # 58 API checks (BASE=... to point elsewhere); cleans up after itself
node tools/e2e-browser.js                  # 50 headless-Chrome checks + screenshots; cleans up after itself
python3 tools/compare.py                   # mockup vs built side-by-side images
```
