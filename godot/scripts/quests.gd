extends Node

var quests = [
	{"id": "play_3", "name": "Play 3 games", "progress": 0, "target": 3, "reward_xp": 50, "done": false},
	{"id": "score_500", "name": "Score 500 total", "progress": 0, "target": 500, "reward_xp": 100, "done": false},
	{"id": "book_1", "name": "Book a giveaway", "progress": 0, "target": 1, "reward_xp": 75, "done": false}
]

func update_from_data(pd) -> void:
	var total_score = 0
	for s in pd.high_scores.values():
		total_score += s
	quests[0].progress = min(pd.high_scores.size(), 3)
	quests[1].progress = min(total_score, 500)
	quests[2].progress = min(pd.giveaway_bookings.size(), 1)
	for q in quests:
		if not q.done and q.progress >= q.target:
			q.done = true
			pd.season_xp += q.reward_xp
			pd.save_data()
