# Asset Manifest — Existing Cosmetic IDs → Finished Assets

All existing IDs are preserved. Assets will be served from Cloudflare R2 once uploaded.

## Preferred sources
- Quaternius modular characters / outfits (CC0)
- Poly Haven PBR materials and HDRIs (CC0)
- KayKit / Kenney for supporting props

## Manifest (sample — expand to cover every ID)

| ID | Type | Target asset | Source | License |
|---|---|---|---|---|
| midnight | banner | night-sky-hdr.hdr | Poly Haven | CC0 |
| neon-grid | banner | cyber-grid.png | Quaternius / original | CC0 |
| synthwave | banner | synthwave-sunset.png | Poly Haven | CC0 |
| aurora | banner | aurora-borealis.hdr | Poly Haven | CC0 |
| plasma | banner | plasma-swirl.png | generated high-quality | original |
| gold-rush | banner | gold-texture.png | Poly Haven | CC0 |
| ice | banner | ice-crystal.png | Poly Haven | CC0 |
| legend-aurora | banner | legendary-aurora.hdr | Poly Haven | CC0 |
| rainbow | frame | rainbow-ring.png | original / Kenney | CC0 |
| gold | frame | gold-ring.png | Poly Haven | CC0 |
| plasma | frame | plasma-ring.png | original | original |
| legend-crest | frame | legend-crest.png | original | original |
| staff-glow | frame | staff-glow.png | original | original |

## Next steps
1. Restore cosmetics.js from 10b4441
2. Expand this manifest to every existing ID
3. Download, license-check, and upload assets to R2
4. Update cosmetics.js and shop.js to load from R2 URLs
5. Verify ownership and equip flow

## R2 setup (once bucket exists)
- Custom domain: assets.yourdomain.com
- Public access via custom domain
- Versioned paths: /cosmetics/v1/<id>.png
