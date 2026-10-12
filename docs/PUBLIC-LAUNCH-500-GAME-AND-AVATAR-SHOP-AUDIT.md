# Public Launch Readiness: 80-Game Baseline + 500-Game Goal + Avatar/Shop Deep Audit

Status: **audit program committed; launch readiness not yet established.** This plan does not claim the existing library has passed or that all reported defects are fixed. Each title must earn a pass with fresh evidence.

## Release decision

The launch target is **500 distinct, launch-ready games**, not 500 registry rows. The active source registry currently contains **80 Games Library titles** plus the core Hub games; this is the baseline to audit and fix first. After the active baseline is accepted, add and review games in subsequent batches of up to 100. Do not count registry rows as ready until every title has passed its required gates.

### Batch gates

1. Freeze the first 100 candidates and capture the exact commit SHA.
2. Run static integrity, duplicate, broken-reference, runtime-console and mobile-layout checks across all 100.
3. Play every title on desktop and a real Android phone. Capture title screen, active gameplay, game-over and score-submission evidence.
4. Fix bugs and quality gaps. If a game still fails after two focused rebuild passes, replace it with a distinct, licensed game rather than lowering the acceptance bar.
5. Re-run every test after fixes. Retain the failure/fix/pass history and screenshots.
6. Give the owner a reviewable batch of 100 only when every title has a completed record. No automatic pass from a title existing, loading, or appearing in a catalog.
7. Repeat for batches 2–5. The final 500-game release must also pass duplicate, license, performance, score integrity and shared-account regression checks.

## Full-catalog scope: core games + Games Library

The audit scope is the entire playable catalog, not just the Games Library:
- **Core Hub games:** parse the registered game modules from `src/config.js` and inspect each matching `public/js/<module>` source file.
- **Games Library:** inspect every registry entry from `src/games-lib.js` and its `public/games-lib/<slug>/` implementation.
- **Shared engine and platform:** regression-test `public/js/games/engine.js`, the signed-run adapter, scoring submission, restart/pause behavior, account cosmetics, leaderboards, and the host page after each batch of changes.
- **Scope changes:** a game added to either registry automatically becomes part of the audit. A title must not be excluded because it is old, was previously tested, or is not part of the latest batch.

The repository's current source snapshot registers 16 core games and 80 Games Library titles. These are inventory counts, not quality passes. The build-time structural audit report must show separate core-game and library totals and retain blocker/review findings for both groups. Real-device and visual/gameplay gates remain mandatory.

## Redesign execution order

1. Freeze a source commit and record every registered core game and library title.
2. Audit every title for boot/loading failures, controls, game-loop stability, score validity, duplicate experience, asset references/licensing, accessibility, and mobile behavior.
3. Redesign and fix the core games first as the baseline quality bar, one title at a time, while retaining each game's distinct identity and core loop.
4. Apply the same audit-and-redesign gate to every Games Library title. Do not bulk-apply one visual skin and call all titles redesigned.
5. Re-run shared-engine and signed-score regressions after each batch; re-test every modified game on desktop and the user's Android device.
6. Mark each title **PASS**, **FIX**, or **REPLACE** with evidence. No title is launch-ready solely because its source file exists or a static check passes.

## Per-game AAA acceptance record

Each game's record must include:
- Stable game ID/slug, source commit and test date.
- Duplicate review: title, core loop, layout, art, sound and source-code similarity. Near-duplicates require a documented reason to keep both; byte-identical code is not automatically a duplicate if it is a deliberately shared engine, but the actual player experience must be distinct.
- Rights: code, art, 3D models, textures, fonts, music/SFX, animation and attribution/redistribution terms.
- Desktop and Android load, input, resize/orientation, pause/resume, visibility change, restart, game-over and error-state results.
- Score correctness, legitimate submission, replay/reset behavior, anti-cheat validation and tie handling wherever competitive.
- Visuals: intentional art direction, coherent asset scale/materials, readable silhouettes, polished HUD/menu/transitions, sound and impact feedback, no placeholder-looking final art.
- Performance: real-device P50/P95 frame times, sustained drops, heat/memory notes, and stress behavior. A headless browser or average FPS alone is insufficient.
- Evidence: title, active gameplay and results screenshots/captures; concrete visual score and reasons.
- Decision: PASS, FIX, or REPLACE; owner acceptance recorded separately.

## Duplicate policy

Use the automated report in `tools/prelaunch-deep-audit.js` as triage, not the final verdict. It detects duplicate slugs, normalized titles, identical HTML and identical `game.js` files. A human review must also compare gameplay loops and visual identity because renamed copies and different code with the same game design will evade simple hashes. Preserve useful shared engines; remove duplicate player-facing titles from the launch selection or rebuild them into meaningfully different games. Never remove a game solely because it uses a shared engine.

## Avatar: separate deep-audit gate

The avatar system is a core platform feature and must be audited independently of the game count.

### Visual and customization
- One consistent, high-quality stylized 3D art direction; clean silhouettes and polished materials, lighting, presentation stage and camera.
- Male, female and other presentation options; compatible body/build choices; skin, face, eyes, hair style/color, facial hair, outfits, headwear, accessories, held items, profile background and future slots.
- Inspect every part and a representative matrix of cross-slot combinations for clipping, floating items, broken attachment points, texture/material mismatch, scale problems and body intersections.
- Verify idle/preview animation, turntable/camera controls, responsive mobile layout, reduced-motion behavior and a useful fallback when WebGL or model loading fails.
- Preview must reflect saved/equipped items and owned state; no false preview success if the server rejects a save.

### Technical and account integrity
- Server validates every selected part and ownership/unlock requirement; client-side hiding is not authorization.
- Test default avatar, malformed IDs, unknown users, save/load, purchase, achievement unlock, prestige-only parts, logout/login and public profile rendering.
- Ensure avatar cosmetics never alter game hitboxes, physics, score, competition or gameplay advantages.
- Verify loading, caching, model/texture memory, fallback behavior and cross-game shared-avatar consistency.
- Asset manifests must retain exact source, version and license for each model, outfit, texture, rig and animation. Do not assume packs share a skeleton; prove retargeting and modular fit with actual builds.

## Shop/inventory: separate deep-audit gate

### Catalog and rotation
- Support 1,000+ real catalog entries across cosmetics/profile customization. Generated variants are acceptable only when they are stable, intentionally designed and meaningfully distinct; do not represent combinatorial permutations or palette recolors as 1,000 bespoke meshes.
- Continuously rotating daily/weekly/seasonal inventory with clear reset timing, no accidental reroll exploits, stable item IDs and deterministic generated definitions.
- Check duplicates across static items and generated IDs, name/art collisions, invalid rarity/prices, missing previews, inaccessible owned items, expired rotation edge cases and mobile layout.
- Target a large everyday catalog with only roughly 10–20 ultra-premium prestige originals priced at $1,000+ if that pricing model is eventually enabled. Do not enable real-money pricing at launch without an explicit product/legal/security review.

### Purchase, ownership and economy
- Server-side authorization and atomic currency debit + ownership grant; concurrent purchase tests must never double-charge or oversell.
- Replayed requests, stale shop snapshots, insufficient balance, duplicate purchase, database failure and retry behavior must be safe.
- Owned/equipped/preview/locked/limited states must be accurate and accessible. Currency descriptions must be unambiguous; cosmetic currency must not imply cash value or prize eligibility.
- Cosmetics are cosmetic only and cannot improve gameplay or scores.
- Add audit logs for purchases, grants, refunds, rotations and prestige ownership changes.

### One-of-one prestige originals
- Limit the premium prestige tier to approximately 10–20 items; every item must have a unique original silhouette and signature presentation, not just a renamed template or recolor.
- Each original may include curated alternate looks/poses/VFX as variations of that same owned original; variations must not create additional independent owners of the one-of-one asset.
- Enforce uniqueness in the database and in a transaction on the server. UI labels, countdowns and client-side checks are not sufficient. Test two concurrent buyers, retries and database restarts.
- Document the ownership/reissue policy clearly. Do not promise permanent scarcity unless the backend can enforce it.

## Shared platform regression

After each batch, retest account sign-in, profile/avatar persistence, inventory, shop rotation, currency, game launch/routing, leaderboards, score validation, giveaways, accessibility, browser history and Android performance. A game-specific fix must not break the common shell or shared identity.

## Automated report

Run from the repository root:

```sh
node tools/prelaunch-deep-audit.js
```

It writes `docs/audit/prelaunch-structural-audit.json`. The report is a read-only structural triage: it flags missing files, exact hashes, normalized-title duplicates and selected avatar/shop checks. It cannot certify visuals, gameplay, legal rights, physical-device performance or one-of-one database guarantees. Those remain explicit release gates.

## Launch bar

**No public launch until all 500 selected titles have individual evidence, duplicate review and license clearance, and the avatar, shop, account, economy and competitive-score systems pass their own regression suites.** If a game or platform feature has not been tested, mark it NOT VERIFIED rather than AAA-ready.
