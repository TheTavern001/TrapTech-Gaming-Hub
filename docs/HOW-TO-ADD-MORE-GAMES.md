# How to continually add more games after this release

The Gaming Hub is designed for ongoing expansion. The current baseline is ~93 active titles (13 core + library). Target remains 500 distinct, quality-approved games.

## Adding a new Games Library title
1. Create a new folder under `public/games-lib/<slug>/` with `index.html`, `game.js` (or the shared engine entry), assets, and a `CREDITS.md` if using third-party CC0.
2. Register it in `src/games-lib.js` (id, name, category, scoring envelope, art flags).
3. Update `public/games-lib/catalog.json` (or let the generator rebuild it).
4. Run local checks:
   ```sh
   node tools/verify-game-syntax.js
   node tools/games-lib-static-check.js
   node tools/verify-prelaunch.js
   ```
5. Add a short entry to `docs/GAME-STATUS.md` and `docs/GAMES-LIB.md`.
6. Commit, push to `main`. Deplexo will auto-build and deploy (confirm READY in the dashboard).
7. Smoke-test the live URL: launch, play a short run, submit score, check leaderboard.

## Core games
Core games live in `public/js/games/` and are listed in `src/config.js`. Prefer extending the library for new titles; only promote to core if it needs special server scoring or giveaway treatment.

## Shop / avatar / cosmetics
- New cosmetic items can be added to the handmade list in `src/shop.js` or generated via the universe system in `src/cosmetic-universe.js`.
- Avatar parts are defined in `src/avatars.js`. Keep them cosmetic-only (no score or eligibility impact).
- After changes, run `node tools/e2e-economy.js` and relevant avatar tests.

## Stripe & URL changes
- Stripe webhook is already pointed at the current Deplexo URL.
- To move to a custom domain:
  1. In Deplexo dashboard → Domains, add the hostname and follow the TXT + CNAME instructions.
  2. Update `PUBLIC_URL` env var to the new https origin.
  3. Create a new Stripe webhook (or update the existing one) for `https://new-domain/api/store/webhook/stripe` and update `STRIPE_WEBHOOK_SECRET`.
  4. Redeploy and re-test a sandbox purchase.

## Release cadence
Push small, verified batches (5–20 games) with updated docs and a green local check suite. Record the SHA and Deplexo outcome in `docs/DEPLOYMENT-JOURNAL.md`. This keeps the hub continuously updatable without big-bang risk.

Owner review remains required before calling any new title "AAA launch-ready".
