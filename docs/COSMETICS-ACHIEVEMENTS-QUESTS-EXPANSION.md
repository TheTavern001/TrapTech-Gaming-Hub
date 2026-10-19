# Cosmetics, Achievements & Quests Expansion

Added modules for high-polish expansion toward 10k+ feel.

## Files
- `src/cosmetics-expansion.js` — 10 new banners, 5 frames, 10 titles, 4 colors, 4 effects
- `src/achievements-expansion.js` — collection, multi-game, long-term, and shop milestones
- `src/quests-expansion.js` — extra objective types and tiers for rotating quests

## Integration
1. In `src/cosmetics.js`, require the expansion and push the new banners/frames/titles into the existing arrays before the `.map()`.
2. In `src/achievements.js`, require the expansion and loop `EXPANSION` calling `add()`.
3. In `src/rotating-quests.js`, merge `EXTRA_OBJECTIVES` into `OBJECTIVES` and optionally add `EXTRA_TIERS`.
4. Redeploy. Existing generated universe items remain untouched.

## Next polish (UI)
- Shop page: better rarity borders, item preview tabs, filters by type/theme
- Customize page: live preview of equipped banner + frame + title
- Achievements page: progress bars, category filters, recent unlocks toast
- Avatar: wire equipped cosmetics to the 3D avatar once the modular character pipeline is ready

The procedural universe (`cosmetic-universe.js`) already supplies 12,000 designs. These handmade additions give premium unique options on top.
