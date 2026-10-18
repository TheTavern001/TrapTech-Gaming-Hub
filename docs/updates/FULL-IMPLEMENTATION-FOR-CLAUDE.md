# Full Implementation Guide for Claude (or next assistant) — All Systems + Games

**Goal:** Make the Hub ready for trusted test players, then public. Implement all discussed systems. Continue game quality + library growth toward ~500.

**Repo:** TheTavern001/gaming-hub-2  
**Branch:** v8-games-upgrade only  
**Live:** https://glassy-drifter-9532.de.deplexo.com  
**Pushes:** Every push redeploys (~3 min downtime). Batch ≤4 files. Never push secrets.

## Hard Rules (do not break)
- Secret ADMIN_PATH only (env in Deplexo). `/admin` = 404.
- Cosmetic-only Hub Credits. No cash value, no trading Credits, no buying entries or advantages.
- Skill-only tie-breaks. Portrait, endless, uncapped scores. No luck games for giveaways.
- Only CC0 / original assets. No commercial copies or clones of paid games.
- Honest reporting. Never claim done without verification.

## Priority 1 — All Systems (implement these fully)

### 1. Giveaway Hosting ("Host a Giveaway")
- Require the full standardized Giveaway Brief before any campaign goes live (see docs/updates/GIVEAWAY-HOSTING-AND-BRIEF.md).
- Fields: Brand name, Prize name & specs, Total retail value USD, Eligibility & geo-restrictions (21+), Entry requirements, Fulfillment contact (name, email, Potato Chat link), Shipping & liability waiver checkbox.
- Admin review/approve gate.
- On winner: in-Hub notification that includes the brand’s Potato Chat link.
- Liability disclaimer in rules and winner message (Hub is coordinator only; brand fulfills; non-fulfillers blacklisted).
- Simplified brand affiliation copy (optional, one brand, switch every 30 days, Hub-only, does not touch Telegram or external rights).

### 2. Cosmetics Trading & Sharing
- Opt-in peer-to-peer trading of cosmetic items only (skins, badges, frames). No Credits, no real money.
- Admin can enable/disable trading globally or per item.
- Xbox-style showcase sharing of unlocked badges/cosmetics/achievements on public profiles.
- Privacy toggle in Settings → Privacy → Profile Visibility to turn sharing off.
- Keep the cosmetic-only policy text, with the clear trading exception for items only.

### 3. Navigation
- Merge Leaderboard and Community into one bottom-nav icon (e.g. "Ranks & Community" or "Leaderboard & Community").
- Proposed: Games | Leaderboard & Community | Giveaways | Profile (or keep Shop accessible).
- Update NAV in public/js/app.js and any related routes/pages so /community still works or redirects cleanly.

### 4. Admin
- Confirm secret admin has full unconstrained access to games, cosmetics, users, brands, giveaways, shop, etc.
- Ensure Giveaway Brief approval, trading toggles, and blacklist tools are available in admin.
- Document any gaps in docs/updates/ADMIN-OPS-GUIDE.md.

### 5. Other systems polish
- Update shop/achievements/avatar displays to match any visual upgrades.
- Ensure free-to-enter path always exists.
- Verifiable / anti-rig winner selection (seeded random).

## Priority 2 — Games (quality first, then growth)

### Immediate fixes (from playtest)
- Hex-stack: restore the preferred earlier version.
- Wave games: make upgrades clickable.
- Balloon TD (pop-defense): real difficulty ramp.
- Smashy-style road (wanted-run / similar): only end run when caught by cops (trees/buildings do not kill).
- Recording issue, avatar/shop/achievements visual updates.

### AAA quality pass
- Follow the worst-first list in docs/HANDOFF.md (juice-only → overlay → art-upgraded → art-rebuilt → rebuilt).
- New gameplay twist + original art (not recolors or overlays) for each.
- Uniform high-res thumbnails (16:9 preferred).
- Categorized library layout (Cannabis, Evolution, Shooter, Tower Defense, Action, Casual, etc.).
- Portrait, endless, uncapped, skill-only, ≥7/10 quality, e2e pass, 0 console errors.

### Growing toward ~500
- Add only legal open-source / CC0 / properly licensed titles that can be fully hosted and scored.
- Prefer original or fully rebuilt games over iframe feeds (feeds cannot be giveaway-eligible).
- Batch ~20 at a time. Document source + license in CREDITS.md.
- Do not invent loops or claim popular paid titles without license.

## How to work with limited usage
1. Implement one system completely (e.g. Giveaway Brief end-to-end) and verify.
2. Commit and push.
3. Hand the next system to a fresh Claude session with this file + HANDOFF.md + the relevant update docs.
4. For games, do 1–3 full redos per session, then hand off the next batch.
5. Keep a short status note in docs/updates/STATUS.md after each push so the next assistant knows exactly where things stand.

## Definition of done for trusted testing
- Giveaway Brief + Potato Chat winner flow live and tested.
- Cosmetic trading/sharing + privacy toggle working.
- Merged nav live.
- Existing games playable without obvious breaks; worst ones improved or clearly marked.
- Secret admin accessible and functional.
- Liability disclaimer and affiliation copy clear.
- No console errors on main flows. Test suites still green.

Start with Priority 1. Be honest about what you finish. Update docs as you go.
