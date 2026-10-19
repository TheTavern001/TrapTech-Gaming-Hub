# Phase 1 AAA Visual Upgrades

## Status
High-quality multi-layer SVG/CSS upgrades are ready in:
- `src/cosmetics-aaa-full.js` — upgraded banners and frames (same IDs)

## To apply
1. Restore `src/cosmetics.js` from commit `10b4441`:
   ```bash
   git checkout 10b4441 -- src/cosmetics.js
   ```
2. In the restored file, replace the CSS values for the IDs listed in `cosmetics-aaa-full.js` with the upgraded versions.
3. Do the same for handmade items in `src/shop.js`.
4. Redeploy and run `node tools/test-cosmetic-rewards.js`.

## What was upgraded
- Richer multi-layer gradients
- Better lighting and sheen
- Subtle animation preserved
- Consistent art direction
- All existing IDs unchanged

## Next
Once cosmetics.js is restored and the upgrades are merged, Phase 2 (procedural generator quality) can begin.
