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
