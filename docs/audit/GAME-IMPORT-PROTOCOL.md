# 500-game admissions — source, QA and provenance gate

**Baseline:** 13 active core titles + 80 Games Library titles = **93 currently registered active titles**. **Remaining to 500:** 407 distinct, accepted titles. The baseline slugs and core IDs are frozen in `docs/audit/GAME-INTAKE-BASELINE.json` so a future retirement or import cannot accidentally falsify the expansion count. The 120 entries in `docs/GAME-CANDIDATES.md` remain *research candidates*, not integrated games.

Run `node tools/verify-game-intake.js` from a Node 20 repository checkout to get a read-only report. New entries require records in `docs/audit/GAME-INTAKE-ACCEPTANCE.json`; this file starts empty and **must not be mass-filled with fictional passes**. Run `node tools/verify-game-intake.js --require-approved` for a release signoff of newly imported titles. This report does not replace Docker's structural/score checks or a real Android playthrough.

A new game admission requires a distinct named scoring/control loop, permissible code and *art/audio/model* licenses and source URL, a reviewed original/third-party CREDITS record, game file and launch page, responsive touch/keyboard, server-validated score and forged-score rejection, Android and desktop gameplay, measured p95 frame time, and owner visual approval. In gameplay QA, speed, pauses, input, game-over, restart, and replays must also be inspected; provide test log/video references alongside the structured acceptance record.

**Mechanics review:** game engine reuse is permitted when the player decisions and objectives differ; a skin-only duplicate is not accepted. Current retired duplicate slugs remain prohibited by both prelaunch audits. **Payment/avatars/shop:** they stay the same Hub systems, and game integrations must never sell gameplay power.

### Batch workflow

1. Screen 20 candidates from `docs/GAME-CANDIDATES.md` against existing 93 games, licenses, art direction and asset source records. Prefer genuinely different mechanics to a batch of endless runners.
2. Prepare self-contained source/build files in `public/games-lib/<slug>/` and **write a custom CREDITS.md** with the actual materials/licensing. Do not call the builder until credit records exist.
3. Register the candidate in `src/games-lib.js`. Regenerate `public/games-lib/catalog.json`, `docs/GAMES-LIB.md`, and generated per-game launch pages via `node tools/games-lib-build.js`. The builder must preserve authored credits and phone zoom.
4. Add intake record with status PENDING. Execute structural checks, anti-cheat and forged-score tests, desktop+Android input, real-world FPS, duplicate review and owner inspection. Record each result, then mark APPROVED only after evidence.
5. Re-run build and source audits; produce a Deplexo candidate deployment. Record the exact commit SHA, deployment result, first error/fix if any, and final live build fingerprint in the deployment journal.
6. Accept only passing games into release totals. Repeat until 500; do not advertise all 500 as AAA before every game passes its own criteria.

**Build-time count audit fix:** the historical 80-game equality in `tools/verify-prelaunch.js` and `tools/prelaunch-deep-audit.js` now uses registry-derived counts and a minimum baseline guard. A valid 81st or 100th title no longer causes a false static blocker merely because the number increased. The full catalog, docs and actual game files must still match.
