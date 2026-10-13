# Vendored game settings coverage
2026-10-13: the 80-title library contains three vendor-engine exceptions not using Kit.run: MIT 2048 Bud Merge, GPL Hextris Hex Stack, Chromium BSD Desert Dash. These now load a common options module:
- Bud Merge freezes movement through the existing Hub bridge move gate, preserving puzzle board and seed.
- Hex Stack uses its original exposed pause state; setting changes never touch Hextris movement/scoring.
- Desert Dash stops/resumes the Runner RAF using native methods, and mutes audio through its existing playSound method (without altering jump or velocity).
- These engines have fixed rendering architectures; avoid presenting an ineffective quality control. Sound toggles only shown on Desert Dash where it is actually implemented. Live FPS diagnostic is available on all three.
All score logging, token creation, movement physics and original licenses remain unchanged. Source syntax alone does not prove in-browser correctness. Required acceptance: test input freezes, pause/resume, tab-focus, mute and mobile layouts on each vendored game.