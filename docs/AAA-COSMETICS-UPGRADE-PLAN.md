# AAA Cosmetics Upgrade Plan

## Goal
Every existing handmade cosmetic and shop item upgraded to high-quality multi-layer SVG/CSS with consistent art direction, richer lighting, subtle animation, and zero ID changes. Procedural generator improved for less generic 12k universe items.

## Status
- Expansion modules created: cosmetics-expansion.js, achievements-expansion.js, quests-expansion.js
- cosmetics.js was accidentally stubbed and needs restoration from commit 10b4441 before further edits
- shop.js and shop-gen.js are intact

## Phase 1 — Restore & upgrade handmade items (IDs preserved)
1. Restore src/cosmetics.js from commit 10b4441
2. Upgrade every banner, frame, title, color, and effect with multi-layer SVG, better gradients, sheen, and subtle animation
3. Upgrade handmade ITEMS in src/shop.js the same way
4. Keep every existing ID identical so ownership and shop history are untouched

## Phase 2 — Procedural generator quality
1. Improve motifs and palettes in src/shop-gen.js
2. Add more motif variety and better lighting/sheen treatment for the 12,000 universe items

## Phase 3 — Verification
1. Run tools/test-cosmetic-rewards.js
2. Confirm no missing IDs, no broken CSS, no ownership regressions
3. Manual check of shop, customize, and profile pages

## Phase 4 — True 3D (later)
- Quaternius modular characters + Poly Haven materials via Cloudflare R2
- Shared avatar runtime for equipped cosmetics
- Requires Oracle VM + R2 setup first

## Next action
Restore cosmetics.js, then begin Phase 1 visual upgrades.
