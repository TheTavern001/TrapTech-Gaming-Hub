# Free CC0 Asset Polish Plan — 2026-10-15

Target: raise perceived quality of featured games toward AAA polish using free commercial-safe assets without changing scoring or competitive envelopes.

## Recommended sources (all CC0 or clearly commercial)
- Kenney.nl — UI packs, sprites, audio, icons (consistent style)
- Quaternius.com — low-poly 3D characters, vehicles, environments
- Poly Haven — PBR textures, HDRIs
- OpenGameArt / itch.io free — verify license per pack

## Priority games for visual upgrade
1. Terp Tapper — neon orbs, lane markers, combo particles (Kenney UI + simple particles)
2. Drift Rush / Rail Rush — vehicle meshes (Quaternius), road textures (Poly Haven)
3. Neon Munchies — collectible sprites and HUD icons (Kenney)
4. Tower-defense titles — unit and tower icons (Kenney)

## Integration rules
- Keep existing collision envelopes and score formulas unchanged.
- Prefer sprite sheets / GLTF that already exist in the repo or can be dropped into public/assets/.
- Credit in CREDITS.md even though CC0 does not require it.
- Device QA still required before any title is marked certified.

Juice helpers live in public/js/juice.js (flash, scorePop, lightShake). Games import and call them on hit/combo/miss events.
