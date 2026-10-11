# Personal prelaunch test plan

This is the private QA checklist for the Gaming Hub. Passing a syntax check is not the same as proving a game is fun, polished, fair, or safe. Do not announce public launch until the release gates below are satisfied.

## How to personally test

1. Use the private preview URL supplied by the deployment provider. Do not share it publicly while testing.
2. Sign in with a dedicated test account, not the administrator account.
3. Test each game on desktop and on your Android phone in portrait and landscape.
4. For each game, test start, pause/resume if present, restart, game over, score submission, leaderboard update, sound toggle, keyboard/touch controls, and leaving/returning to the Hub.
5. Keep a list of bugs with game title, device/browser, steps to reproduce, expected result, actual result, severity, and screenshot/video.
6. Re-test the same steps after each fix. A bug is not closed until the original issue is reproduced as fixed and nearby gameplay still works.

## Per-game acceptance gate

A game does not pass simply because it loads. It must pass all of these:

- No crash, blank canvas, stuck loading screen, or uncaught JavaScript error.
- Controls are discoverable, responsive, consistent, and work on touch and keyboard where supported.
- Collision, hit detection, movement, physics, difficulty ramp, scoring, and game-over conditions are correct.
- Restart fully resets gameplay state; no old score, stuck input, or duplicated timers.
- Score submission is reliable; server rejects forged scores and duplicate submissions.
- Readable HUD and text at phone size; no cut-off buttons, notches obscuring controls, or horizontal overflow.
- Visual quality has a deliberate art direction, coherent animation, polished effects, feedback for hits/actions, and no placeholder-looking UI.
- Audio is balanced, can be muted, does not start unexpectedly, and does not stack endlessly.
- Frame pacing stays smooth on a mid-range Android phone; no overheating or runaway memory use in a normal session.
- Game content and art are original or properly licensed; do not use copied commercial game assets or branding.

## Severity

- **P0 — release blocker:** exploitable score/eligibility/payment issue, data exposure, admin bypass, crash affecting most users, or corrupted progress.
- **P1 — release blocker for that game:** game cannot start/finish/submit, core controls fail, mobile layout blocks play, or severe gameplay exploit.
- **P2 — quality blocker:** major visual/gameplay defects, broken restart, unresponsive feel, frequent performance drops, misleading UI.
- **P3 — polish:** minor alignment, small sound mix issue, cosmetic inconsistency.

## Release rule

Do not publish the full library merely because some games pass. Mark games that fail as **unavailable**, fix them, and only enable the games that pass. If the product promise is a premium-quality game hub, a smaller polished catalog is better than a large catalog full of broken games.

## Test record template

For each issue, record:

- Game:
- Device / OS / browser:
- Build or commit:
- Severity (P0–P3):
- Steps to reproduce:
- Expected:
- Actual:
- Screenshot/video:
- Fix commit:
- Retest result:
