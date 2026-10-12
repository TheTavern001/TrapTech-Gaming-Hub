# Asset hunt log (per game)
Sources checked and the licence verdict. Rule: CC0 / CC-BY / royalty-free-for-games only; reject NC, editorial, engine-locked, ripped.

## Rail Rush (ref: Subway Surfers)
- Searched: Quaternius (UBC, UAL, Ultimate Animated Character), Kenney (all 3D kits), Poly Pizza, OpenGameArt CC0, KayKit, Sketchfab CC0/CC-BY.
- Picked: Quaternius UBC+UAL (CC0, smooth rigged), Kenney town/desert kits (CC0); trains, set pieces built in code.
- Rejected: Quaternius Ultimate Animated Character (too low-poly), Kenney mini characters (blocky), Unity/Fab free stores (engine-locked EULA).

## Lane Racer (ref: Traffic Racer)
- Searched: Kenney Car Kit (low-poly, boxy), Quaternius Cars Bundle (low-poly), OpenGameArt Cartoon Vehicles Pack 1 (CC0, smooth), Poly Haven textures/HDRIs, ambientCG, Sketchfab CC-BY cars, CGTrader/TurboSquid free (per-item licences; most "editorial" or royalty-free with redistribution limits - none better than Divinux for size).
- Picked: Divinux cars (CC0), Quaternius Stylized Nature (CC0), Poly Haven asphalt + grass (CC0).
- Rejected: Divinux "sportster" (broken import), Kenney/Quaternius cars (blockier).

## Pending: Moto Lanes, Ruin Runner - hunt in progress (Quaternius, KayKit, Poly Pizza motorbikes, Sketchfab CC-BY, OpenGameArt).

## Vendor-first check (complete open-source games), 2026-10-10
| Repo | Licence | Verdict |
|---|---|---|
| gabrielecirulli/2048 | MIT | VENDOR (2048-style title): polished, tiny; add adapter + green/gold theme |
| Hextris/hextris | GPL-3.0 (code) | VENDOR candidate (Hextris-style): polished; verify asset licence in repo before shipping |
| ellisonleao/clumsy-bird | GPL-3.0 | VENDOR candidate (flappy-style): original art; replace bird sprite with our own |
| jakesgordon/javascript-tetris | MIT | below 7 bar visually (plain blocks) - keep our block-drop, may borrow nothing |
| jakesgordon/javascript-racer | MIT | pseudo-3D 2D racer, below bar vs our 3D Lane Racer - reject |
| chvin/react-tetris | no licence | reject (all rights reserved by default) |
| daleharvey/pacman | WTFPL | reject: uses the original Namco trademark/character art |
| Anuken/Mindustry, hedgewars/hw | GPL | reject for web: no maintained browser build within size cap |
| mozilla/BrowserQuest | mixed (code MPL, art CC-BY-SA) | out of scope (MMO server) |

## Kenney-first expansion pass (2026-10-11)
Kenney is a first-class asset source for the game's visual rebuild, not just a fallback. Prioritize packs that solve a specific visible weakness in a game: environments/tilesets, props, vehicles, characters, UI, particles and sound effects. Use the official pack page and the license file shipped inside the downloaded archive as the source of truth; record the exact pack, source URL, license, download date and shipped file paths in `CREDITS.md`.

### Selection and integration rules
- Prefer cohesive packs with matching art direction over mixing unrelated packs in one scene.
- For each game, capture a baseline screenshot and list the placeholder/weak assets before choosing a Kenney pack.
- Import only the files needed for that game; optimize image dimensions, audio format and model complexity for mobile.
- Do not treat a pack download as a game upgrade by itself: connect assets to the actual runtime, lighting, collision, animation, feedback and game loop.
- Check each asset's license individually where pack contents or bundled files differ. Preserve included license files.
- Run the game smoke test after integration and compare before/after screenshots at phone and desktop sizes. Keep the old assets available for rollback until the new build passes.

### Priority use cases
1. **Platformers / runners:** character animation, tilesets, hazards, collectibles, hit/boost feedback and layered backgrounds.
2. **Racing / driving:** vehicle silhouettes, road props, barriers, signs, scenery and roadside variation; validate perspective and scale before shipping.
3. **Arcade / space games:** cohesive ships, projectiles, enemies, pickups, impact effects and backgrounds.
4. **Hub-wide polish:** consistent buttons, icons, achievement/UI elements, audio cues and menus where a pack fits the Gaming Hub style.

Status: this is an asset-selection and QA policy. It does not mean additional Kenney packs have already been downloaded or integrated by this commit.
