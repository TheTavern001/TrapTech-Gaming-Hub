# Feature Map: Original Node Hub → Godot Rebuild

| Original Feature | Godot Status | Notes |
|---|---|---|
| Hub / game grid | Done | scenes/hub.tscn + scripts/hub.gd |
| Core games (Sky Hopper, Stack, Drift Rush) | Partial | 3 distinct playable scenes; rest still placeholders |
| Local scores + season XP | Done | PlayerData autoload, saved to user://player_data.json |
| Cosmetics / Season Pass | Done (stub) | scenes/shop.tscn — buy with XP |
| Giveaway booking | Done (stub) | scenes/giveaways.tscn — spend XP |
| Achievements | Done (stub) | 5 sample unlocks |
| Profile | Done | scenes/profile.tscn — shows scores, level, cosmetics, bookings |
| Server-validated scores / anti-cheat | Not yet | Requires keeping Node backend or reimplementing |
| Full accounts / login | Not yet | Local only for now |
| Admin dashboard | Not yet | Server feature |
| 80+ library games | Not yet | Need individual Godot scenes |
| Tournaments, friends, notifications, PWA | Not yet | Can be added as Godot UI + backend calls |
| Brands / sponsors | Not yet | Server feature |

## Practical path to “everything”
1. Finish distinct Godot games for the core titles.
2. Keep expanding local systems (quests, more cosmetics, better profile).
3. Optionally connect Godot client to the existing Node backend via HTTP so scores, giveaways, and accounts stay real.
4. Polish visuals and export (HTML5 / Windows).

The original server code stays on main. This branch is the player-facing rebuild.
