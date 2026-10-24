# Jetpack Dash pilot sprites

The 2D pilot in Jetpack Dash (`public/assets/jetpack/pilot.webp` + `pilot.json`) is pre-rendered from the Quaternius
Universal Base Character (`public/games-lib/assets3d/hero.glb`, CC0). `render.html` dresses the rig in code (suit
shader by body region, helmet on the head bone, jetpack on the spine bone, hair/eyes hidden) and renders it side-on with an
orthographic camera.

1. Make a work folder holding `render.html`, `hero.glb` (copy of `public/games-lib/assets3d/hero.glb`) and `vendor/`
   (copy of `public/games-lib/vendor`), then serve it: `python3 -m http.server 8793 --bind 127.0.0.1`
2. `node render.js <frames>` — 8 run frames (`Sprint_Loop`), 4 fly frames (`Jump_Loop`, leaning forward), 6 death frames
   (`Death01`), 320 px each.
3. `python3 -I pack.py <frames> public/assets/jetpack` — crops each animation to its alpha bounds, writes the sheet and
   `pilot.json` (`ppm` = sheet pixels per metre; per animation the frame rects and the feet anchor `ax`, `ay`).

The game scales the sprite by `ppm(game) / ppm(sheet)` and draws it with the anchor on the pilot's feet.
