# AAA Cosmetics Upgrade Plan

## Goal
Every existing handmade cosmetic and shop item upgraded to high-quality multi-layer SVG/CSS with consistent art direction, richer lighting, subtle animation, and zero ID changes. Procedural generator improved for less generic 12k universe items.

## Status
- Expansion modules created
- cosmetics.js is currently a stub and must be restored from commit 10b4441 before Phase 1 can be fully applied
- src/cosmetics-aaa.js contains high-quality upgrades for key handmade items (same IDs)
- shop.js and shop-gen.js remain intact

## Phase 1 — Restore & upgrade handmade items (IDs preserved)
1. Restore src/cosmetics.js from commit 10b4441 (manual or via git checkout)
2. Merge AAA upgrades from src/cosmetics-aaa.js into the restored file
3. Upgrade handmade ITEMS in src/shop.js the same way
4. Keep every existing ID identical

## Phase 2 — Procedural generator quality
1. Improve motifs and palettes in src/shop-gen.js
2. Add more motif variety and better lighting/sheen treatment

## Phase 3 — Verification
1. Run tools/test-cosmetic-rewards.js
2. Confirm no missing IDs, no broken CSS, no ownership regressions

## Phase 4 — True 3D (later)
- Quaternius modular characters + Poly Haven materials via Cloudflare R2
- Shared avatar runtime
- Requires Oracle VM + R2 setup first

## Next action
Restore cosmetics.js from 10b4441, then merge cosmetics-aaa.js upgrades.
