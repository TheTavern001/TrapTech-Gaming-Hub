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
- [x] Show player-facing checklist controls and persist each player's confirmations server-side.
- [x] Include required checklist completion in server-side eligibility checks; the join endpoint uses that eligibility result.
- [x] Label external steps as self-attested unless a supported integration actually verifies them. A channel link alone cannot prove membership.
- [x] Keep members-only brand eligibility separate from checklist requirements.
- [ ] End-to-end test edited/deleted steps, signed-out users, replayed requests, duplicate entries, mobile layout, and event end-time boundaries. Checklist normalization and syntax checks pass; full entry-flow coverage is still outstanding.

## P0 — Avatar system
- The editor now has a real-time Three.js/WebGL preview built from procedural 3D geometry, with drag rotation, lighting, idle motion, and an SVG fallback. This is a functional 3D renderer, but the model is not AAA-quality and does not yet use a licensed/owned GLB/glTF character asset.
- [x] Replace the 2D-only editor preview with a real 3D renderer and static SVG fallback. The Three.js module is loaded lazily from a pinned CDN, so the editor needs network access for 3D mode.
- [x] Reflect existing face, skin, hair, outfit, accessory, hat, and held-item choices in the 3D preview; provide lighting/materials, idle motion, camera rotation, and a responsive editor.
- [ ] Add true body-proportion controls and upgrade the procedural character to a production-quality, licensed/owned model asset.
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

## Release evidence
For every release, record commit SHA, automated test results, live deployment status, smoke-test results, known limitations, and rollback point. Do not announce launch-ready until all P0 items pass.
