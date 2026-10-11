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
- [ ] Add an optional, admin-configurable checklist to an open giveaway (example: open/join a linked channel, read official rules, complete an eligible in-hub action).
- [ ] Support multiple ordered steps, optional destination URL per step, required/optional status, and clear instructions.
- [ ] Show checklist progress on the giveaway page and preserve progress during the entry flow.
- [ ] Enforce required checklist completion on the server before entry/eligibility is accepted; never rely only on client-side checkboxes.
- [ ] Clearly label external steps as self-attested unless a supported integration actually verifies them. A channel link alone cannot prove membership.
- [ ] Keep members-only brand eligibility separate from open-giveaway checklist requirements.
- [ ] Test edited/deleted steps, signed-out users, replayed requests, duplicate entries, mobile layout, and event end-time boundaries.

## P0 — Avatar system
- Current implementation uses a layered SVG preview and selectable cosmetic parts; that is not a true real-time 3D avatar renderer.
- [ ] Replace the 2D-only preview with a real 3D renderer and licensed/owned model assets (prefer optimized GLB/glTF, mobile-friendly texture sizes, lazy loading, and a static fallback).
- [ ] Support body/face/hair/outfit/accessory customization, lighting/materials, idle pose, camera rotation, and a responsive editor.
- [ ] Distinguish earned, achievement-unlocked, event-exclusive, and paid cosmetics in the catalog.
- [ ] Keep purchases cosmetic-only and validate ownership/prices/grants server-side; never grant an item because the client says it is owned.
- [ ] Provide clear rarity/unlock requirements, preview-before-buy, purchase confirmation, and equipped/owned states.
- [ ] Render the selected avatar consistently in profiles, leaderboards, giveaway entries/winner cards, and community surfaces.
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

## Release evidence
For every release, record commit SHA, automated test results, live deployment status, smoke-test results, known limitations, and rollback point. Do not announce launch-ready until all P0 items pass.
