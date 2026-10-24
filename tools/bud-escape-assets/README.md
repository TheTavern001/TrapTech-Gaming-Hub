# Bud Escape art (game id `jetpack-dash`)

Bud Escape uses finished, downloaded art in the bright, thick-outline cartoon look of the reference game. Everything is CC0 or
public domain; nothing is taken from another game. `build.py` lists every sprite and its source and is the licence record.
Kenney and Openclipart pieces get the same dark outline as the GameArt2D art so the set reads as one style.

| Source | Licence | Used for |
|---|---|---|
| GameArt2D "Red Hat Boy" (gameart2d.com/red-hat-boy-free-sprites.html), cap recoloured green | CC0 | Cash Green (idle, fly, hurt, death animations) |
| GameArt2D "Free Sci-Fi Platformer Tileset" | CC0 | ceiling and floor tiles, hover-dolly deck, barrels, sci-fi box, saw blade, wall switches, fence |
| GameArt2D "Free Plane Sprite" (bullet) | CC0 | drone shots |
| ask4asset "Sci-Fi Background" (opengameart.org/content/sci-fi-background) | CC0 | corridor wall with windows (`wall.webp`) |
| hamcav90 "Sci-Fi Flying Robo Orb" (opengameart.org/content/sci-fi-explosive-robo-orb) | CC0 | security drones |
| "FreeArt boxes & crates" (opengameart.org/content/boxes-and-crates-svg-and-pngs) | CC0 | crates, storage boxes, rainbow strain crates, blue government crates |
| Kenney Toon Characters, Platformer Pack Industrial, Robot Pack, New Platformer Pack, Smoke Particles, Particle Pack | CC0 | warehouse staff, beacons, hazard stripes, terminals, nugs, chains, seed pods, vehicles, explosions, smoke, flames, glows |
| Openclipart 265563 / 238184 (cannabis plants), 277751 (leaf), 320677 (bong), 1594 (security camera) | Public domain | grow room, crate and seed-bag marks, Trichome Glider, Bong Hover, wall cameras |

Rebuild:

1. Download the zips above (GameArt2D: `redhatfiles.zip`, `freescifiplatform.zip`, `free_plane_sprite.zip`; OpenGameArt:
   `Orb.zip`, `FreeArt_boxe&crates1.zip`, `sci_fi_bg_freebie_ask4asset.com_.zip`; Kenney: one zip per pack from kenney.nl).
2. Lay them out as described at the top of `build.py` (`ga/`, `oga/orb`, `oga/crates`, `oga/scifi_bg1.jpg`, `kenney/kenney_<pack>/`).
3. Render the Openclipart SVGs (`https://openclipart.org/download/<id>`) into `oc/`: `node svg2png.js oc/oc-<id>.png 400 oc-<id>.svg`
4. `python3 -I build.py <src> public/assets/bud-escape` (writes `atlas.webp`, `atlas.json`, `wall.webp`).
