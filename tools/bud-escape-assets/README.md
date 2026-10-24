# Bud Escape art (game id `jetpack-dash`)

Everything in `public/assets/bud-escape/atlas.webp` comes from finished CC0 / public-domain packs; nothing is ripped from
another game. `build.py` is the licence record: it lists every sprite and where it comes from.

| Source | Licence | Used for |
|---|---|---|
| Kenney Toon Characters (Male person, Female person, Male adventurer, Robot) | CC0 | Cash Green, warehouse staff, security robot |
| Kenney Platformer Pack Industrial | CC0 | walls, floor, hazard stripes, pillars, crates, barrels, beacons, signs, terminals, saw blades, zapper bars |
| Kenney Robot Pack | CC0 | security drones, Hydroponic Walker, Resin Rocket Sled, Seed Pod Cannon Cart |
| Kenney New Platformer Pack | CC0 | nugs (green gems), chains, seed pods (bombs) |
| Kenney Smoke Particles, Particle Pack | CC0 | explosions, smoke, thruster flames, glows, shockwave ring |
| Kenney Space Shooter Remastered | CC0 | drone shots |
| Openclipart 265563 / 238184 (cannabis plants), 277751 (leaf), 320677 (bong), 1594 (security camera) | Public domain | grow racks, crates, Trichome Glider, Bong Hover, wall camera |

Rebuild:

1. Download the packs from kenney.nl (zip per pack) and unzip each into `<kenney>/kenney_<pack>/`.
2. Download the Openclipart SVGs (`https://openclipart.org/download/<id>`) and render each to `<oc>/oc-<id>.png`:
   `node svg2png.js <oc>/oc-<id>.png 400 <oc>/oc-<id>.svg`
3. `python3 -I build.py <kenney> <oc> public/assets/bud-escape` (writes `atlas.webp` + `atlas.json`).
