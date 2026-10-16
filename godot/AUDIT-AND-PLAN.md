# Trap Tech Gaming Hub — Audit & Godot Plan

## Existing Node hub (main branch) summary
- Core + library games (~93 active, target 500) with server-validated scores and anti-cheat.
- Accounts, leaderboards, giveaways (booking, multi-game, draws, brands/sponsors).
- Cosmetics, 84 achievements, XP/levels, free season track, daily quests, tournaments.
- Friends, notifications, invites, share cards, PWA, 21+ gate, full admin.
- Deployment pain: heavy Dockerfile, repeated Deplexo free-tier failures.

## Desired (from owner requests)
Free games, season pass/cosmetics (cosmetic only), giveaway booking, polished hub UI, mobile-first, score system, eventually high-quality public release. Prefer Godot so AI can generate most scenes/code and owner only tests.

## Current Godot branch status (godot-hub-start)
- Hub with game grid + nav.
- One playable example game that reports scores.
- Local PlayerData (scores, season XP/level, cosmetics, giveaway bookings) with save/load.
- Shop / Season screen (buy cosmetics with XP).
- Giveaway Booking screen.
- Achievements stub (5 sample achievements that unlock based on data).

## 7-day realistic target (sellable high-quality indie, not full AAA)
1. Distinct game scenes for 5 core titles (Sky Hopper, Stack, Drift Rush, etc.).
2. Full hub navigation (games, shop, giveaways, achievements, profile).
3. Local progression solid; optional simple backend later.
4. Visual polish + mobile controls.
5. HTML5 + Windows export ready for testing/demo.

## Next immediate actions
- Link Achievements from hub.
- Add more game placeholders and improve UI layout.
- Owner opens project, plays, and gives feedback.
