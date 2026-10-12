# The Gaming Hub — live review handoff (2026-10-12)

## Review surface
- Public app: https://glassy-drifter-9532.de.deplexo.com
- Project dashboard: https://deplexo.com/apps/20e0c3e0-87bf-4d2f-8c25-5e41401a5121
- Source branch: `games/deep-distinctness-audit`. Previous dashboard snapshots conflicted about the connected branch; verify the Current full SHA in Deplexo.

## Candidate changes
- Restored public APIs for the rotating Hub Points shop: `GET /api/shop`, `POST /api/shop/buy`, item details and generated cosmetic art; ownership, rotations, balance and purchase validation remain server-authoritative.
- Hub Store now displays up to 18 available daily, weekly, seasonal and event cosmetics with preview/details and a link to the full Points Shop.
- Giveaway metadata includes all eligible Games Library titles instead of a hard-coded two-title subset.
- Giveaway presets include 60-second/3-minute Time Attack, single-run High Score, best-of-3/5, campaign, endless, strategy and marathon formats while retaining the existing `short_session` identifier.
- Ported avatar saved-look API/editor improvements: 3D preview, rotate/zoom/reset, presentation and part selection, owned-only randomization, free-base reset, up to 12 named saved looks, and ownership checks before save/apply/buy.
- Added responsive CSS for the top logo, game HUD/canvas, cosmetic grid and avatar stage. A low-resolution pixelated rendering treatment has been added; it is not AAA art certification.
- Added 10% Season Pass progression to premium cosmetic-track unlock calculation only. Raw XP, free-track level, public season leaderboard, scores, giveaway qualification, attempts, anti-cheat, ties and winners are unchanged.

## QA state
**NOT AAA-certified.** Runtime/browser suites have not been executed against this commit, and every game's human graphics/gameplay review remains open. GitHub Actions previously failed before runner provisioning; no green CI status is claimed. The app URL could not be reached from this tool environment, so actual live health/full deployed SHA remain unverified.

## Zero-hosted-CI validation
Run in a clone with Node.js 20 and dependencies installed. Use a disposable database, never production `/data/hub.db`.

```sh
node --check src/server.js
node --check src/admin-giveaways.js
node --check src/admin-v7.js
node --check src/admin-profiles.js
node --check src/shop.js
node --check src/avatars.js
node tools/e2e-avatars.js
npm test
npm run test:browser
```

Some checks need a local running app or service-specific variables. Keep production payments disabled during QA.

## Per-game gate — every game and every Games Library title
- Route/assets boot; no blank canvas or missing art.
- Mouse, keyboard and touch input work; controls are visible/reachable at 320px width in portrait and landscape.
- Pause/resume, restart, game-over and navigation work without stale loops or focus bugs.
- HUD/score match game rules; server validation rejects impossible scores/logs; ties follow server-authoritative rules.
- Run a real giveaway attempt from its detail page and verify cosmetics/premium-track progression do not change scores, public rankings, eligibility, attempts, tie-breaks or winners.
- Record game ID, full build SHA, device/browser, evidence, defects and pass/fail. Keep every title unsigned-off until tested.

## Deployment caution
Owner screenshots indicate a single-app Deplexo Free plan, but earlier captures conflicted about the connected branch. This atomic commit targets the reported audit branch; whether it auto-deploys depends on the current dashboard branch and auto-deploy setting. Verify the Current full SHA and health in Deplexo. Source rollback does not restore SQLite state.
