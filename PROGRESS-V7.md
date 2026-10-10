# v7 progress log (resume from the first NOT DONE)

| Phase | Status | Proof |
|---|---|---|
| 1a Stabilize uncommitted games work | DONE | commits bab9683, 6c0b348; e2e-api 383/0 (fresh DB), e2e-mobile 206/0, e2e-browser games section: all 16 games start, play via bots and save; game-run: 0 JS errors, L3/L4 ok |
| 1b docs/ANTI-CHEAT.md + tests | DONE | tools/e2e-anticheat.js 12/12 |
| 2 Official events vs free play | IN PROGRESS | server: src/events.js + run/score hooks; tools/e2e-events.js 29/29 (fresh DB) |
| 3 Booking flow verify | NOT DONE | |
| 4 Monetisation (BITCOIN primary per Reese: single BTC_ADDRESS, unique sat-offset amount per order, 30-60 min expiry, mempool.space match + txid paste, admin manual verify; no keys; BTC_ADDRESS=32Y22JCbcemRzTV661yqYzG1PU6tnoE2rB set in .env (validate base58check; list in HANDOFF)) | NOT DONE | |
| 5 Avatars | NOT DONE | |
| 6 Shop + timers | NOT DONE | |
| 7 Trap Tech logo / About / landing | NOT DONE | |
| 8 Admin completeness | NOT DONE | |
| 9 Finish / HANDOFF | NOT DONE | |

Notes: never push; scripts/build-assets.js stays untracked. Restart server before e2e-api (rate-limit buckets are in memory).
