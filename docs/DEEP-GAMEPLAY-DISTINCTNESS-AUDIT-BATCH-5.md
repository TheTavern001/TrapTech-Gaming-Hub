# Deep Source Audit — Batch 5: Runtime-Level Mechanics Comparison

Status: source inspection on `games/deep-distinctness-audit`. This is not a hands-on playtest or a release sign-off. Sources inspected include each listed game's `game.js`, the library adapter, and the catalog.

## 1. Sky Flap ↔ Hoop Flap — high-overlap control grammar; rebuild one to retain both

**Shared core:** one-tap vertical flight, gravity, obstacle timing, a horizontal scrolling field, one-hit failure and endless score progression. The implementation details differ (Sky Flap uses custom image assets and rock-gate collision; Hoop Flap uses the shared `Kit.run` engine and hoop alignment/swish scoring), but the primary skill remains repeated flap timing through a narrow passage.

**Disposition:** do not count the hoop theme and bonus multiplier alone as a distinct game. Keep the stronger/cleaner implementation and redesign the other around a materially different loop, or retire it with stable-ID/deep-link/score-history protections. Before deciding which is stronger, run both on touch and keyboard, check asset provenance, collision fairness, and restart/pause behaviour.

## 2. Gem Rush ↔ Strain Crush — duplicate confirmed at core-loop level

Both source files implement an 8×8 adjacent-swap match-3 board, 3+ matching, gravity/refill, invalid-swap reversal, cascades, a timer that drains faster over time, and the same broad endless blitz loop. Gem Rush adds seven jewel types and special Flame/Star gems for 4/5 matches; Strain Crush has six types and no equivalent special-gem system in the inspected source.

**Disposition:** retain Gem Rush as the stronger mechanics candidate; redesign or retire Strain Crush rather than treating the cannabis palette as distinct gameplay. **Not retired yet.** Before any runtime/catalog change, inspect all event creation, score APIs, stored score history, client routes, external links and giveaway records for stable ID `gl-strain-crush`. Historical scores must remain attributable to the original ID; new event creation should not silently map old submissions to another game.

## 3. Bat Boy ↔ Long Ball — same batting fantasy, different depth; likely consolidate or intentionally reposition

Both are tap-to-swing batting games. Bat Boy uses a simpler timing window, three strikes and later curveballs/delays. Long Ball adds multiple pitch types (fastball, change-up, curve, slider), lateral contact alignment, launch/trajectory feedback, streaks, and a 10-out run.

**Disposition:** Long Ball is the stronger candidate for the main batting slot. Bat Boy should either be retired, or rebuilt into a clearly different baseball verb such as fielding, catching, base-running or throw selection. A deliberately labelled beginner mode is not enough by itself to justify a separate catalog title unless it has a clear audience/use case and unique progression.

## 4. Brick Blitz ↔ Orb Coil — distinct core loops; keep both

- **Brick Blitz:** player moves a paddle, launches and redirects a ball, reads ricochet angles, clears destructible brick walls and manages lives/power-ups/multi-ball.
- **Orb Coil:** player aims/shoots coloured marbles into a moving chain along a curved path; matches remove groups and trigger chain reactions, with pressure from the chain advancing toward an endpoint.

Both involve projectiles and matching/clearing targets, but the control verb, spatial geometry, timing pressure, target model and failure condition are different. Keep both if actual input and collision testing passes.

## 5. Catalog-to-runtime path audit — static check

The catalog contains 100 entries with 100 unique IDs and 100 unique slugs. All 100 catalog game-entry paths and all 100 thumbnail paths resolve to files in the repository tree at the audited commit. This is only a repository path-presence check; it does not prove the HTML launches, image decodes, gameplay works, or assets have correct rights provenance.

The inventory is recorded separately in `docs/CATALOG-TO-RUNTIME-INVENTORY.md`.

## Action gate before any retirement
- Resolve all references to the candidate stable ID in the full repository, including API validators, database/event logic, admin tools, client routes, score pages and documentation.
- Confirm historical scores and event records remain visible and attributable.
- Add an explicit retired/consolidated state and safe old-link handling; never silently submit a retired game's score under another ID.
- Add regression tests for old deep links, new event creation, score submission rejection/handling, and historical leaderboard display.
- Only then consider a runtime/catalog change in this isolated branch.

## Not completed by this batch
- No game has been removed or redirected.
- No gameplay/visual quality is certified AAA.
- No live browser or Samsung device test was performed.
- The full 4,950-pair comparison for 100 titles remains incomplete.
