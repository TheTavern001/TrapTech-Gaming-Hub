# AAA Cosmetics — Finished Asset Import Plan

## Direction change
Handmade CSS/SVG designs are being phased out. Every cosmetic will use imported finished assets (3D models, textures, or high-quality 2D art) instead of generated CSS.

## Preferred sources (license-check each)
1. Quaternius — modular characters, outfits, props (CC0)
2. Poly Haven — PBR materials, HDRIs, models (CC0)
3. KayKit — stylized characters and props
4. Kenney — consistent supporting kits
5. Other CC0 / commercially cleared packs

## Implementation steps
1. Restore `src/cosmetics.js` from commit `10b4441` (required before any ID changes)
2. Create an asset manifest that maps every existing cosmetic ID to a finished asset (model, texture, or high-quality image)
3. Download and validate packs; record exact license per file
4. Upload assets to Cloudflare R2 with versioned paths
5. Update the cosmetics and shop systems to load assets from R2 instead of CSS/SVG
6. Wire equipped cosmetics into the avatar runtime
7. Verify ownership, equip, and shop history remain intact
8. Remove or deprecate handmade CSS definitions once assets are live

## Constraints
- All existing cosmetic IDs must be preserved so ownership and shop history are not broken
- Assets must be commercially cleared (no NC, ND, or restricted licenses)
- Oracle VM + Cloudflare R2 setup is required for delivery

## Status
Plan created. Waiting on cosmetics.js restore and R2/Oracle setup before asset import begins.
