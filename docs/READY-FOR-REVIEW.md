> **Superseded (2026-10-22):** the wiring described here broke the server. Current status and what was restored: `docs/AAA-FULL-AUDIT.md`.

# Ready for Review

## Wired in
- `src/achievements.js` loads AAA achievements from `achievements-aaa.js`
- `src/rotating-quests.js` loads AAA quests from `quests-aaa.js`
- Cosmetics prepared for R2 asset loading in `cosmetics.js`
- Design upgrades in `cosmetics-aaa-design.js`

## What you can review
- Achievement list and design (skill, collection, dedication, social, secret)
- Quest objectives and tiers (daily/weekly/seasonal)
- Cosmetic design direction

## Still needed for full live
- Restore full original cosmetics.js ID list if required
- R2 bucket + ASSET_CDN_URL
- Upload finished assets
- Redeploy on Deplexo or Oracle

Everything is in the repo and ready for your review when you connect.
