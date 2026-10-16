# Trap Tech Gaming Hub — Godot Rebuild

Open this in Godot 4.3+ right now. Core systems are in place.

## How to open
1. Pull the latest on branch `godot-hub-start`.
2. Godot → Project → Import → select `godot/project.godot`.
3. Press F5.

## What is working now
- Hub with game grid and navigation.
- Playable example game (tap/hold to rise, dodge bars). Score is saved.
- Cosmetics / Season Pass screen: view level, XP, buy placeholder items with XP.
- Giveaway Booking screen: spend XP to book entries.
- Local player data (scores, cosmetics, season XP, bookings) that persists between sessions.

All games currently share the same example scene. Season XP is earned from scores. Cosmetics and giveaways spend that XP.

## Next
- Distinct game scenes for each card.
- Better visual polish and mobile controls.
- Optional backend hook for real score validation and multiplayer giveaways.
- HTML5 / Windows export.

Pull, open, play a round, check the Shop and Giveaways, then tell me what to change or add next.
