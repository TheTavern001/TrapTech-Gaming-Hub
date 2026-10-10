# Deploying The Gaming Hub on Deplexo (free plan)

This is the runbook for hosting the hub on Deplexo's **free plan** at $0 with no card. It covers what was changed so the app fits, the exact deploy steps, backups, and the fallback options.

> Checked on 2026-10-03 against https://deplexo.com/plans and https://docs.deplexo.com.
> Free plan: **1 project, 0.25 CPU, 128 MB RAM, 250 MB disk, 10 Mbit/s, 100 GB/month transfer**, a platform subdomain only (no custom domain), community support, no card, no sleeping.
> Runtime: **read-only root filesystem**, unprivileged user, a persistent volume (default `/data`, **noexec**), and a writable **`/tmp` capped at 100 MB, noexec, wiped on redeploy**. One region (EU, Germany). Single instance. No managed databases.

## 1. Does it fit? Measured numbers

The load test (`tools/deplexo/loadtest.js`) runs 50 concurrent players for 60 s. Each one signs up, then loops through leaderboards (per game and global), run start, `/api/me`, achievements and score submit. It also hits share pages, profiles, giveaways and community, and requests **OG share images**. Every new run id is a cache-miss render, so this is a worst case far beyond real crawler traffic.

| Setup | Idle RSS | Peak RSS (VmHWM) | Peak anon (heap + native) | cgroup peak | Result |
|---|---|---|---|---|---|
| **Before**, original code, no cap, full CPU | 76–83 MB | **475 MB** (457 MB still held 15 s later) | — | — | Would not fit |
| **Before**, original code, **128 MB / 0.25 CPU cgroup** | 74 MB | — | 121 MB | 128 MB (limit) | **OOM-killed** mid-test (`oom_kill 1`), 165 connection errors |
| **After**, 128 MB / 0.25 CPU cgroup, read-only app dir | 71 MB | 106 MB | 50 MB | 97 MB | 0 OOM, 0 errors, 0 5xx |
| **After**, **Docker**: `--read-only --memory 128m --memory-swap 128m --cpus 0.25`, cap-drop ALL, noexec `/tmp` | 65 MB (anon 16 MB) | **98 MB** | **43 MB** | **81 MB** | 0 OOM, 0 errors, 0 5xx, healthcheck `healthy` |
| After, 128 MB / 0.25 CPU, API only (no OG requests) | 71 MB | 90 MB | 41 MB | 46 MB | 41.6 req/s, p50 395 ms, p95 1.5 s |

About **50 MB of RSS is file-backed** (the node binary and ICU data mapped from the image). The kernel can drop and re-read those pages under pressure, so they are not "used" memory the way heap is. The real working set is the anon column: about 16 MB at idle and about 45 MB at peak, against a 128 MB limit.

**CPU, not RAM, is the limit at 0.25 CPU.** Under the OG-heavy test, an uncached share image takes about 15 s at p95 while 50 users all render unique cards at once. A single render takes about 1.2 s of full CPU, which is about 5 s at 0.25 CPU. Signup takes about 9 s while 50 people sign up at the same moment, because bcrypt is CPU-bound. Normal API calls stay well under 1 s at p50. Real traffic (a few players, a crawler fetching a card now and then) is far lighter. If the hub gets busy, Deplexo Starter ($5/month, 0.5 CPU / 512 MB) is the straightforward upgrade.

### What changed to get there (functionality unchanged)

- **OG share images** (`src/og.js`):
  - `@resvg/resvg-js` is lazy-loaded on the first render.
  - Rendering is one at a time, with an explicit GC afterwards so resvg's native buffers are freed right away instead of whenever V8 gets around to it.
  - PNGs are cached **on disk** in `$DATA_DIR/og-cache` (LRU, capped by `OG_CACHE_MAX_MB`, default 30), streamed from the file, and concurrent requests for the same image share one render. Before, up to 300 PNGs of about 470 KB each (~140 MB) were held in RAM.
  - The art embedded in the cards is pre-scaled at build time, and the static default card is pre-rendered at build time.
  - Output was pixel-compared with the old renderer: max difference 2/255, i.e. visually identical.
- **Build step** (`scripts/deplexo-prebuild.js`, run in the Dockerfile): pre-gzips the static text assets into `build/gz` (served by `src/static-gz.js`, so there is no on-the-fly compression for those). It also pre-scales the OG art and pre-renders `og/default.png`. It writes only to `$BUILD_DIR`, never into `public/`.
- **SQLite** (`src/db.js`):
  - `cache_size` 2 MB, `mmap_size=0`, `temp_store=FILE` (temp files go to `$DATA_DIR/tmp`, not RAM or the small `/tmp`).
  - WAL with `wal_autocheckpoint=500`, `journal_size_limit=4MB`, and a `wal_checkpoint(TRUNCATE)` every 10 min.
  - `soft_heap_limit` 16 MB and `PRAGMA optimize` every 6 h.
- **Bounded memory**:
  - The rate-limit table is an LRU (`RATE_LIMIT_MAX_KEYS`, default 20,000).
  - Live-standings cache entries expire.
  - Achievements reuse leaderboard queries within one evaluation.
  - **CSV exports are streamed** with keyset paging (1,000 rows at a time, same bytes as before).
- **Node flags**: `--max-old-space-size=64 --max-semi-space-size=1`, plus `MALLOC_ARENA_MAX=2` and `UV_THREADPOOL_SIZE=2`. They are set in the Dockerfile `CMD`/`ENV`.
- HTTP keep-alive is 65 s, so a reverse proxy never reuses a socket the app just closed. That race caused sporadic `ECONNRESET` at 0.25 CPU.

## 2. Disk budget (250 MB)

Big static assets (`public/`, 14 MB) and `node_modules` (28 MB) live **in the image**, not on the volume. `/data` holds only:

| On `/data` | Size |
|---|---|
| `hub.db` today | 1.2 MB |
| `hub.db` at **1,000 players / 100,000 runs** (synthetic; `tools/deplexo/db-growth.js`) | **26 MB**, about 260 bytes per run including indexes, achievements and notifications. It would be 41 MB if used run tokens were never pruned. |
| WAL (`hub.db-wal`) | ≤ 4 MB after checkpoints |
| `og-cache/` | ≤ 30 MB (`OG_CACHE_MAX_MB`) |
| `backups/` | up to 5 × 11 MB gzip ≈ 57 MB at 100k runs, hard-capped at `BACKUP_MAX_MB` = 75 MB |
| Temporary space during a backup (raw snapshot + gzip, deleted afterwards) | ≈ DB size + gz size ≈ 37 MB |
| **Worst case at 100k runs** | ≈ **170 MB** of 250 MB |

Pruning:
- Used and expired **run tokens** older than `RUN_TOKEN_KEEP_DAYS` (default 3) are deleted every 6 h. Rejected tokens are kept for the anti-cheat review. Tokens expire after 2 h anyway. The only visible difference: replaying a token more than 3 days old returns "Unknown run." instead of "already submitted".
- The OG cache is LRU-pruned to 90 % of its cap.
- Local backups rotate (keep 5, max 75 MB). A backup is refused with a clear error if free disk is too low.

Past roughly 300k runs, lower `BACKUP_KEEP` (for example 3) or rely on the GitHub copy.

## 3. The Dockerfile

- Multi-stage on `node:20-bookworm-slim`.
- **Build stage**:
  - `npm ci --omit=dev`, which installs the **prebuilt native binaries for the builder's architecture** (better-sqlite3, @resvg/resvg-js). A python3/make/g++ toolchain is there only as a fallback.
  - v7 added one pure-JS dependency, `qrcode-generator` (it renders the admin authenticator QR code on the server, so the QR never goes through a third party). It is in `package.json`/`package-lock.json`, so `npm ci` installs it. There is nothing extra to do on Deplexo.
  - Runs `scripts/deplexo-prebuild.js`.
  - Smoke-tests that both native modules load.
- **Runtime stage**:
  - Only `node_modules`, `build/`, `src/`, `public/` and `package.json`, all owned by root and read-only to the app.
  - Runs as the unprivileged `node` user (uid 1000).
  - `ENV NODE_ENV=production PORT=8787 DATA_DIR=/data BUILD_DIR=/app/build TMPDIR=/tmp MALLOC_ARENA_MAX=2 UV_THREADPOOL_SIZE=2`.
  - Exec-form `CMD ["node","--max-old-space-size=64","--max-semi-space-size=1","src/server.js"]`. It does not use `npm start`, because npm writes logs and adds a process.
- `HEALTHCHECK` hits `GET /healthz` through bash `/dev/tcp`, so there is no second node process (that would cost about 40 MB).
- The app writes **only** to `$DATA_DIR` (DB, WAL, `tmp/`, `og-cache/`, `backups/`) and nothing to `/tmp`. If `/data` is not writable it exits with a clear `FATAL: database directory /data is not writable by uid 1000…` message.
- No `--platform` pin: Deplexo doesn't document its runtime CPU architecture. The image builds natively on amd64 or arm64, and the startup log prints `linux/x64` or `linux/arm64` so you can see which one you got.
- `.dockerignore` keeps `.env`, `data/`, `assets-src/` (199 MB), screenshots, tools and the git history out of the image. Image size: 242 MB.

**Tested** with Docker 29.1.4 on linux/amd64:
- Command: `docker run --read-only --tmpfs /tmp:rw,noexec,nosuid,size=100m -v hubdata:/data --memory 128m --memory-swap 128m --cpus 0.25 --cap-drop ALL --security-opt no-new-privileges`.
- The **API e2e suite passed 372/0** against the container. It ran from a sidecar container sharing the volume, because the suite also opens the SQLite file.
- Healthcheck `healthy`, 0 OOM, numbers as in the table above.
- Also tested: `/data` as a noexec tmpfs with `PORT=3000` (starts, serves OG images), and a root-owned `/data` (clean FATAL message).

## 4. Deploy steps (for Reese)

1. **Sign up** at https://deplexo.com using **Sign in with GitHub**.
2. **Connect the private repo**: in Deplexo, connect GitHub as your Git provider. When GitHub asks which repositories to give Deplexo access to, choose *Only select repositories* and pick **`TheTavern001/gaming-hub-2`**.
3. **Deploy**: open *Deploy* and choose `TheTavern001/gaming-hub-2`, branch `main` (or the branch you push to). Name the app (for example `gaming-hub`). Region: EU. Plan: **Free**.
   - Build method: **Dockerfile**, root directory `/`, Dockerfile `Dockerfile`. `deplexo.yaml` in the repo says the same: `framework: dockerfile`, `port: 8787`.
4. **Environment variables** (set them in the deploy form; they are runtime-only, the build doesn't need any):

   | Variable | Value |
   |---|---|
   | `ADMIN_PASSWORD` | a long random password (≥ 16 characters) |
   | `SECRET` | output of `openssl rand -base64 32` |
   | `PORT` | `8787` (set it explicitly; Deplexo defaults to 3000 if it's missing, and the app works with either as long as it matches the port in the form) |
   | `DATA_DIR` | `/data` |
   | `NODE_ENV` | `production` (already set in the image; harmless to repeat) |
   | `NODE_OPTIONS` | leave empty. The memory flags are in the Dockerfile `CMD`. Only add extra flags here if needed. |
   | *(optional)* `BACKUP_GITHUB_TOKEN`, `BACKUP_GITHUB_REPO`, `BACKUP_GITHUB_BRANCH` | see section 5 |
   | `ADMIN_PATH` | **required for the admin panel (v7)**: a long random slug, 16-128 characters of `A-Z a-z 0-9 _ -`, for example the output of `openssl rand -hex 16`. The admin lives only at `https://<site>/<ADMIN_PATH>/`, and `/admin` returns 404. If it is missing or too short, the admin panel is disabled. Keep it private. |
   | `ADMIN_USERNAME` | *(optional)* the owner account's username, default `owner`. The owner signs in with `ADMIN_PASSWORD` the first time, then sets up an authenticator app (QR code) and gets 10 backup codes. |
   | `TRUST_CF_IP` | `1` when the app is reached through Cloudflare (it reads the visitor IP from `CF-Connecting-IP` for rate limits and admin lockouts). This is already the default with `NODE_ENV=production`. Check after the first deploy: `curl -sI https://<app-url>/healthz` should show a `cf-ray:` header. **If it doesn't, set `TRUST_CF_IP=0`**, or visitors could fake their IP. |
   | `PUBLIC_URL` | *(optional, v7)* the public address used for share, referral and Open Graph links and `<link rel=canonical>`, for example `https://traptechgaminghub.com`. Leave it empty to use whatever host the request came in on. See FINALIZE.md, Domain. |
   | `CANONICAL_REDIRECT` | *(optional)* `1` redirects (301) page loads on any other hostname to `PUBLIC_URL`. Only use it when `PUBLIC_URL` is served by this app directly (a custom domain on the Deplexo app), **never** together with a registrar or Cloudflare redirect that points back to the Deplexo URL, because that would loop. |
   | `ADMIN_RESET_TOKEN` | **unset normally.** Only for owner lockout recovery (FINALIZE.md, section 4). |

   Note: if this replaces an existing deployment whose players' sessions you want to keep, reuse its secrets. Either set the same `SECRET`, or set `SESSION_SECRET`, `RUN_SECRET` and `IP_SALT` individually with the old values.
5. **Confirm the persistent mount**: in the app's storage/volume settings, make sure the persistent volume is mounted at **`/data`**. That is the default path and it must match `DATA_DIR`. Saving a mount or env change only takes effect after a restart or redeploy.
6. **Deploy** and watch the build log. Look for `native modules OK linux x64` (or `arm64`). In the runtime log, look for `Gaming Hub listening on port 8787 (db: /data/hub.db, node v20… linux/x64, heap limit 67 MB, uid …)`.
7. **Verify**:
   - `https://<app>.<deplexo-subdomain>/healthz` should return `{"ok":true}`.
   - Open the site, sign up a test player, play a run, check the leaderboard, open a share link (its preview image is `/og/run/<id>.png`).
   - Sign in at `/<ADMIN_PATH>/` (v7: `/admin` is a 404 on purpose) as `owner` with `ADMIN_PASSWORD`, and scan the QR code with an authenticator app. Save the backup codes offline. Then, under Settings → **Database backups**, press **Back up now**, then **Download backup**.
8. If the old Render database should come along: download its `hub.db`. Restoring it on Deplexo is the open item in section 5 (restore).

## 5. Backups

- **Automatic**: 2 minutes after start and then every 30 minutes, the app checks whether the newest backup is older than `BACKUP_INTERVAL_HOURS` (24). If so, it makes one. `BACKUP_DISABLE=1` turns this off.
- **How a backup is made** (`src/backup.js`):
  1. A consistent online snapshot with SQLite's backup API (better-sqlite3 `db.backup()`), so the app keeps running.
  2. gzip, streamed (low memory).
  3. Saved as `$DATA_DIR/backups/hub-YYYYMMDD-HHMMSSZ.db.gz`. The newest `BACKUP_KEEP`=5 are kept, within `BACKUP_MAX_MB`=75.
  4. Status goes to `backups/status.json`.
- **Admin UI** (Settings → *Database backups*):
  - **Back up now** makes a snapshot and pushes it to GitHub if a token is set.
  - **Download backup** makes a fresh snapshot and downloads it.
  - There is a per-file download list, plus last-backup and last-push status.
  - Endpoints (admin only): `GET/POST /api/admin/backups`, `GET /api/admin/backups/download[?name=]`.
- **Off-site copy to a private GitHub repo (recommended)**: the Deplexo volume is deleted when the app is deleted, and it lives on a single worker.
  - Each backup is uploaded through the GitHub REST git-data API: blob, tree, a commit with **no parent**, then a force-update of the branch.
  - So the `backups` branch always holds just one commit with the newest `BACKUP_GITHUB_KEEP` (5) files plus a README, and the repo doesn't grow forever.
  - Uploads are streamed. A file must stay under GitHub's 100 MB blob limit (about 11 MB at 100k runs).

### Create the backup repo and a fine-grained token

1. On GitHub, create a **new private repository**, for example `TheTavern001/gaming-hub-backups`. Tick **"Add a README"**: the API can't write to a completely empty repo.
2. Go to GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
   - **Token name**: `gaming-hub backups (Deplexo)`.
   - **Resource owner**: `TheTavern001`. If that's an organisation, it must allow fine-grained tokens and may need to approve this one.
   - **Expiration**: up to 1 year. Put a reminder in the calendar to rotate it.
   - **Repository access**: **Only select repositories** → `gaming-hub-backups` (just that one, *not* `gaming-hub-2`).
   - **Permissions → Repository permissions → Contents: Read and write**. Metadata: read-only is added automatically. Nothing else.
3. Copy the token (`github_pat_…`) into Deplexo env vars:
   - `BACKUP_GITHUB_TOKEN=github_pat_…`
   - `BACKUP_GITHUB_REPO=TheTavern001/gaming-hub-backups`
   - `BACKUP_GITHUB_BRANCH=backups` (optional, that's the default)

   Restart the app. Then press **Back up now** in admin. The toast should say "Backup saved and pushed to GitHub", and the repo gets a `backups` branch.
4. If the token is wrong or expired, the local backup is still made, and the admin card shows the GitHub error (for example `401 Bad credentials`).

Tested against a mock of the GitHub API (`tools/deplexo/mock-github.js` + `tools/deplexo/test-backups.sh`): 7 pushes in a row, the branch ref is updated each time, the commit has no parents, the newest 3 files are kept, and pushed files are byte-identical (sha256) to the local ones. A bad token produces a clear error. **Not yet tried against real GitHub.**

### Restore

1. Get a backup: GitHub repo → branch `backups` → `backups/hub-….db.gz`, or the admin **Download backup**.
2. Unpack and check it: `gunzip hub-….db.gz` and `sqlite3 hub-….db 'PRAGMA integrity_check'`.
3. Put it on the volume as `/data/hub.db` while the app is stopped, and delete any `hub.db-wal`/`hub.db-shm`. Deplexo doesn't document shell or file access to the volume.
   - **Open item:** if no shell is available, the app needs a small admin "restore from upload" or "restore from GitHub" feature. It hasn't been built yet. Until then, restoring means a redeploy with a one-off image that has the file in it.

## 6. Caveats

- **0.25 CPU**, not "1 shared CPU" (per the plans page): fine for normal use, slow for bursts of new share images.
- **No custom domain on Free**: the app gets a Deplexo subdomain. Re-checked 2026-10-04: the plans page lists "Subdomain on the platform" for Free, "Custom subdomains" for Starter ($5) and Pro ($10), and "Custom domains" only for Business. The [custom-domain guide](https://docs.deplexo.com/guides/domains/) (TXT + CNAME, apex needs CNAME flattening) doesn't name a plan. For TrapTechGamingHub.com and the free options, see FINALIZE.md, Domain.
- **Runtime architecture and the health check Deplexo uses aren't documented.** The docs say a container goes live after "a health check" passes. `/healthz` and the Docker `HEALTHCHECK` are both in place.
- **Ownership of the `/data` volume isn't documented.** The image runs as uid 1000 and `/data` is chowned in the image. If Deplexo mounts a root-owned volume, the app stops with a clear FATAL message, and Deplexo support would need to confirm what uid to run as.
- The volume is **deleted with the app** and doesn't move between workers. Keep the GitHub backups on.
- **Acceptable use:** Deplexo's rules ban illegal content. The hub's sponsor giveaways are cannabis brands (21+). Review https://docs.deplexo.com/reference/acceptable-use/ before going live.
- The app trusts `CF-Connecting-IP` for per-IP rate limits. Behind Deplexo's own proxy (not Cloudflare), a client could spoof that header to dodge per-IP limits. Per-account limits still apply.

## 7. Alternatives (if 128 MB / 0.25 CPU turns out too tight)

All checked on 2026-10-03 on the providers' official pages.

| Option | $0 without a card? | Resources | Data persistence for SQLite | Effort for this app | Source |
|---|---|---|---|---|---|
| **Deplexo Free** (this guide) | **Yes** | 0.25 CPU, 128 MB, 250 MB disk, always on | **Yes**, volume at `/data` (deleted with the app) | Done | deplexo.com/plans, docs.deplexo.com/operations/storage/ |
| Deplexo Starter | No, $5/month | 0.5 CPU, 512 MB, 2 GB | Yes | None (same image) | deplexo.com/plans |
| **Koyeb** | **No**: new sign-ups have no free plan since Feb 2026; Pro from $29/month, card required. The old free instance only remains for existing orgs. | — | Free instance had no volumes | Small | koyeb.com/pricing, koyeb.com/docs/faqs/pricing |
| **Fly.io** | **No**: no free tier, just a trial (2 h of machine time or 7 days); a card is needed after that. Smallest machine about $2/month. | 256 MB+ | Volumes ($0.15/GB-month) | Small | fly.io/docs/about/pricing/ |
| **Google Cloud Run** | **No**: free tier (180k–240k vCPU-s, 360k–450k GiB-s, 2M requests per month) but needs a billing account with a card | up to 32 GB | **No**, filesystem is ephemeral, so an external DB (e.g. Turso) is needed | Large (DB layer becomes async) | cloud.google.com/run/pricing |
| **Northflank** Developer Sandbox | **No**: free sandbox (2 services, always on) but a payment method is required for every account | small | Volumes are paid | Small | northflank.com/pricing |
| **Zeabur** | **No hosted compute** on Free (it only manages a server you bring); Dev $5/month after a 14-day trial | — | — | — | zeabur.com/pricing |
| **Glitch** | **Gone**: project hosting ended 8 July 2025 | — | — | — | blog.glitch.com/post/changes-are-coming-to-glitch |
| **Render** Free (repo already has `render.yaml`) | Yes | 0.1 CPU, 512 MB; 750 instance-hours/month; **sleeps after 15 min idle** (about 1 min to wake) | **No**: no persistent disk on Free, so SQLite is wiped on every restart, redeploy or spin-down. Free Postgres expires after 30 days. | Small, but data loss makes it a preview-only option | render.com/docs/free |
| **Back4app Containers** Free | Yes | 0.25 CPU, 256 MB, 100 GB transfer | **No** persistent volume documented, so an external DB is needed | Large (external DB) | back4app.com/pricing/container-as-a-service |
| **Cloudflare Workers + D1** | Yes | 100k requests/day, **10 ms CPU per request**, 128 MB; D1: 5 GB, 5M rows read/day, 100k rows written/day | Yes (D1) | **Very large rewrite**: Express → Workers, better-sqlite3 → async D1 API, resvg → WASM. 10 ms CPU rules out bcrypt (~70 ms) and server-side PNG rendering on the free plan. | developers.cloudflare.com/workers/platform/limits/, developers.cloudflare.com/d1/platform/pricing/ |
| **Turso** Free + a free stateless host (Render Free / Back4app) | Yes | Turso: 100 DBs, 5 GB, 500M rows read and 10M rows written per month | Yes (Turso) | **Large**: every synchronous better-sqlite3 call (hundreds) becomes async libSQL; the stateless host still sleeps (Render) or is small (Back4app) | turso.tech/pricing |

**Bottom line:** Deplexo Free is the only option checked that is $0, needs no card, stays always-on **and** has a persistent disk for SQLite, and the app now fits it with room to spare on memory. Everything else either needs a card (Koyeb, Fly.io, Cloud Run, Northflank), has no hosted compute (Zeabur) or no longer exists (Glitch), or loses the SQLite file (Render Free, Back4app) and would need the database layer rewritten for Turso/D1. If 0.25 CPU proves too slow, **Deplexo Starter ($5/month)** runs the same image unchanged.

## 8. Reproducing the measurements

```bash
BUILD_DIR=/tmp/hub-build node scripts/deplexo-prebuild.js
# 128 MB / 0.25 CPU cgroup v2 (needs sudo), worst-case load incl. OG renders:
LABEL=capC PORT=8805 BUILD_DIR=/tmp/hub-build CAPPED=1 NODE_FLAGS="--max-old-space-size=64 --max-semi-space-size=1" tools/deplexo/measure.sh
OG=0 LABEL=capN ... tools/deplexo/measure.sh          # API only
node tools/deplexo/db-growth.js; TOKENS=0 node tools/deplexo/db-growth.js   # DB size at 1k players / 100k runs
# Docker like Deplexo:
docker build -t gaming-hub:deplexo .
docker run -d --name hub --read-only --tmpfs /tmp:rw,noexec,nosuid,size=100m -v hubdata:/data \
  --memory 128m --memory-swap 128m --cpus 0.25 --cap-drop ALL --security-opt no-new-privileges \
  -e ADMIN_PASSWORD=... -e SECRET=... -e PORT=8787 -p 8787:8787 gaming-hub:deplexo
```
