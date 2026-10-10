# Triple Audit — Games Library Integrity

Audit date: 2026-10-10  
Scope: branch `games-lib-integrity-audit` at the time of this review. This is a source-level audit, not a claim of successful browser/device execution.

## Audit 1 — Source and runtime contract

### Confirmed findings
- The shared Kit engine exposes `g.shake(magnitude, duration)` as a function and calls it from `g.end()`.
- Neon Circuit assigned a number to `g.shake` and later called `g.end()` on collision. That shadowed the engine method, so the game-over path could throw a `TypeError`. Fixed by calling `g.shake(8, .35)` and removing the conflicting state variable.
- Rift Survival had an `index.html` that loads `game.js`, but the branch tree had no `public/games-lib/rift-survival/game.js`. Added the missing original game implementation.
- Rift Survival originally emitted a progress marker every update frame (roughly once per rendered frame). That would create unnecessary telemetry volume. Changed this to emit wave progress and award a wave bonus only when the wave changes.
- The Rift Survival registry scoring description claimed eliminations and survival-time points that the game did not implement. Updated the description to match actual scoring (shards and wave transition bonus).

### Still requiring runtime proof
- Neon Circuit and Rift Survival have not been executed in a browser in this environment. The new Rift Survival controls, collision feel, difficulty curve, touch behavior, and score submission remain unverified.
- Original SVG thumbnails for both new games are committed, and the registry/catalog point to those SVG paths. Their appearance still needs visual browser review.
- A source-level review cannot establish stable 60 FPS on the target Android phone.

## Audit 2 — Test harness and observability

- The E2E harness previously waited for `window.__GL` but then proceeded to query the canvas and FPS without an explicit runtime-contract failure. Legacy/non-Kit games could therefore fail later with a misleading null-property error.
- Added a clear runtime-contract guard requiring `window.__GL.g` and a string state before gameplay checks.
- Expanded the static audit to compare key registry/catalog fields, detect unregistered catalog entries, validate local script references, and warn when artwork files are absent. Fixed the artwork-path resolution in the audit itself.
- Added a fast static-check script and a GitHub Actions workflow for JavaScript syntax and registry/catalog/docs/local-asset consistency checks. The static check also guards the main Hub library link/live count and the dedicated library page's new-game spotlight and filters. The workflow has been committed and the first GitHub Actions static-check runs completed successfully (JavaScript syntax checks plus registry/catalog/docs/local-asset consistency).
- Reconciled Rift Survival's catalog scoring text with the registry and game implementation.
- FPS output now records a structured performance sample (`fps`, `jsMs`, runtime state, and elapsed sample time), and reports a missing/non-finite FPS value explicitly.
- These are diagnostics improvements only. The Playwright suite has **not** been run here; the patch is not evidence that all games pass.
- The existing engine's FPS value is a rolling approximately one-second frame count, not a full-run percentile. For quality certification, capture repeated runs and report median plus low-percentile FPS, dropped-frame share, and JS frame time on both desktop and a representative Android device.

## Audit 3 — Catalog, scoring, giveaway and release integrity

### Required before any merge or live rollout
1. Run the integrity audit against the branch and fix every missing `game.js`, broken relative script, absent asset, registry/catalog mismatch, or unverified external URL.
2. Run each game through the full E2E suite: load, input, pause/resume, tab hide/show, rotation/resizing, valid score submission, forged-score rejection, and mobile touch.
3. Run performance tests at normal and 4× CPU throttle; collect evidence for at least three runs per candidate. Treat FPS below 30, uncaught console errors, or missing metrics as a release blocker.
4. Verify score rules against the actual implementation. The registry's points-per-second ceiling and any anti-cheat/giveaway metadata must be conservative and evidence-based; metadata alone does not make a game fair or tamper-resistant.
5. Check each game's code, artwork, fonts, audio and source provenance independently. A code license does not automatically license every asset, and attribution alone is not permission.
6. Confirm catalog art paths exist, credits and license files match the included content, and game titles/marketing do not imply affiliation with third-party franchises.
7. Only after the evidence is green should the candidate be considered for merge/deployment. No merge or deployment is authorized by this audit.

## External technical reference

MDN's Canvas optimization guidance recommends caching repeated drawing work, reducing unnecessary state changes and `shadowBlur`, batching drawing operations, and considering layered canvases for complex scenes. These are optimization hypotheses to measure—not substitutes for profiling the actual games: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas

## Status

- Source findings: **changes made**
- Static CI: **passed** (syntax and registry/catalog/docs/local-asset checks)
- Browser execution: **not run**
- Android device profiling: **not run**
- License clearance: **not completed**
- Merge/deployment: **not performed**
