# Deplexo Docker failure 5932ba6 — root cause, fix and cleanup policy
Reconciled: 2026-10-13 Eastern (source branch only; no READY for this fix).

## Direct host evidence provided by owner
- Failed deployment commit: `5932ba613c2d22e4bdf97920d6071cc59c2b4dd6`, Deplexo Docker image step `[1/2] STEP 11/12`.
- All logged commands before the failure passed: npm dependencies, rotating quests (3,150 templates), season calendar (56/42/42 day boundaries), avatar source checks (2 licensed rigs, 0 certified wearables), 96 gameplay syntax checks, endless memory regressions, 80 catalog/library consistency, 93-source audit, six-vehicle integrity and player game settings.
- Fatal terminal check: `node tools/verify-prelaunch.js` reported `tools/verify-live-deployment.js: Missing local module dependency: ./player-prefs.js`. Full Docker build returned exit status 1. **This is the exact first logged build blocker.**
- The purported import is actually within the *string literal* `hubApp.text.includes("import * as GP from './player-prefs.js'")` inside `tools/verify-live-deployment.js`, which checks served app JS. It is **not** an executable import in that tool. The real app imports `./player-prefs.js` from `public/js/app.js`, whose actual target is present at `public/js/player-prefs.js`.
- Original `tools/verify-prelaunch.js` scans the raw text with regex and mistakenly resolves the quoted sample relative to `tools/`. Fix by masking comments, strings and template-text during the import-specifier scan. Do **not** put a fake `tools/player-prefs.js` into source and do **not** disable genuine missing-file audits.

## Isolated source fix, ready for full Docker/Deplexo verification
Candidate branch: `fix/deplexo-import-audit-false-positive-20261013` based on latest `feature/expansion-ready-game-admission-20261013` (`6874037`), preserving its dynamic game-count/Kit settings guards.

- `b8f51f4`: new dependency-free `tools/local-imports.js` lexical scan to distinguish quoted/comments/template text from actual imports, including actual dynamic literal and template-expression imports.
- `8390117`: change `tools/verify-prelaunch.js` to consume executable import specifiers; retain its hard-failure for actually missing local imports.
- `c610566`: add `tools/test-prelaunch-imports.js` to reproduce the exact quoted verifier failure and show actual app import, missing-module negatives, static/dynamic and template-expression handling.
- `c5d97e5`: wire the test directly into Docker before the prelaunch structural audit.
- `5eeb204`, `cbfea4f`, `de6f485`, `b496e86`: consolidate Hex Stack native pause race, title input isolation, paused keyboard, vendor adapter and VM regression into this expansion-ready branch; **the dynamic catalog guard remains**.

## Checks actually performed
- New scanner parsed as JavaScript and directly evaluated against the *actual fetched GitHub sources* for the live verifier and Hub app.
- The exact committed test-prelaunch-imports.js regression body executed successfully in a V8 environment with filesystem/path shims and fetched GitHub source texts: false import ignored, real app import retained, missing-import fixtures still detected.
- Ten source-level preservation checks passed for exact verified modules, template imports, Docker test hook and prelaunch missing-path fatal check.
- Hextris regression test source parsing passed and existing targeted VM tests previously passed; the expansion-branch dynamic catalog count assertion and pause-safe Kit title gate remain.
- **NOT RUN:** a full physical `node tools/verify-prelaunch.js` across checkout, `npm ci`/Docker build, host READY, actual public HTTP fingerprint, physical Android game QA, anti-cheat replay, complete 93-game AAA certification. Until then, the fix is *proposed / unverified on host*.

## Old deployment cleanup policy
Deplexo's currently documented user API supports reading deployment history/logs, canceling an active build, rebuilding, and **deleting the entire app**. It does **not document a delete-single-deployment-history entry** endpoint. Never call `DELETE /apps/{id}` to clean failed-build cards: Deplexo warns this removes the app's persistent data volume. Preserve historic READY/ERROR records, log excerpts and root causes in the repo. Stop unnecessary branch auto-deploy by choosing a single controlled deployment branch, disabling auto-deploy while staging if available, then make one reviewed release candidate. Do not delete historical source commits or the live recovery SHA.

## Exit criteria before game 94+
1. Run the exact Docker STEP 11/12 suite with current branch and verify all checks (then STEP 12 HTTP smoke) pass. Fix any *new* specific error from logs rather than hiding audit.
2. Build on the one existing Deplexo app and observe **READY** with matching `/api/build` fingerprint and `/healthz`. Confirm backup and persisted data.
3. Desktop and physical Android QA of game settings/Hextris/Rail Rush and user-facing 3D garage. Resolve high-impact gameplay defects and art approval decisions on the existing 93.
4. Admit first distinct licensed pilot title only with working Hub entrypoint, score adapter, gameplay QA, attribution and P95 mobile performance evidence. Approval count remains zero until backed by per-title evidence; no catalog padding or duplicate mechanics.
5. Retain separate prize-score replay/processor settlement and 10k staging gates before any public paid competitions or public 500-game launch.

**No application deletion, deployment-history deletion, live database write, payment change or production redeploy was performed in this source fix session.**
