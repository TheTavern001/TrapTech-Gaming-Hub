# Anti-cheat levels (v7)

Every game declares a level in `src/config.js` (`AC_LEVEL`, default 3). Levels stack: a level-3 game also gets L1 and L2.
The game client (and its postMessage bridge) is **never trusted**; every decision below is made on the server
(`src/anticheat.js` + `src/ac-levels.js`, wired in `POST /api/score` in `src/server.js`).

| Level | Name | What the server checks | Result on failure |
|---|---|---|---|
| L1 | Obvious maximum | Integer score, within `hardCapOf(game, serverElapsed)` = 2x the honest per-second ceiling (+ramp) | 422 reject |
| L2 | Session checks | HMAC-signed single-use run token bound to user+game (replay = 409), token TTL, **server-measured** run time vs the honest rate ceiling, coins vs time, input telemetry, submit frequency per IP (30/min) and per player (40/min), history jumps | 409/422/429 or held for review |
| L3 | Event log | Compact log `{v:1,e:[dt,kind,value,...]}` of every scoring event; events must sum to the score exactly, each value must be legal for the game's state machine (wave, tower, multiplier, bankroll...), counts must fit, timestamps must fit inside the server-measured run | 422 reject (forged/inconsistent), missing log above the bronze tier = held |
| L4 | Deterministic replay | Seeded/pure game core re-simulated in Node from the input log; recomputed score must equal the claim | 422 reject |

Current assignment: L2 Jetpack Dash, Sky Hopper; **L4 Stack** (prototype: `public/js/games/stack-core.js`, pure arithmetic,
shared byte-for-byte by browser and server; the log is drop times in ms) and Memory Match (tap-log replay); all other games L3.

Held runs never count on boards or giveaways until an admin reviews them (Admin > Review queue).

## Tests
`tools/e2e-anticheat.js` (no browser) proves the server rejects:
1. a DevTools `score=999999999` (L1),
2. a replayed run token (L2, 409),
3. an impossible rate (L2 rate ceiling),
4. a forged L3 event log (sum mismatch and illegal values),
5. a forged Stack replay log (L4 mismatch), and accepts an honest Stack replay.
