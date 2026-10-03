# Credits & Licenses

Everything shipped in `public/` is either original work, the owner's own art, or permissively licensed.
License texts are in `licenses/`.

## Game code
- **Jetpack Dash** (`public/js/jetpack.js`) - original code written for this project. No code was copied from
  other jetpack games. Not affiliated with, and uses no assets from, Jetpack Joyride / Halfbrick.
- Zapper beams, rockets, the jetpack itself, the neon city/lab parallax and HUD are drawn procedurally on canvas (original).
- **Drift Rush, Plinko, Spin to Win, Memory Match, High Score, Blazed Roulette, Terp Tapper** (`public/js/games/*.js`) and the shared
  engine (`public/js/games/engine.js`) - original code written for this project. All in-game graphics (roads, cars, cones, pegs,
  chips, wheels, card faces, targets, roulette wheel/table, rhythm lanes, particles, HUD) are drawn procedurally on canvas, and all
  in-game sound effects and the Terp Tapper beat are synthesized live with the WebAudio API. No sprites, sounds or code from other
  games, and no third-party trademarks or logos. Memory Match card faces are canvas-drawn neon glyphs (original).

## Achievements & cosmetics
Profile banners, avatar frames, titles and achievement badges (`src/cosmetics.js`, `src/achievements.js`, served as `/cosmetics.css`)
are original CSS gradients / inline SVG patterns made for this project; badge glyphs are Lucide icons (ISC). Cosmetic only, no cash value.

## Game sprites & sounds - Kenney (CC0 1.0, public domain)
| Pack | Source | Files used |
|---|---|---|
| New Platformer Pack 1.0 | https://opengameart.org/content/new-platformer-pack (kenney.nl/assets/new-platformer-pack) | `character_purple_{jump,walk_a,walk_b,hit,front}`, `coin_gold`, `coin_gold_side`, `saw_a`, `saw_b`, `gem_blue`; sounds `sfx_coin`, `sfx_hurt`, `sfx_gem` |
| Space Shooter Redux | https://opengameart.org/content/space-shooter-redux | `Backgrounds/darkPurple`, `Effects/fire00-02`, `Effects/shield1`, `Effects/star1`, `Power-ups/powerupBlue_shield`; sounds `sfx_shieldUp`, `sfx_zap`, `sfx_lose` |

License verified from the `License.txt` inside each zip (copied to `licenses/kenney-*.txt`) and the OpenGameArt page (CC0).
Sprites were trimmed and renamed (`public/assets/game/`), sounds converted OGG -> MP3 with ffmpeg (`public/assets/sfx/`).
Attribution is not required by CC0; credited to Kenney (www.kenney.nl) as thanks.

## Jetpack Dash cover art
`public/assets/cards/jetpack-dash*.{png,webp}` - original composition rendered from `tools/jetpack-cover.html`
(Kenney CC0 astronaut + coin sprites, CSS-drawn jetpack/zapper/skyline, Orbitron font).

## Hub branding & card art - owner's mockups (Trap Tech Solutions / The Gaming Hub)
Extracted by `tools/extract_mockup_art.py` from the three mockup PNGs supplied by the owner (`mockups/`):
The Gaming Hub logos (stacked, horizontal, controller+crown mark), Trap Tech Solutions logos, hero banner,
game card art (Drift Rush, Plinko, Spin to Win, Memory Match, High Score, Blazed Roulette, Terp Tapper),
giveaway prize art, package icons, achievement badges and avatar art.
Upscaled 4x with OpenCV `dnn_superres` + EDSR x4 model (https://github.com/Saafke/EDSR_Tensorflow, Apache-2.0; model is a
build tool only, not shipped), light unsharp mask, simple dark-background key-out for logos/icons, exported as WebP + PNG.
Because the mockups are low resolution (each phone screen is ~210 px wide), the upscaled art is soft. Replacing it with the
original high-res source files is recommended.

**Deliberately NOT extracted:** the Jetpack Joyride poster/character and the High Times logo (third-party trademarks).
Giveaway hosts are shown as plain text in a colored block (`.brandblock`). If a host brand wants its real logo shown,
get their logo file and permission first.

## Icons
- **Lucide** icons (ISC License) - https://lucide.dev - inlined into `public/js/icons.js` from `lucide-static` by `tools/build-icons.js`.

## Fonts (SIL Open Font License 1.1, self-hosted via @fontsource)
- **Orbitron** - The Orbitron Project Authors (https://github.com/theleagueof/orbitron)
- **Exo 2** - The Exo 2 Project Authors (https://github.com/googlefonts/Exo-2.0)
- `src/og-fonts/*.ttf` are the same Orbitron/Exo 2 files converted from WOFF2 to TTF (fontTools) so resvg can render OG images; still OFL-1.1.

## PWA icons and OG images
`public/assets/icons/*` (192/512/maskable/apple-touch) are generated from the Gaming Hub logo mark (owner's art). OG images are drawn
at runtime from the owner's logos (Gaming Hub, Trap Tech Solutions) and game card art.

## v4 (giveaway results)
- No new third-party assets or packages. The commit-reveal draw uses Node's built-in `crypto` (SHA-256 / HMAC-SHA256) on the server and the browser's built-in WebCrypto for in-page verification. New icons (printer, shield-alert, fingerprint, radio, user-x, hash, gavel, lock, list-ordered, scroll) are Lucide (ISC), same as above.

## v5 realistic game art (all CC0 / public domain - reuse OK, commercial OK, no attribution required; credited anyway)
Raw downloads live in `assets-src/` (not committed; metadata with source URL/author/license in `assets-src/meta_*.json`).
`tools/build-graphics.py` crops/tones/compresses them into `public/assets/v5/*.webp`; `tools/shoot-games.js` captures real
gameplay frames and `tools/build-thumbs.py` turns them (plus staged scenes made from the same art) into the store cards in
`public/assets/cards/v5/` (800x450, 600x620, 1200x630 share image). License texts: `licenses/`.

| Asset | Author | Provider | License | Source | Used for |
|---|---|---|---|---|---|
| Shanghai Bund | Greg Zaal | polyhaven | CC0 1.0 | https://polyhaven.com/a/shanghai_bund | Jetpack Dash night-city parallax (`jp-city.webp`) |
| Warm Bar | Greg Zaal, Jarod Guest | polyhaven | CC0 1.0 | https://polyhaven.com/a/warm_bar | Plinko backdrop (`bar-blur.webp`) |
| Warm Restaurant Night | Greg Zaal, Jarod Guest | polyhaven | CC0 1.0 | https://polyhaven.com/a/warm_restaurant_night | Spin to Win / Terp Tapper / Roulette lounge backdrops (`lounge-blur.webp`, `tt-bg.webp`, `rl-bg.webp`) |
| Asphalt 02 | Rob Tuytel | polyhaven | CC0 1.0 | https://polyhaven.com/a/asphalt_02 | Drift Rush road (`dr-asphalt.webp`) |
| Aerial Grass Rock | Rob Tuytel | polyhaven | CC0 1.0 | https://polyhaven.com/a/aerial_grass_rock | Drift Rush verge (`dr-grass.webp`) |
| Black Walnut Veneer 01 | Jenelle van Heerden | polyhaven | CC0 1.0 | https://polyhaven.com/a/black_walnut_veneer_01 | Memory Match table (`mm-table.webp`) |
| Dark Wooden Planks | Amal Kumar | polyhaven | CC0 1.0 | https://polyhaven.com/a/dark_wooden_planks | Plinko board (`wood-dark.webp`) |
| Lacquered Cherry Wood | Jenelle van Heerden, Rico Cilliers | polyhaven | CC0 1.0 | https://polyhaven.com/a/lacquered_cherry_wood | Spin to Win + Roulette wheel rims (`wood-cherry.webp`) |
| Metal Plate | Rob Tuytel | polyhaven | CC0 1.0 | https://polyhaven.com/a/metal_plate | Jetpack floor, Plinko slots (`metal-plate.webp`) |
| Brick Wall 02 | Dimitrios Savva | polyhaven | CC0 1.0 | https://polyhaven.com/a/brick_wall_02 | High Score wall (`hs-wall.webp`) |
| Velour Velvet | colormass, Rico Cilliers | polyhaven | CC0 1.0 | https://polyhaven.com/a/velour_velvet | Memory Match card backs + Roulette felt (`mm-back.webp`, `rl-felt.webp`) |
| Two 20kr gold coins | Anonimski | wikimedia | CC0 1.0 | https://commons.wikimedia.org/w/index.php?curid=58392424 | Gold coin (Jetpack coins, High Score x2 targets, Memory face) (`coin*.webp`, `mm-coin.webp`) |
| Free closeup archery target image | unknown | rawpixel | CC0 1.0 | https://www.rawpixel.com/image/5906491/photo-image-public-domain-green-arrow | High Score targets + Memory face (`hs-target.webp`, `mm-target.webp`) |
| Free lime slice, white background | unknown | rawpixel | CC0 1.0 | https://www.rawpixel.com/image/5905134/photo-image-background-public-domain-fruit | Terp Tapper lime note, Memory lime face |
| Free orange slice, white background | unknown | rawpixel | CC0 1.0 | https://www.rawpixel.com/image/5905088/photo-image-background-public-domain-fruit | Terp Tapper orange/lemon/grapefruit notes (hue-shifted), Memory faces |
| Cannabis leaf background | unknown | rawpixel | CC0 1.0 | https://www.rawpixel.com/image/6040004/photo-image-background-public-domain-leaf | Memory Match leaf face (`mm-leaf.webp`) |
| Darts Dartboard | Skitter Photo | stocksnap | CC0 1.0 | https://stocksnap.io/photo/darts-dartboard-VEU1RODNF5 | Memory face |
| Casino roulette wheel close up | unknown | rawpixel | CC0 1.0 | https://www.rawpixel.com/image/5927118/photo-image-public-domain-free-game | Memory face |
| Poker chips 2 | Jismab | wikimedia | CC0 1.0 | https://commons.wikimedia.org/w/index.php?curid=15179176 | Memory face |
| Philips D8444 stereo radio recorder (boombox, ghettoblaster) - edited, without background | Retired electrician | wikimedia | CC0 1.0 | https://commons.wikimedia.org/w/index.php?curid=134741845 | Memory face |
| Game Controllers | Ted Mielczarek | flickr | CC0 1.0 | https://www.flickr.com/photos/49243838@N00/11241518385 | Memory face |
| Dice Game | Skitter Photo | stocksnap | CC0 1.0 | https://stocksnap.io/photo/dice-game-IMUB39JBN1 | Memory face |
| Koss headphones | Abdulla Al Muhairi | flickr | CC0 1.0 | https://www.flickr.com/photos/57866029@N00/52459692877 | Memory face |
| Vinyl Record | Skitter Photo | stocksnap | CC0 1.0 | https://stocksnap.io/photo/vinyl-record-0NOS06CDVI | Memory face |
| Rough Diamond | DGPC/ADF Luísa Oliveira | wikimedia | CC0 1.0 | https://commons.wikimedia.org/w/index.php?curid=163756648 | Memory face (crystal) |
| Racing Pack (cars, cones, barrels, tyres, oil) | Kenney | kenney.nl | CC0 1.0 | https://kenney.nl/assets/racing-pack | Drift Rush sprites (`dr-*.webp`) - stylised, not photo |

Notes: Poly Haven HDRIs are used as tonemapped, blurred panoramas (no HDR lighting). Openverse was used only as a search
index; every file was taken from the original provider (Wikimedia Commons, rawpixel, StockSnap, Flickr) and is marked CC0 1.0 there.
Card titles use Orbitron / Exo 2 (SIL OFL 1.1, already bundled). Trap Tech / Gaming Hub logos are the owner's marks.

## Runtime dependencies (npm)
- express (MIT), better-sqlite3 (MIT), bcryptjs (MIT)
- @resvg/resvg-js (MPL-2.0) - renders the SVG share/OG images to PNG on the server (`src/og.js`); used unmodified as an npm dependency

## Dev/test tools (in `tools/`, not served)
- playwright-core (Apache-2.0) driving the system Google Chrome for tests/screenshots
- tunnelmole (MIT) - tried as a tunnel fallback; did not work from this box (see README)
- opencv-contrib-python-headless (Apache-2.0), Pillow (HPND)
