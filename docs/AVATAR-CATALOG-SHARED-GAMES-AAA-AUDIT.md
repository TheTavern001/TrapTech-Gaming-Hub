# Avatar Asset Selection, Shared-Avatar Games, and AAA Audit Plan

Status: planning/specification committed for implementation. This file does not claim that packs have already been downloaded, uploaded to Cloudflare, or integrated.

## Art direction (approved)
- Primary avatar base: clean, stylized, readable 3D characters; blocky enough to feel game-like, but not crude voxel/low-poly silhouettes.
- Preferred starting references:
  - https://quaternius.com/packs/ultimatemodularwomen.html
  - https://quaternius.com/packs/ultimatemodularcharacters.html
  - https://quaternius.com/packs/ultimatedanimatedcharacter.html
- Use the modular women/characters packs as the first customization candidate; use the animated pack as a candidate source for NPCs, locomotion/gesture clips, and possible playable character prototypes. Do not assume all three packs share one skeleton or that all clothes fit the same rig without conversion/retargeting tests.
- Keep gender/presentation options male, female, and other; skin, face, hair/style/color, eyes, mouth, facial hair, outfit, headwear, accessory, held item, background, body/build and future slots. Do not force users into a binary-only presentation.
- Premium UI: purple sci-fi stage, tasteful glow and high-contrast rarity treatment, purple-to-gold primary CTA. Avoid clutter and overly blocky Poly Pizza assets; each Poly Pizza model must pass a strict silhouette, material, rig and art-direction review.

## First-pass source shortlist (license-check each individual pack)
1. Quaternius — https://quaternius.com/ — first choice for coherent stylized characters, modular outfits, props, environments and animation packs. Many older pages explicitly state CC0; verify the exact pack page and archive it with the downloaded files.
2. Quaternius Modular Character Outfits - Fantasy — https://quaternius.com/packs/modularcharacteroutfitsfantasy.html — 12 outfits, 62 modular parts and 3 texture variants per outfit; listed as humanoid-rig compatible and CC0. This is a strong test for modular attachment/rig compatibility, although the fantasy theme is only one part of the shop.
3. Quaternius Universal Base Characters — https://quaternius.com/packs/universalbasecharacters.html — candidate common humanoid base. Confirm current URL/pack details before automated download.
4. Poly Haven — https://polyhaven.com/ — CC0 PBR materials, HDRIs and models. Best used to improve environments, materials, lighting and scene realism, not as the primary clothing catalog. Official license: https://polyhaven.com/license
5. Poly Pizza — https://poly.pizza/ — selective use only. Model-by-model review for style, polygon density, texture quality, license, rig and compatibility; reject assets that look too blocky.
6. Kenney — https://kenney.nl/assets — good for consistent supporting props/UI/gameplay kits; check the license on each pack.
7. KayKit — https://kaylousberg.com/game-assets — useful stylized characters, props and environment packs; check individual pack license and style fit.
8. Mixamo — https://www.mixamo.com/ — candidate animation/rigging service for compatible characters. Confirm Adobe account/service terms and exported asset rights; do not assume it is a source of clothing meshes.
9. Sketchfab downloadable models — https://sketchfab.com/ — use only downloadable models whose exact license permits commercial game use and redistribution as part of the game. Avoid NC, ND, unclear and restricted licenses.
10. ambientCG — https://ambientcg.com/ — CC0 PBR materials for roads, concrete, metals, walls, floors and props; use optimized 1K/2K runtime maps where sufficient.
11. OpenGameArt — https://opengameart.org/ — supplemental audio, 2D art and occasional 3D assets; licenses vary by upload, so review each file.
12. Poly Haven API — https://polyhaven.com/our-api — investigate for metadata/discovery and controlled downloads; follow current API terms/rate limits, and do not bulk-scrape the website.

## 1,000+ cosmetic inventory model
Aim for 1,000+ catalog entries, not a false claim of 1,000 separately modeled meshes. Track each item with a stable ID, slot, display name, description, rarity, source pack, original file, license, author, attribution, model/material/texture references, rig compatibility, estimated triangle count, texture memory, preview image, unlock/price rules, release state and review status.

Catalog slots should include hair, headwear, eyewear, face accessories, masks, tops, jackets, bottoms, shoes, gloves, backpacks/back items, shoulder items, jewelry, handheld props, emotes/poses, trails, spawn effects, profile frames, banners, badges and titles. Use color/material variants where they genuinely add variety, but label them as variants—not unique meshes. Keep a smaller number of genuinely distinctive premium models, animations and effects.

The shop must rotate on a server-defined schedule, support featured items and rarity, and never revoke ownership when a listing rotates out. Duplicate purchase requests must be idempotent. Prices, inventory, unlocks and balances are server-authoritative. Paid cosmetics grant no competitive advantage and must not change scores, hitboxes, physics or game difficulty.

## Shared player avatar in selected games
Implement this as a reusable integration, not a one-off fork per game:
1. Define a versioned avatar export schema and a server-authorized endpoint that returns only owned/equipped cosmetic IDs and validated appearance settings.
2. Build a shared runtime adapter that maps the account avatar to each supported game's compatible rig, materials and attachment points.
3. Begin with 2-3 games whose camera and gameplay benefit from visible player characters. Do not force a third-person avatar into games where the player is not visible or it damages gameplay.
4. Use a compatible humanoid skeleton and retarget animations where needed. Validate idle, run, jump, fall, hit, emote and game-specific action clips; fix foot sliding, clipping, attachment offsets and mismatched proportions.
5. Cache common base meshes and textures; lazy-load cosmetics; use texture atlases/material reuse and LODs where appropriate. Include a silhouette/placeholder fallback when a model fails.
6. Keep avatar cosmetics visual-only: no different collision capsule, speed, reach, weapon stats or score behavior.
7. Test signed-in and guest modes, equipped/unequipped items, ownership validation, save/load, reload, mobile controls, missing CDN assets and performance.

## Cloudflare delivery plan
- Do not assume Cloudflare R2 is already configured merely because Cloudflare is connected to the domain. Previous project state says R2/provider configuration still needs verification.
- Confirm the bucket exists, upload permissions, custom domain/public access policy, CORS, cache headers, MIME types, file size limits, and origin fallback before moving production references.
- Use immutable versioned paths, a generated manifest and integrity/hash checks. Keep credentials server-side; no R2 secrets in browser code.
- Store original license/source records alongside internal asset metadata. Do not serve source archives or unnecessary authoring files publicly.
- Deploy a tiny pilot pack first, then measure first-load time, mobile memory, texture bandwidth and CDN hit rate before bulk upload.

## AAA audit matrix (test evidence required)
- Visual/art direction: consistent materials, lighting, shadows, environment scale, readable typography, polished HUD, transitions, VFX and audio. Use Poly Haven to enhance PBR environments; do not apply photorealistic materials indiscriminately to stylized games.
- Gameplay: controls, collisions, timing, difficulty curve, feedback, pause/resume/restart, win/loss and replay loop.
- Avatar: silhouette, clipping, rig/animation quality, skin/hair/material quality, attachment points, persistence and fallback.
- Mobile: Android touch targets, responsive UI, orientation, thermal/performance behavior, memory, reduced motion and keyboard/accessibility paths.
- Reliability: console/network errors, missing assets, broken routes, failed saves, duplicate rewards, stale caches and CDN outages.
- Security/economy: server-side score verification, replay/idempotency, currency ledger integrity, purchase webhook validation, ownership/unlock enforcement, giveaway/winner integrity and admin permissions.
- Operations: backups, restore test, migration rollback, error logging, health endpoint, deployment version, domain/TLS, CDN/cache purge strategy and launch rollback.
- Licensing: record the exact pack license at acquisition time; flag unclear, NC, ND, attribution-incomplete or redistribution-restricted files before they enter a production build.

## Acceptance criteria before claiming completion
- No pack is called integrated until actual files are downloaded, validated, committed or uploaded, and loaded by the application.
- No item count is advertised without a generated catalog report distinguishing unique meshes from variants and profile-only items.
- No game is marked AAA-ready without a recorded desktop and Android test pass, a gameplay review, performance evidence and zero release-blocking defects.
- Cloudflare delivery is not marked verified until the deployed site successfully loads test assets through the intended public asset URL and survives cache refresh/fallback tests.
- Start with the avatar pilot and two selected games, prove the complete pipeline, then scale up. The entire hub remains unreleased until its launch gates pass.
