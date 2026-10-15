# R1 deployed: physical-phone quality and 500-game expansion plan

Current host: https://glassy-drifter-9532.de.deplexo.com (owner screenshot says RUNNING, CURRENT READY at `5fb461c`). The GitHub source contains 13 active core games, 74 playable library games, and six archived overlapping library IDs. The public goal is **500 individually approved games**; another **413 unique playable and fully certified titles** are needed if the existing 87 are ultimately approved.

## Protect the working deployment

Keep Deplexo pointing at the existing QA branch and its READY version until the next release candidate is actually tested. New development is on `work/post-r1-mobile-quality-and-game-intake-20261015`. Do not merge it into the watched branch or trigger redeploy prematurely. Preserve `/data` SQLite/backup volume, private review, admin path, secrets, player balances, and payment/prize restrictions. Stage-only source must never be reported as live.

## Next phone inspection

1. Visit the existing hub on a real Android phone. Confirm age/private-review gate, authenticated sign-in/out, `/games` landing page, back navigation, screen padding, no horizontal overflow, touch feedback, and the Trap Tech install/home logo.
2. Collect the `/healthz` HTTP result and `/api/build` fingerprint from the actual running app (the assistant environment cannot fetch this host). Do not share credentials, cookies, wallet keys, or the admin path.
3. Check Hub Credits balance vs old point/Crown history, 3D avatar starting parity and cosmetics-only ownership, rotating shop, quests/season progression, and purchased entitlements, without creating actual payments during test.
4. Check **Book a Giveaway** for selectable active games, optional channel link without subscriber-goal promises, paid booking and admin-only approval, deterministic **highest score / best time** winner rules and server-established tie breaks. While prize games have no replay certification, official entries must remain fail-closed.

## Phone game QA and admission

For **every** existing and new game: distinct gameplay loop; correctly licensed art/audio/3D source; responsive tap/drag/swipe controls; visible game-over/restart; active safe area; background/rotation resume; long-run bounded performance; no choppy movement; collision correctness; successful legitimate server-scored run; rejected forged, replayed, impossible and stale submissions; fair deterministic ties; no pay-to-win cosmetics. Test on **physical Android Chrome and iPhone Safari** and later the native shells; record frame p50/p95 and unexpected memory growth, screenshots, run IDs with redacted secrets, and owner approval. Write per-title outcomes to `docs/audit/GAME-QUALITY-ACCEPTANCE.json`; untested means pending.

Source script: `tools/qa-87-browser.js` now selects the **full currently registered active catalog** by default instead of truncating to 87. With Playwright on an authenticated QA machine:

```bash
BASE=https://glassy-drifter-9532.de.deplexo.com QA_INTERACTIVE_AUTH=1 QA_HEADLESS=0 node tools/qa-87-browser.js
```

For batch reviews, set `QA_START_INDEX=0 QA_MAX_GAMES=100`; repeat with start 100, 200, 300, 400 for a 500-game catalog. Reports record batch offsets and `fullCoverage:false` on a partial run. `QA_REQUIRE_FULL_COVERAGE=1` forces a nonzero exit on incomplete coverage. No browser cookie/session data needs to be committed. Browser-emulated load/screenshot PASS is **not** physical Android/iPhone or AAA certification.

## Game additions and public launch

Source candidate queue starts with **Futuristic Hover Racing, Reversi, Battleship Duel, Sudoku Sprint, The Maze Survival**. All are research-only, not yet imported, rights-complete, adapted to endless skill scoring, score-replay certified, or mobile approved. Add only mechanic-distinct locally hostable titles with actual gameplay, source/media rights, licensed AAA-grade assets and authenticated score integrity. Each new admission must pass quality gate independently; no duplicates or placeholder games merely to reach 500.

**Public gates remain closed** until all 500 titles, 21+ access, admin 2FA, no-pay-to-win reward architecture, wallet/purchase/refund conservation, real checkout and settlement, admin-only paid giveaway booking, anti-cheat replay, backup/recovery, mobile UI/performance, and projected high-concurrency load are verified and owner-approved. Host READY only concludes image-build/R1 deployment infrastructure acceptance.
