# V1 AAA Audit and Launch Gate

Status: active pre-launch audit. The public launch is V1. Subsequent public releases use V1.0, V1.2, V1.3, etc. Do not label pre-launch work as a public release or silently treat a Git commit as a deployed release.

## Release rules
- V1 is the launch candidate and must pass the launch gate below.
- V1.0 is the first post-launch update; V1.2 and later are incremental updates.
- A release is complete only when code is committed, automated checks pass, deployment is healthy, and critical user journeys are verified against the live URL.
- Preserve existing user accounts, scores, giveaway records, ownership, and server-side eligibility rules during UI changes.

## P0 — Production availability
- [ ] Inspect Deplexo deployment state, build logs, runtime logs, environment variables, and health-check response.
- [ ] Verify `/healthz`, `/api/build`, sign-in, public games, giveaway list/detail, and avatar endpoints.
- [ ] Confirm the running deployment commit matches the intended Git commit.
- [ ] Confirm SQLite data remains on the configured persistent mount and do not wipe production data during recovery.

## P0 — Responsive and accessibility audit
- [x] Add overflow containment for long words, nested flex/grid children, forms, media, tables, and narrow mobile layouts.
- [ ] Verify every route at 320, 360, 390, 768, 1024, and 1440 CSS-pixel widths.
- [ ] Check text clipping, horizontal scroll, dialogs, toasts, forms, buttons, bottom navigation, admin builder, and game canvas.
- [ ] Confirm keyboard focus, visible labels, accessible names, reduced-motion behavior, and adequate touch targets.
- [ ] Run browser screenshots and smoke tests on mobile and desktop before launch.

## P0 — Giveaway entry checklist
- [x] Add an optional admin-configurable checklist with up to eight steps, optional HTTPS destination URLs, and required/optional status.
- [x] Support multiple ordered steps, destination URLs, required/optional status, and clear instructions.
- [x] Show player-facing checklist status; optional notes may be self-attested but never satisfy required eligibility.
- [x] Include required checklist completion in server-side eligibility checks; the join endpoint uses that eligibility result.
- [x] Reject self-attestation for required external steps. A channel link alone cannot prove membership; required external steps stay ineligible until a trusted integration verifies them.
- [x] Keep members-only brand eligibility separate from checklist requirements.
- [ ] End-to-end test edited/deleted steps, signed-out users, replayed requests, duplicate entries, mobile layout, and event end-time boundaries. Checklist normalization and syntax checks pass; full entry-flow coverage is still outstanding.

## P0 — Avatar system
- The editor now has a real-time Three.js/WebGL preview built from procedural 3D geometry, with drag rotation, lighting, idle motion, and an SVG fallback. This is a functional 3D renderer, but the model is not AAA-quality and does not yet use a licensed/owned GLB/glTF character asset.
- [x] Replace the 2D-only editor preview with a real 3D renderer and static SVG fallback. The Three.js module is loaded lazily from a pinned CDN, so the editor needs network access for 3D mode.
- [x] Reflect existing face, skin, hair, outfit, accessory, hat, and held-item choices in the 3D preview; provide lighting/materials, idle motion, camera rotation, and a responsive editor.
- [x] Add selectable average/slim/athletic/stocky/curvy/tall/short build proportions to the procedural model.
- [ ] Upgrade the procedural character to a production-quality, licensed/owned model asset.
- [ ] Distinguish earned, achievement-unlocked, event-exclusive, and paid cosmetics in the catalog.
- [ ] Keep purchases cosmetic-only and validate ownership/prices/grants server-side; never grant an item because the client says it is owned.
- [ ] Provide clear rarity/unlock requirements, preview-before-buy, purchase confirmation, and equipped/owned states.
- [x] Render the selected avatar in the editor and player profile with the existing SVG fallback.
- [ ] Extend consistent 3D rendering to leaderboards, giveaway entries/winner cards, and community surfaces without excessive WebGL instances.
- [ ] Optimize for lower-end Android devices and provide a non-WebGL fallback.

## P1 — Product terminology and brand affiliation
- [x] Replace “Sponsor a Host” with “Book a Giveaway” in the principal player-facing v7 UI.
- [x] Explain that brand affiliation controls members-only eligibility and does not connect a personal Telegram account or transfer channel ownership.
- [ ] Audit all remaining navigation, admin labels, notification copy, metadata, and documentation for stale terminology.
- [ ] Keep official giveaway booking separate from playing, sharing, and attempting to create unofficial vendor giveaways.

## P1 — Game presentation and assets
- [ ] Inventory every game and distinguish original game code, licensed/open-source titles, placeholders, and unavailable titles.
- [ ] Replace placeholder thumbnails/icons with consistent, rights-cleared high-quality artwork.
- [ ] Audit game canvas scaling, aspect ratio, touch controls, pause/resume, audio controls, loading/error states, and safe-area handling.
- [ ] Do not call a game AAA based only on a glossy page or thumbnail; high-fidelity gameplay requires appropriate art, animation, sound, controls, and performance.
- [ ] Preserve source/license attribution for imported game code and assets.

## P1 — Core functional regression
- [ ] Sign-up/sign-in/session recovery and account settings.
- [ ] Game launch, score submission, anti-cheat validation, leaderboards, achievements, and rewards.
- [ ] Giveaway create/edit/publish/enter/close/draw/verify flow.
- [ ] Brand invitation, affiliation switching cooldown, and members-only gating.
- [ ] Store balance, earned currency, paid checkout state, cosmetic purchase/equip.
- [ ] Admin permissions, audit trail, backups, and restore rehearsal.

## Current implementation evidence
- Checklist schema/UI/server eligibility integration: commits `4af996c`, `50a456e`, `a281040`, `8f50d95`, `2e16069`, `e2bca05` and follow-up fixes.
- 3D avatar editor/profile renderer: commits `4d771ec`, `0fd7b35`, `572f5c6`, `541f295`, `98c5548`, `24f559b`, `8078dc1`, `b651f89`.
- Automated workflow `V1 launch syntax checks` passed on commit `db3674174d`; it includes server/browser syntax checks and checklist normalization regression checks.
- Live Deplexo health, deployed SHA, real browser interactions, and full gameplay visual fidelity have not been verified in this audit.

## Security/privacy hardening
- [x] Add baseline browser security headers (nosniff, frame denial, referrer policy, restrictive permissions policy, cross-origin policies, HSTS on HTTPS).
- [x] Remove public founder identity flags, stable internal Hub IDs, and external Potato handles from public profile/eligibility responses. Trap Tech Solutions remains the public operator brand.
- [x] Remove deployment commit metadata from the public build endpoint.
- [x] Stop trusting arbitrary X-Forwarded-* and CF-Connecting-IP headers by default; proxy hop count and Cloudflare IP trust must be explicitly configured.
- [x] Confirm the legacy `/admin`, `/admin.html`, `/api/admin/*`, and old admin asset URLs are 404; the actual dashboard uses the configured secret path and server-side auth/2FA/CSRF/roles.
- [ ] Verify production environment values: long random `ADMIN_PATH`, strong `ADMIN_PASSWORD`/owner password, unique `SECRET`/session secrets, and `TRUST_CF_IP=1` only when Cloudflare is actually the trusted proxy.
- [ ] Run external security review / penetration tests and confirm no secrets or creator/account identifiers appear in production HTML, API responses, logs, media metadata, or social previews.
- Important limitation: browser-delivered JavaScript, HTML and WebGL assets can always be inspected. Security must come from server-side authorization, validation, rate limits, anti-cheat and secret isolation—not attempting to hide client code.

## Payments and storage integrations
- [x] Add Stripe-hosted card checkout, server-priced orders, signed webhook verification, provider/session matching, idempotent fulfillment, and entitlement reversal for verified full refunds.
- [x] Keep Bitcoin as a separate direct-to-wallet payment path; no private wallet keys are stored by the Hub.
- [x] Add optional Cloudflare R2 S3-compatible storage for uploaded admin media, with local disk fallback and a private server-side signing key.
- [ ] Stripe is not active until production STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and HTTPS PUBLIC_URL are configured and test-mode purchases/refunds pass. Do not enable live keys before that.
- [ ] R2 is not connected until bucket-scoped credentials are configured; test upload/reload/restart persistence before relying on it. R2 does not replace SQLite persistence or backup configuration.
- [ ] Other crypto providers are not integrated; currently only Bitcoin is supported for crypto payments.

## Release evidence
For every release, record commit SHA, automated test results, live deployment status, smoke-test results, known limitations, and rollback point. Do not announce launch-ready until all P0 items pass.
