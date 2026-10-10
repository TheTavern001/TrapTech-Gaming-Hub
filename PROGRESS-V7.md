# v7 progress log (resume from the first NOT DONE)

| Phase | Status | Proof |
|---|---|---|
| 1a Stabilize uncommitted games work | IN PROGRESS | npm ci; e2e-api updated for 16 games (plinko is just-for-fun; L2 per-IP limit pacing; Stack L4 replay log) |
| 1b docs/ANTI-CHEAT.md + tests | NOT DONE | |
| 2 Official events vs free play | NOT DONE | |
| 3 Booking flow verify | NOT DONE | |
| 4 Monetisation (BITCOIN primary per Reese: single BTC_ADDRESS, unique sat-offset amount per order, 30-60 min expiry, mempool.space match + txid paste, admin manual verify; no keys; BTC_ADDRESS=32Y22JCbcemRzTV661yqYzG1PU6tnoE2rB set in .env (validate base58check; list in HANDOFF)) | NOT DONE | |
| 5 Avatars | NOT DONE | |
| 6 Shop + timers | NOT DONE | |
| 7 Trap Tech logo / About / landing | NOT DONE | |
| 8 Admin completeness | NOT DONE | |
| 9 Finish / HANDOFF | NOT DONE | |

Notes: never push; scripts/build-assets.js stays untracked. Restart server before e2e-api (rate-limit buckets are in memory).
