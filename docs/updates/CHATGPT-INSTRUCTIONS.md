# Instructions for ChatGPT / Claude / Next Assistant — Gaming Hub Updates (Oct 18 2026)

**Repo:** TheTavern001/gaming-hub-2  
**Branch:** v8-games-upgrade (Deplexo tracks this; pushes redeploy ~3 min)  
**Live:** https://glassy-drifter-9532.de.deplexo.com (URL must never change)

## Start Here (recommended order)
1. Read `docs/HANDOFF.md` first (hard rules, architecture, per-game table).
2. Read `docs/updates/FULL-IMPLEMENTATION-FOR-CLAUDE.md` — this is the complete plan for all systems + games.
3. Then the supporting files in `docs/updates/`:
   - `GIVEAWAY-HOSTING-AND-BRIEF.md`
   - `ADMIN-OPS-GUIDE.md`
   - `COSMETICS-NAV-GAMES-UPDATES.md`
   - `COMPETITOR-RESEARCH-SUMMARY.md`
   - `README-UPDATE-PACKAGE.md`

## Hard Rules (do not break)
- Never push to main. Only v8-games-upgrade.
- Batch pushes (≤4 files). Every push redeploys.
- Secret admin path only (ADMIN_PATH env in Deplexo, never in repo). `/admin` must 404.
- Cosmetic-only economy. No cash value for Credits. No luck games for giveaways.
- Skill-only tie-breaks. Portrait, endless, uncapped scores.
- Only CC0 or original assets. No commercial copies.
- Never print secrets. Honest reporting only.

## What to Implement (full scope)
Follow `FULL-IMPLEMENTATION-FOR-CLAUDE.md`. Priority order:
1. All systems (Giveaway Brief + Potato Chat winner flow + liability, cosmetic trading/sharing + privacy, nav merge, admin completeness).
2. Immediate game fixes + worst-first quality pass.
3. Controlled growth toward ~500 legal/polished games.

## Admin Access (secret)
- Admin lives at `https://glassy-drifter-9532.de.deplexo.com/<ADMIN_PATH>/`
- ADMIN_PATH is a long random string set only in Deplexo Environment tab (not in GitHub).
- Owner login uses ADMIN_USERNAME / ADMIN_PASSWORD env until changed in-app.
- TOTP required. Full unconstrained access once signed in.
- If Reese cannot access: check Deplexo env for ADMIN_PATH, ADMIN_USERNAME, ADMIN_PASSWORD. Reset via ADMIN_RESET_TOKEN if needed.

## How to use with limited usage / Claude
- Implement one system or 1–3 games completely, push, then start a fresh Claude session.
- Paste this file + FULL-IMPLEMENTATION-FOR-CLAUDE.md + HANDOFF.md into the new session.
- Tell it: "Continue from these docs. Follow hard rules. Implement the next priority. Update STATUS if you create one. Be honest."

Do not invent game loops or fill UNKNOWN fields. Verify before claiming done.
