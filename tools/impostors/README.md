# Photoreal tree / bush impostors (Drift Rush and future 3D games)

Heavy Poly Haven (CC0) vegetation models are rendered once into transparent cards; in game each plant is two crossed
quads (4 triangles), so dozens fit the phone budget.

1. `python3 -I fetch-polyhaven.py <work>/ph island_tree_02 fir_sapling searsia_lucida fern_02` (1k glTF, via curl)
2. Serve a folder containing `render.html`, `vendor/` (copy of `public/games-lib/vendor`) and `ph/` with
   `python3 -m http.server 8792 --bind 127.0.0.1`
3. `node render.js <out> island_tree_02:-:0 island_tree_02:-:120 fir_sapling:0:90 searsia_lucida:0:0 searsia_lucida:2:0 fern_02:0:0`
   (`id:part:yawDeg`; part `-` = whole model, a number = one variant when the package holds several side by side)
4. Crop to alpha, save WebP into `public/games-lib/assets3d/tex/imp/` and record the aspect in `impostors.json`.
