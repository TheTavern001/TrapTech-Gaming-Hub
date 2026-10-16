extends Node

# Stub matching original 84 achievements across categories
var achievements = [
	{"id": "first_run", "name": "First Run", "category": "overall", "desc": "Complete one scored run", "unlocked": false},
	{"id": "score_100", "name": "Century", "category": "game", "desc": "Score 100 in any game", "unlocked": false},
	{"id": "season_5", "name": "Season Climber", "category": "season", "desc": "Reach season level 5", "unlocked": false},
	{"id": "giveaway_enter", "name": "Entrant", "category": "giveaway", "desc": "Book one giveaway", "unlocked": false},
	{"id": "collector", "name": "Collector", "category": "cosmetic", "desc": "Own 5 cosmetics", "unlocked": false}
]

func check_unlocks(pd) -> Array:
	var newly = []
	for a in achievements:
		if a.unlocked: continue
		var unlock = false
		match a.id:
			"first_run":
				unlock = pd.high_scores.size() > 0
			"score_100":
				for s in pd.high_scores.values():
					if s >= 100: unlock = true
			"season_5":
				unlock = pd.season_level >= 5
			"giveaway_enter":
				unlock = pd.giveaway_bookings.size() > 0
			"collector":
				unlock = pd.owned_cosmetics.size() >= 5
		if unlock:
			a.unlocked = true
			newly.append(a)
	return newly
