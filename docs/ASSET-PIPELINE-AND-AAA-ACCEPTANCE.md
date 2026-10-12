# Asset acquisition and quality gate

This document is the execution checklist for the Gaming Hub's avatar, cosmetics, and game-visual upgrade. It is deliberately separate from a claim that the work is already complete.

## Existing foundation verified in the repository
- `public/js/avatar-3d.js`: Three.js WebGL avatar renderer, color palettes, scene lighting and background dressing.
- `public/js/avatar-editor.js`: avatar editor, presentation options (male/female/other), category tabs, ownership checks, save flow, SVG fallback.
- `src/cosmetics.js`: original CSS-rendered profile banners/frames/titles.
- `public/assets/`: existing game, brand, card, badge and avatar image assets.
- `CREDITS.md`: existing asset-credit record; maintain it for every imported third-party asset.

## Non-negotiable product requirements
- Keep the clean, blocky/stylized 3D avatar direction; purple sci-fi presentation, luminous rarity treatments and purple-to-gold shop CTA.
- Full cosmetic-only customization. Cosmetics, XP and profile presentation must never grant gameplay power, score advantages or competitive boosts.
- Support mobile performance, touch controls, reduced motion, keyboard accessibility and a graceful no-WebGL fallback.
- Never trust client-submitted ownership, purchase state, scores, rarity, currency balances or unlocks. Validate on the server.
- Avoid copying paid/proprietary game assets or importing assets whose license is unclear.

## Free asset sources to evaluate (download only assets whose individual license permits this project)
- Kenney: https://kenney.nl/assets — game-ready packs, often CC0; confirm each pack's license.
- Quaternius: https://quaternius.com — stylized low-poly packs; check the license attached to each download.
- Poly Pizza: https://poly.pizza — low-poly models with per-model licensing; verify attribution requirements.
- Sketchfab downloadable models: https://sketchfab.com — filter to downloadable assets and inspect each model's exact license before use.
- ambientCG: https://ambientcg.com — PBR materials and HDRIs; verify current license and file formats.
- Poly Haven: https://polyhaven.com — textures, HDRIs and models with permissive licensing; optimize files for mobile.

A free downloader can automate discovery and fetching, but must not bypass access controls or license checks. Prefer official downloads/API or a downloader that preserves source URL, author, license, attribution text and original filename. Do not scrape or mirror content contrary to a source's terms.

## Import pipeline
1. Discover candidate assets by category: avatar base/body, hair, headwear, eyewear, masks, tops, bottoms, footwear, back items, hand-held props, emotes/poses, profile frames/banners, and per-game environments/characters/effects/UI audio.
2. Record source URL, author, license identifier, attribution requirement, download date, file type, original filename and intended in-game use in a machine-readable manifest. Reject unknown or incompatible licenses.
3. Convert models to glTF/GLB where permitted; use sensible mesh complexity, texture atlases, compressed textures where supported, level-of-detail variants and lazy loading. Preserve source files outside the runtime bundle.
4. Validate scale, origin, rig compatibility, materials, texture paths, animation clips, mobile GPU budget and visual consistency before importing.
5. Store production assets in Cloudflare R2 only after bucket access, CORS, public/custom-domain delivery and cache behavior have been verified. Keep private uploads and secrets private; never expose R2 credentials in client code.
6. Use immutable/versioned object paths and cache headers. Maintain an origin fallback and manifest so a failed CDN request cannot blank the editor or game.
7. Add each approved asset to the actual catalog and renderer, then test equip/unequip, persistence, ownership, mobile layout, fallbacks and network failures.

## 1,000+ rotating cosmetics: honest implementation target
A catalog count is not the same as 1,000 individually modeled 3D meshes. Build toward 1,000+ distinct catalog entries across wearable slots, materials, colors, patterns, trails, emotes, profile frames, banners and titles. Reuse a compatible modular base mesh only where it remains visually coherent; rare premium items should have genuinely distinctive silhouettes/materials/animation, not merely a renamed color. Track whether each item is a unique mesh, a material variant, a combination, or a profile-only cosmetic. Do not advertise 1,000 individually modeled assets unless 1,000 distinct authored models actually exist.

Use a server-controlled rotating shop schedule with featured slots, rarity weights, duplicate protection, inventory/ownership checks and cosmetic-only pricing. A rotation must not delete a player's purchased/unlocked item or change its ownership.

## AAA-quality release gate (not satisfied by a code merge alone)
- Visual: consistent art direction, high-quality lighting/materials, legible HUD, polished transitions, quality game-specific environments/effects, no placeholder/stock-looking assets.
- Gameplay: controls and collisions feel intentional; difficulty curve, feedback, audio, pause/restart, touch/keyboard input and end-of-run flow work without blocking bugs.
- Reliability: no console errors, missing assets, broken routes, save failures, duplicated rewards or exploitable purchase/unlock flows.
- Performance: test representative low/mid-range Android devices; target stable 60 FPS where feasible, with graceful quality scaling and reduced-motion support.
- QA: smoke-test every game, then run a full regression suite and a private player test. Publish a game only after its own checklist passes; don't label the entire library AAA until each game passes.

## Execution order
1. Audit the current avatar renderer/editor and server-side cosmetic schema.
2. Fix existing avatar bugs and add a documented, license-tracked asset manifest/import pipeline.
3. Integrate a small high-quality, cohesive asset pack and verify R2 delivery end-to-end before bulk import.
4. Expand wearable slots/catalog and rotating shop, keeping server-side ownership and payment validation.
5. Upgrade games one at a time; prioritize the most-used games and require before/after screenshots, device testing and regression results.
6. Verify deployment health, storage persistence, CDN headers, checkout/webhooks and backup/restore before public launch.
