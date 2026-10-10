# Shared asset library - per-asset licence record
Rejected outright: NC, editorial-only, engine-locked (Unity Asset Store / Fab standard EULA), ripped/commercial-game assets.

| Files | Source | Author | Licence | Commercial in-game OK | Used by |
|---|---|---|---|---|---|
| hero.glb, chaser2.glb | Universal Base Characters [Standard] + Universal Animation Library [Standard] (itch.io) | Quaternius | CC0 | yes | rail-rush |
| qn-*.glb | Stylized Nature MegaKit [Standard] (itch.io) | Quaternius | CC0 | yes | lane-racer (+ ruin-runner planned) |
| cv-*.glb | Cartoon Vehicles Pack 1 (opengameart.org/content/cartoon-vehicles-pack-1) | Divinux | CC0 | yes | lane-racer |
| ot-*, ds-*, ru-*, tr-*, pu-*, rail, coin, bld*, lamp, barrier, runner, chaser, train | Kenney Fantasy Town / Nature / Retro Urban / Train / City / Platformer / Mini Characters kits | Kenney | CC0 | yes | rail-rush |
| tex/ph-asphalt02-*.webp, tex/ph-grass-rock-diff.webp | Poly Haven (asphalt_02, aerial_grass_rock) | Poly Haven | CC0 | yes | lane-racer |
| vendor/three*, addons | three.js | mrdoob et al. | MIT | yes | all 3D |
No Mixamo content is shipped yet (if added: Adobe terms, in-game use only, never redistributed as raw files).

## Hub car set (rc-*.glb), original work, CC0 (Gaming Hub)
- rc-sedan, rc-hatch, rc-suv, rc-van, rc-pickup, rc-boxtruck. Built procedurally in Blender 4.2 by `tools/blender/hub-cars.py` (extruded profiles, bevels, boolean wheel arches, tumblehome glasshouse, B-pillars, mirrors, lights, bumpers, chrome strip, 20-segment tyres with rims and hubs).
- About 2.2-2.4k triangles and about 40 KB each. Material slots are named paint, glass, chrome, rim, tire, trim, light_f, light_r and box; racer3x.js maps them to shared PBR materials (clearcoat paint, physical glass, env-mapped chrome).
- Used by every racer3x game (Lane Racer, Moto Lanes). The old cv-* names are aliased.
