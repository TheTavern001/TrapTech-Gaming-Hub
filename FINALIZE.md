# FINALIZE: putting v7 live (for Reese)

1. **Back up first.** In admin go to *Settings > Data & backups* and download the latest backup, or copy `/data/hub.db`. v7 migrates the DB on boot (v6 -> v7 adds tables and columns and never drops data; checked with a v6 DB that includes TheBudTender001).
2. **Push and deploy** this branch to Deplexo with the same Dockerfile (nothing has been pushed from here).
3. **Set the env vars** on Deplexo (see the table in HANDOFF.md). New in v7:
   - `BTC_ADDRESS=32Y22JCbcemRzTV661yqYzG1PU6tnoE2rB`
   - `PUBLIC_URL=https://<your domain>` (and `CANONICAL_REDIRECT=1` if you want a single hostname)
4. **After the deploy:**
   - `/healthz` returns 200, and the home page shows the crown TT shield.
   - Sign in at `/<ADMIN_PATH>/`. The dashboard should show *13/13 games live*.
   - *Admin > Store & orders*: checkout shows **on**, with the address above.
   - Buy the cheapest Crown pack with a small real payment and check it is granted (see HANDOFF.md).
   - Sign in as TheBudTender001: profile, runs and avatar should all be there.
   - Optional: `BASE=https://<domain> node tools/e2e-live.js` for a gentle live smoke test.
5. **Players get the new version:** the service worker cache is `gh-shell-v7`, so returning players get the new shell on their next visit.
6. **Rollback:** redeploy the previous image and restore the backup from step 1. The v7 tables are simply ignored by v6.
