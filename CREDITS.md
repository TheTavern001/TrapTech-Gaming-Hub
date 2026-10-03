# Credits & Licenses

Everything shipped in `public/` is either original work, the owner's own art, or permissively licensed.
License texts are in `licenses/`.

## Game code
- **Jetpack Dash** (`public/js/jetpack.js`) - original code written for this project. No code was copied from
  other jetpack games. Not affiliated with, and uses no assets from, Jetpack Joyride / Halfbrick.
- Zapper beams, rockets, the jetpack itself, the neon city/lab parallax and HUD are drawn procedurally on canvas (original).

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
- **Lucide** icons (ISC License) - https://lucide.dev - inlined into `public/js/icons.js` from `lucide-static`.

## Fonts (SIL Open Font License 1.1, self-hosted via @fontsource)
- **Orbitron** - The Orbitron Project Authors (https://github.com/theleagueof/orbitron)
- **Exo 2** - The Exo 2 Project Authors (https://github.com/googlefonts/Exo-2.0)

## Runtime dependencies (npm)
- express (MIT), better-sqlite3 (MIT), bcryptjs (MIT)

## Dev/test tools (in `tools/`, not served)
- playwright-core (Apache-2.0) driving the system Google Chrome for tests/screenshots
- tunnelmole (MIT) - tried as a tunnel fallback; did not work from this box (see README)
- opencv-contrib-python-headless (Apache-2.0), Pillow (HPND)
