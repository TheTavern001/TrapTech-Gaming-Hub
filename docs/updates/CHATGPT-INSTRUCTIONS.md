# Instructions for ChatGPT / Next Assistant — Gaming Hub Updates (Oct 18 2026)

**Repo:** TheTavern001/gaming-hub-2  
**Branch:** v8-games-upgrade (Deplexo tracks this; pushes redeploy ~3 min)  
**Live:** https://glassy-drifter-9532.de.deplexo.com (URL must never change)

## Start Here
1. Read `docs/HANDOFF.md` first (hard rules, architecture, per-game table).
2. Then read the new files in `docs/updates/`:
   - `GIVEAWAY-HOSTING-AND-BRIEF.md`
   - `ADMIN-OPS-GUIDE.md`
   - `COSMETICS-NAV-GAMES-UPDATES.md`
   - `COMPETITOR-RESEARCH-SUMMARY.md`
   - `README-UPDATE-PACKAGE.md` (priority order)

## Hard Rules (do not break)
- Never push to main. Only v8-games-upgrade.
- Batch pushes (≤4 files). Every push redeploys.
- Secret admin path only (ADMIN_PATH env in Deplexo, never in repo). `/admin` must 404.
- Cosmetic-only economy. No cash value for Credits. No luck games for giveaways.
- Skill-only tie-breaks. Portrait, endless, uncapped scores.
- Only CC0 or original assets. No commercial copies.
- Never print secrets. Honest reporting only.

## What to Implement Next (priority)
1. Giveaway Brief form + approval gate + Potato Chat winner notification + liability disclaimer (see GIVEAWAY-HOSTING-AND-BRIEF.md).
2. Confirm owner can reach secret admin (ADMIN_PATH from Deplexo env). Add ops checklist references.
3. Cosmetic trading (opt-in, items only) + Xbox-style sharing + privacy toggle.
4. Navigation merge: Leaderboard & Community into one bottom icon.
5. Thumbnail redo + AAA graphics/mechanics pass (worst-first from HANDOFF per-game table).
6. Continue toward ~500 games with legal sources only.

## Admin Access (secret)
- Admin lives at `https://glassy-drifter-9532.de.deplexo.com/<ADMIN_PATH>/`
- ADMIN_PATH is a long random string set only in Deplexo Environment tab (not in GitHub).
- Owner login uses ADMIN_USERNAME / ADMIN_PASSWORD env until changed in-app.
- TOTP required. Full unconstrained access once signed in.
- If Reese cannot access: check Deplexo env for ADMIN_PATH, ADMIN_USERNAME, ADMIN_PASSWORD. Reset via ADMIN_RESET_TOKEN if needed.

## Sharing this package
Copy the files in `docs/updates/` + this file + HANDOFF.md into a new ChatGPT session. Tell it: "Continue from these docs. Follow hard rules. Implement priority items. Be honest about what is done."

Do not invent game loops or fill UNKNOWN fields. Verify before claiming done.
