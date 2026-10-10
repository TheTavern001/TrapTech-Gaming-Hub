# Gaming Hub asset hosting and scale plan

## Goal
Keep every game one-click playable in the browser. Players must not download or install games manually. The browser fetches a game's HTML, JavaScript, styles, images, audio and other required assets on demand.

## Recommended production layout
- Application host: Express app, authentication, game-session start, score validation, leaderboards, giveaway/event logic, admin and booking workflows.
- Object storage/CDN: Cloudflare R2 behind a production custom domain for large, public, immutable static assets.
- Database: keep transactional player/event/score data in the application's database until a separately planned database migration is justified. R2 is object storage, not a SQL database.
- Catalog: retain the Hub catalog/API as the source of game metadata. Never expose R2 credentials or S3 secret keys to the browser.

## Important compatibility requirement
The current Games Library uses same-origin routes such as `/games-lib/<slug>/index.html`, and game pages can use root-relative asset paths and the same-origin scoring adapter. Moving only the HTML or rewriting catalog links to an R2 hostname can break scripts, images, CSS, relative paths, and calls to `/api/run/start` and `/api/score`.

Therefore, do not perform a blind bucket migration. Use a tested asset-origin abstraction and a per-game compatibility audit. Keep API requests on the application origin. If a game's HTML entrypoint is served cross-origin, its dependencies and any root-relative paths must be explicitly made compatible; otherwise keep that game's entrypoint on the application host and move only its heavy static assets.

## Storage decision
Cloudflare R2 Standard is the preferred first option for a large static game library because it has no egress fees and has an included monthly allowance for storage and operations. Connect a controlled custom domain to use Cloudflare caching and production security controls. Do not use the rate-limited `r2.dev` endpoint for production.

Use Standard storage for frequently accessed game assets; evaluate Infrequent Access only for assets with predictable low access and after accounting for retrieval charges and the minimum storage duration. Do not add a second object-storage provider unless measurements reveal a concrete requirement R2 cannot meet.

## Caching and versioning
- Use immutable, versioned asset paths or filenames for content that changes infrequently.
- Cache game bundles, images, audio and fonts for a long duration when their URLs are versioned.
- Keep catalog, auth, score, giveaway and admin responses out of shared public caching unless explicitly designed as public cacheable data.
- Use correct Content-Type headers and validate CORS for any cross-origin assets.
- Never cache personalized responses or score/session APIs as public static content.

## Migration phases
1. Inventory all registered games and determine which are built-in, vendored, external, or incomplete. Verify every asset dependency and its redistribution license.
2. Create an R2 bucket and production custom domain in the Cloudflare account. Keep the bucket write credentials server-side or in CI secrets; never commit credentials.
3. Implement and test an asset URL resolver that supports same-origin fallback and an optional configured asset base. Keep gameplay API URLs pinned to the application origin.
4. Migrate a small set of original games first. Test direct game URL, Hub-card launch, mobile/touch input, browser refresh, offline/error states, scoring, and event/giveaway context. Compare asset responses and cache headers.
5. Migrate remaining approved assets in batches with checksums and rollback. Preserve licenses and notices. Do not mirror commercial game assets without permission.
6. Measure cache hit ratio, asset load failures, p95 game launch time, backend latency, concurrent sessions, memory and database write load before broad rollout.
7. Run a production smoke test against the deployed host before announcing completion.

## Scaling safeguards
- Lazy-load games: do not download all 1,000 games when the catalog opens.
- Paginate or virtualize large catalog views if profiling shows a need.
- Add bounded API rate limits and observability for score submissions, auth and catalog access.
- Plan database backups and restore drills. A local SQLite file on an ephemeral filesystem is not a durable production database.
- Do not treat client-reported scores as trusted; preserve server run tokens, event validation and anti-cheat checks.
- Set a budget alert and review operation counts as usage grows.

## Current deployment limitation
Repository changes alone do not create a bucket, configure DNS/custom domains, upload the assets, or switch the production host. Those steps require access to the Cloudflare account and the deployment host. Until the R2 domain is configured and a live smoke test passes, the existing same-origin game paths must remain functional.
