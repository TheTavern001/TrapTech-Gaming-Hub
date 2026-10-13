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

## Cross-source integration contract (2026-10-12)
Use all relevant, compatible asset sources in the research pool—not every file indiscriminately. The goal is a coherent game, not a collage of unrelated packs. Every source below is an approved discovery lane; each individual asset still needs a license, technical-fit and art-direction check before shipping.

### Source roles
| Source | Best-fit role | Integration rule |
|---|---|---|
| Kenney (kenney.nl/assets) | 2D sprites, tilesets, props, UI, effects, audio and selected 3D packs | Prefer cohesive packs; retain the pack's license file and use only required files. Official support states Kenney packs are CC0; verify the exact pack/archive. |
| Quaternius (quaternius.com and official Quaternius itch.io pages) | Stylized 3D characters, modular outfits, environments, props and retargetable animation | Favor compatible base rigs and animation libraries; test GLTF/GLB materials, skeleton and clip retargeting in our actual Three.js runtime. |
| Poly Haven (polyhaven.com) | PBR materials, HDRIs and selected environment models | Use as the realism/material/lighting layer, not as a substitute for authored level geometry. If using its live API, show a clear “Powered by Poly Haven” credit as required by the API terms; standalone CC0 assets do not themselves require attribution. |
| ambientCG (ambientcg.com) | Additional PBR materials and HDRIs | Match texture scale/roughness/normal conventions; record exact asset and license in the manifest. |
| Poly Pizza (poly.pizza) | Candidate stylized models and props | Per-model license and style review; reject anything that clashes with our chosen character proportions or has unclear rig/rights. |
| Sketchfab (sketchfab.com) | Specific gap-fill models only | Downloadable is not the same as commercially usable; verify per-model license, author, attribution and redistribution terms. Reject unclear, NC, editorial or incompatible assets. |
| OpenGameArt (opengameart.org) | Specific sprites, sound and effects | Check each file's license and attribution requirements; preserve required notices. |
| KayKit (kaylousberg.com/game-assets) | Cohesive stylized environment/character kits where they fit | Check the specific pack terms, formats and technical compatibility. |
| Mixamo (mixamo.com) | Candidate animation/rigging support | Confirm current terms and retargeting compatibility; do not assume animations map correctly across skeletons. |
| Original Gaming Hub art/code | Brand, HUD, interface, bespoke prestige designs and anything that needs a distinctive identity | Preserve the owner's brand direction; do not replace bespoke work with generic third-party placeholders. |

### Shared art direction and technical standards
- **One hub identity:** deep charcoal/navy bases, deliberate purple sci-fi lighting, restrained gold accents for premium moments, clear readable UI, consistent typography and the existing purple-to-gold CTA. Game worlds may have their own palette, but menus, shop, account UI and rarity language must remain recognizably Gaming Hub.
- **Choose a style per game:** do not mix realistic scanned props, flat 2D sprites and toy-like low-poly models in the same scene unless the combination is deliberately art-directed. Kenney assets can fit 2D/arcade games; Quaternius/KayKit/Poly Pizza candidates must pass silhouette/style review; Poly Haven/ambientCG generally supply materials and lighting rather than character style.
- **Shared character pipeline:** one canonical avatar identity and cosmetic definition; map supported items to each game's rig/slots through adapters. Validate skeleton hierarchy, bind pose, scale, origin, bone names, animation retargeting, material slots, skinning and clipping. Unsupported games must show a clearly disclosed fallback, never a broken or misleading model.
- **PBR compatibility:** standardize color space, texture maps, roughness/metalness, normal-map convention, UV scale, tone mapping and exposure. Avoid mixing HDRIs with conflicting white balance or lighting direction. Keep material/lighting presets per game and test in actual scenes.
- **Performance budgets:** use GLB/glTF for web 3D where appropriate; lazy-load per game, compress textures and geometry where supported, atlas 2D sprites, avoid duplicate downloads, and retain mobile-friendly fallback assets. Do not load the entire 1,000+ cosmetic catalog's models into memory at once.
- **Asset manifest:** every imported asset records stable ID, source URL, author, pack/model name, exact license/version, attribution text, date acquired, original filename/hash, optimized runtime path, file size, intended game/slot, rig/material dependencies and approval status. Do not publish assets until the record is complete.
- **Shared visual QA:** preview on phone and desktop; check lighting, scale, clipping, transparency, texture seams, animation, audio level, frame time, memory and network failures. Capture before/after images and compare in-context, not only on the asset website.
- **No blind bulk import:** a large pack may be used for discovery, but only curated, tested files ship. Respect source terms and do not rehost entire packs as a standalone asset library.

### Acceptance gate for each asset integration
1. Asset license and attribution verified.
2. Asset imported into the intended runtime, not merely copied into the repository.
3. Style and scale reviewed against neighboring assets.
4. Interaction/gameplay connected (collision, animation, effects, feedback or UI behavior as applicable).
5. Desktop and mobile smoke tests pass; performance and fallbacks checked.
6. Credits/manifest updated; old version remains available for rollback until the new one passes.

Status note: this section defines the integration standard. It does not claim every source has been downloaded, every asset has been integrated, or that the live site has passed these checks.

## Five-deployment release batching and frame-rate acceptance (October 2026)

Plan *roughly five candidate deployment batches*, with a successful Deplexo build and stable runtime verified after each. This is a release-management target, **not** a claim that hundreds of games can become AAA through five automated builds without device/playthrough evidence.

1. Shared visual foundation: uncropped official header brand, deterministic starter avatar with male/female/other presentation, preview-before-buy, reusable 3D geometry, adaptive frame budgets.
2. All active core games and the existing Games Library: visual/playability/duplicate review; shared-engine optimizations first, per-title fixes based on measured failures.
3. Economy, achievement, shop, avatar inventory, quests, giveaways, account and payment/persistence regressions, with 10k-user workload scripts on isolated test data.
4. Distinct vetted games to approximately 500 in reviewable batches; run automated scans for missing assets, invalid scores, rights and mechanical duplicates.
5. Complete deployment and load-validation gate, phone and desktop playthrough evidence, backup/restore rehearsal, payment-provider approval and **only then** public launch.

**Visual performance contract:** target 60 FPS at native display refresh where feasible; target p95 frame time <= 16.7 ms on capable test devices. Sustained <45 FPS or p95 >25 ms during active gameplay requires a performance fix or a documented device-tier quality setting. No gameplay speed changes when graphics scale. Keep full-resolution source art of at least 1280x720 for appropriate backgrounds and up to 4K where useful; runtime resolution should adapt to the device instead of forcing 4K rasterization on phones. Canvas backing-store DPR is allowed to lower to preserve frame pacing; preserve touch/score coordinates and never tie scoring to rendered frame count.

**Evidence required per title:** 120-second run with first 20 seconds warmup and event-heavy segment, render resolution/DPR, FPS median/5th percentile, p95 frame time, JS frame cost, paused/resumed state, signed score submission/replay rejection, and Android touch screenshots. The existing Kit exposes `window.__GL.fps`, `frameMsP95`, `renderDpr` and `jsMs` for automated browser collection; 3D games must log GPU draw calls and triangles where supported. A headless WebGL emulator does not substitute for physical Android measurements.

## Rigged avatar asset candidates (verified source pages)

- Quaternius [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html): official CC0 six-base humanoid pack with roughly 13k-triangle rigged characters, 20 hairstyle options, and glTF/FBX. The free Standard download is large (~122 MB); extract only compatible approved optimized models, not the whole archive.
- Quaternius [Universal Animation Library](https://quaternius.itch.io/universal-animation-library): free CC0 Standard version with 120+ animation clips; validate rig retargeting, root motion, emotes, CPU/GPU cost and skinning before integration.
- Kenney [Animated Characters](https://kenney.nl/assets?series=Animated+Characters): CC0 smaller rigged fallback. Do not replace the premium visual reference with generic low-poly meshes to satisfy a checklist.

These are researched candidates, NOT downloaded or integrated yet. Preserve author/license/URL/hash in the asset manifest, vet all styles against the reference, and do not reset existing player cosmetic ownership when migrating to a rigged avatar.

## Asset-led QA feedback — October 13, 2026

**Confirmed desired art direction:** character models and interchangeable clothes from Quaternius [Ultimate Modular Men](https://quaternius.com/packs/ultimatemodularcharacters.html) and [Ultimate Modular Women](https://quaternius.com/packs/ultimatemodularwomen.html), with Universal Base Characters as a compatibility candidate. Official Quaternius sites list these packs as CC0 with modular parts and animation. In this phase the repository's existing licensed game card/prop art is reused for avatar item inventory art and per-game achievement plaques, rather than promising newly imported Quaternius rigs that are not yet staged. **No external model archive has been successfully downloaded in this phase.** A release candidate needs optimized glTF/GLB, rig/retarget QA, attachment compatibility, proof of licensing, working mobile rendering and fallback before being called AAA.

**Achievement art:** when an achievement belongs to a game, its real game-card art is used as the primary motif and rarity silhouette/icon is layered on top; non-game achievements retain a badge glyph. Avoid repeating a generic profile face as artwork for every different achievement or accessory.

**Avatar earning:** all normal paid/achievement-locked avatar items support Hub Points obtained by playing in addition to their existing Crowns or achievement route. Strictly unique one-of-one Prestige keeps inventory exclusivity; event prizes are a separate approved earning route, never a repeatable Points purchase. New accounts still receive identical starter config; saved avatars and purchased rights are not overwritten.

**External free assets not yet imported:** Quaternius Men/Women, Kenney UI Pack Sci-fi, Kenney Game Icons, Kenney Medals, Poly Haven lighting/materials, ambientCG PBR. For imported assets, include exact original pack/version/license and optimized manifests, rather than assuming the word 'free' alone grants redistribution rights.

## Imported licensed character and achievement art (2026-10-13)

- **Quaternius Ultimate Modular Men / Ultimate Modular Women — Adventurer**: Actual glTF exports from the @Quaternius CC0 1.0 packs are now bundled in `public/assets/avatars/rigged/` (2 self-contained rigged models, 24 animation clips each, Idle selected). Source: https://github.com/agentkaerf/FreeModels ; official packs https://quaternius.com/packs/ultimatemodularcharacters.html and https://quaternius.com/packs/ultimatemodularwomen.html. License and individual-model provenance preserved in `CREDITS.md` and `LICENSE-Quaternius-CC0.txt`. The Three.js GLTFLoader/SkeletonUtils source is already vendored locally. The new interactive avatar uses these **actual character meshes**, not handcrafted primitive stand-ins, for the compatible shared Adventure Captain starter. Male/female/other presentation is supported; other starts with canonical default rig. Native phone art/animation quality and rig orientation still require hands-on review.
- **Kenney Medals**: Nine `shaded_medal*.png` CC0 assets are bundled under `public/assets/vendor/kenney/medals/` and layered onto achievement cards for distinct game award artwork; original pack https://kenney.nl/assets/medals. Gameplay-specific achievements also use real game-card art rather than avatar faces.
- **Wardrobe limitation:** Only the compatible Adventure Captain starter outfit and default face/hair/attachments use the Quaternius rig so far. Other 3D wardrobe items still need verified mesh rigging, sockets, clipping checks and asset imports; the renderer explicitly falls back to earlier geometry rather than silently showing a purchase that is invisible. The editor exposes a non-destructive “Try upgraded starter avatar” button for existing users. Do not certify the system AAA until all wearables render coherently and persist across devices.
