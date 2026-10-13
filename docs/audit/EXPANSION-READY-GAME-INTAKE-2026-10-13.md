# Registry-driven intake QA for games 94–500+
Date: 2026-10-13. Owner target: ~500 truly distinct, individually validated browser games. Existing baseline is 13 core plus 80 library, NOT 93 certified titles.

## Problem corrected
Two Docker regression suites hard-coded current totals: `tools/test-game-source-mechanics.js` expected exactly 93 records / 13 core / 80 library; `tools/test-player-game-settings.js` required precisely 80 titles (77 built + 3 vendored). This made any legitimate expansion fail while providing no extra quality protection.

## New contract
- Treat `docs/audit/GAME-INTAKE-BASELINE.json` as immutable **minimum**, not fixed total. Baseline 13+80 cannot silently disappear.
- Calculate registered totals at build time from `src/games-lib.js`; require matching per-title generated source audit and globally unique IDs.
- Verify each new built game uses the tested Kit + UI preferences. Any new vendored engine must link the vendor settings module, have its slug explicitly mapped to an adapter, and have a real native pause implementation. Do not copy an existing stub and pretend the game works.
- Preserve the missing-script negative test: artificially suppress one required `bud-merge/js/game_manager.js` module and require a failing exit code naming that path. Existing games must remain complete.
- Rebuild catalog and inventory via `node tools/games-lib-build.js` when introducing any new registry entry, then rerun every Docker regression.
- **Do not interpret admission as AAA pass**. Novel mechanics, source rights, mobile FPS evidence, a clean score replay and owner art approval are distinct manual gates tracked by `tools/quality-readiness.js`; `--require-baseline --require-500` still blocks the public launch until proof is present.
- 10,000-user staging load, player-avatar 3D source integration, appearance-only monetization and secure hosted prize scoring still remain unmet.

This change is isolated on a non-deploying branch until Node/Docker and owner Deplexo review. No game added to the public catalog by this change, and no existing accounts or scores modified.
