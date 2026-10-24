# Bud Escape art (game id `jetpack-dash`)

Bud Escape is drawn in one chunky, thick-outline cartoon style. Most of the scene, the hazards, the hover-dolly and the
vehicles are **toon renders**: CC0 3D models (Kenney kits) plus a few models built in code for things no free pack has
(cannabis plants, blunt, bong, leaf glider, hoverboard, nutrient-tank walker, seed-pod hopper, inspection cart). They are
rendered side-on with cel shading by `toon.html`, then outlined and packed with the 2D art by `build.py`.
Everything is CC0 or public domain; nothing is taken from another game. `build.py` + `models.json` are the licence record.

| Source | Licence | Used for |
|---|---|---|
| Kenney Factory Kit (3D) | CC0 | harvest-arm robot arm and cog, laser emitters, ceiling pipes, machines, hoppers, cones, boxes, hanging screens |
| Kenney Space Station Kit (3D) | CC0 | lab wall modules (windows, pillars, doors, displays), floor rail, tanks, computer desks |
| Kenney Tower Defense Kit (3D) | CC0 | security drones (UFOs with turrets), zapper nodes, drone shots |
| Kenney Space Kit, Car Kit, Survival Kit (3D) | CC0 | Resin Rocket Sled, Seed Pod Cannon Cart chassis, generators, barrels, metal panels |
| Built in `toon.html` (MIT, this repo) | — | cannabis plants, Rolling Blunt, Bong Hover, Trichome Glider, Smoke Cloud Board, Hydroponic Walker tank, cannon hopper, hover-dolly |
| GameArt2D "Red Hat Boy" (cap recoloured green) | CC0 | Cash Green (idle, fly, hurt, death animations) |
| GameArt2D "Free Sci-Fi Platformer Tileset" / "Free Plane Sprite" | CC0 | barrels, saw blade |
| "FreeArt boxes & crates" (OpenGameArt) | CC0 | rainbow strain crates |
| Kenney Toon Characters, Platformer Pack Industrial, New Platformer Pack, Smoke Particles, Particle Pack (2D) | CC0 | warehouse staff, beacons, nugs, chains, seed pods, explosions, smoke, flames, glows |
| Openclipart 277751 (leaf), 1594 (security camera) | Public domain | seed-bag and crate marks, wall cameras |

Rebuild:

1. Download the Kenney 3D kits (factory-kit, space-station-kit, tower-defense-kit, space-kit, car-kit, survival-kit) and
   serve a folder holding `toon.html`, `vendor/` (copy of `public/games-lib/vendor`) and the kits' `GLB format` folders as
   `factory/`, `station/`, `td/`, `space/`, `car/`, `survival/`: `python3 -m http.server 8794 --bind 127.0.0.1`
2. `node toon.js models.json <src>/r3d` (one PNG per model; `ONLY=name1,name2` re-renders a subset).
3. Download the 2D packs (GameArt2D `redhatfiles.zip`, `freescifiplatform.zip`, `free_plane_sprite.zip`; OpenGameArt
   `FreeArt_boxe&crates1.zip`; Kenney 2D packs) and lay them out as described at the top of `build.py`; render the two
   Openclipart SVGs into `<src>/oc/` with `node svg2png.js`.
4. `python3 -I build.py <src> public/assets/bud-escape` (writes `atlas.webp` + `atlas.json`).
