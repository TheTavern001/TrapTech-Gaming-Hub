# Hex Stack: settings/pause/title interaction regression — 2026-10-13

**Scope:** `gl-hex-stack` (licensed Hextris-derived engine), shared vendor settings. No catalog-count changes, score algorithm changes, payments, prizes, account data, or wallet changes.

## Reproduced source defects

1. Hextris `view.js` rejects repeat calls to its native `pause()` while `pausable === false` for 400ms. A settings menu opened and closed immediately called the toggle twice; the second toggle was ignored, leaving `gameState === -1` with the settings panel closed.
2. The title-screen start shim registered a *capturing* `mouseup`/`touchend`/`keydown` handler and excluded Back, but not the settings overlay. Gear taps on the title screen could start a game run.
3. The vendored keyboard registered left/right and fast-drop whenever `gameState !== 0`, including native pause state `-1` and game-over `2`. Rotation or the speed multiplier could change while paused, causing unfair resume behavior.
4. A quick close followed by immediate reopen required differentiating a pending resume from a deliberate prior user pause. Releasing a held fast-drop key while paused must also return speed to normal.

## Source changes

- `public/games-lib/hex-stack/hub-bridge.js`: defers native resume until its debounce finishes; cancels queued resume on reopen; exposes `resumePending` to preserve user intent; excludes settings/back controls from title-start capture.
- `public/games-lib/hex-stack/js/input.js`: only rotate or enable fast-drop in active state `1`; release an already-held boost even when paused.
- `public/games-lib/vendor-settings.mjs`: preserve original paused state despite pending quick-resume; neutralize held speed boost before settings opens.
- `tools/test-player-game-settings.js`: source-based VM regression cases for fast close, fast reopen, title gear/back isolation and keyboard gate. Docker already runs this script, so a failure stops the build rather than silently accepting a broken settings integration.

## Evidence / limitations

- The three production JavaScript modules and modified regression script passed V8 parse checks at source level.
- **7 targeted source interaction checks passed** against the branch using an in-memory V8 browser-stub simulation, including fast-close, cancellation, title tap isolation, paused input and fast-drop reset. These are *not* browser/E2E, Android performance, gameplay fairness or server replay certificates.
- Docker prelaunch, live Deplexo build, live `/api/build`, frame pacing, keyboard browser fidelity, graphics fidelity, and manual Samsung Android confirmation **NOT RUN / NOT VERIFIED** in this change session.
- No existing game is reclassified as AAA-certified. Keep 93 registered / 0 independently quality-approved until per-title test evidence and owner signoff.

## Next exact checks

Run `node tools/test-player-game-settings.js` (and the remaining existing Docker prelaunch suites) from this branch with full dependencies. In a browser, test Hex Stack from title using gear, Back, tap-to-start and normal gameplay; open/close settings within 400ms twice, open while already paused, hold/release speed-up through settings, tab away/back, restart and submit run; inspect actual input and score behavior. Capture phone frame-time and visual evidence and add a per-title QA result before any deployment merge or game expansion approval.

Related code commits: `1817a2c`, `7d8ebe5`, `eac29ef`, `92640e6`, `5932ba6`. Branch: `fix/hex-stack-settings-pause-20261013`.
