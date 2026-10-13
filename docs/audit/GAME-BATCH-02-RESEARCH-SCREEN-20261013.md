# First expansion candidates — distinctive-mechanics source screen
Date: 2026-10-13. **Research only. 0 games imported, 0 AAA-certified.** Candidate intake begins only after the existing 93-title quality baseline is accepted. Do not count any of these as active games or launch quality approvals.

## First-pass repository review
The five public GitHub repositories below were retrieved on 2026-10-13. Each has a visible repository-wide license declaration and a checked-in license file, but this does NOT clear every bundled image, font, sound, brand or third-party dependency. Each must still pass a per-file dependency and embedded-source rights review before being copied.

| Proposed Hub working title | Upstream | Reported repo license | Distinct mechanics to verify | Main blockers | Status |
|---|---|---|---|---|---|
| 13th Floor | https://github.com/roblouie/js13k-2024 | MIT | 3D timed horror-room escape, navigation and puzzle/route mastery; not another endless runner | Verify performance on a Samsung-class GPU, mobile camera/controls, fair timed goal and deterministic route scoring; author new premium art/audio | RESEARCH |
| Space Huggers | https://github.com/KilledByAPixel/SpaceHuggers | GPL-3.0 | Roguelike platform shooter with destructible terrain; test novelty against existing shooters | GPL distribution/source obligations, any upstream media rights, deterministic terrain and server-trusted elimination/level score, responsive touch twin controls and polished effects | RESEARCH |
| Territory Run | https://github.com/michelebucelli/xonix-js | MIT | Territory-enclosure/capture, continuous risk of cutting a boundary, area-based score; verify distinct from Light Cycle | Current simple visual presentation, gameplay depth and mobile pointer input; authoritative area scoring needed | RESEARCH |
| Typer | https://github.com/ninest/typer | MIT | Ten-second skill typing sprint, accuracy + speed, unlike current reaction/tile library | Five static media files need individual license inspection; protect text input, prevent client-forged WPM/latency/timestamps and mobile soft-keyboard obstruction; no prizes before replay | RESEARCH |
| DR1LL3R | https://github.com/leereilly/DR1LL3R | MIT | Directional drill/combo risk reward with timed hazards and score chain | Verify mobile movement, source sound rights, ranking novelty versus arcade obstacles, high-quality original visual/feedback and server replay | RESEARCH |

## Deliberate exclusions from near-term import
- Another 2048 variant (Number Merge Classic / Number Merge Lab): duplicates active `bud-merge`'s core merge loop. A different CSS skin does not create a new game.
- Snowling (bowling) overlaps the existing `pin-strike` bowling game; defer until genuinely different mechanics proven.
- Snowboard Sprint has significant overlap with existing `dune-glide` high-speed downhill loop.
- Stunt Cycle overlaps `wreck-ride` / `kickflip-city` stunt-loop families.
- Multiple additional one-button endless runners, fish dodge variants and arcade shooters must pass the same comparison before acceptance.

## Next decision sequence
1. Inspect upstream tagged/source revisions and the **exact LICENSE bundled with each selected release**, including fonts/media/dependencies. Record file SHA and source-URL provenance.
2. Compare actual player decisions/scoring, not names, against all 93 baseline titles. Only distinct, worthwhile experiences proceed; remaining entries stay RESEARCH or REJECTED.
3. Integrate one trial game on a separate private review branch with the common Hub signed-run adapter, tested per-game settings (including pause), source-specific art/credits and neutral cosmetic-only options.
4. Run test scores (valid/forged, seed, restart, pause abuse), dynamic difficulty, touch/desktop controls, 60fps-class measured Android p95/720px and real-device visual signoff. Official paid giveaway scoring requires independent server replay proof, not just signed sessions.
5. Create intake-quality records with real evidence, and only then add one approved title to the 500-game target. Never register or sell generic source art as AAA by virtue of a license file.

The five candidate names are provisional, not brand-licensed references, and no code or dependencies were downloaded/merged in this screening.
