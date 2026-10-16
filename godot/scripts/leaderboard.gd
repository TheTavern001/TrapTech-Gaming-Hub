extends Node

# Local leaderboard stub (would be server-driven in hybrid)
var boards = {
	"sky_hopper": [{"name": "You", "score": 0}, {"name": "Player2", "score": 120}, {"name": "Player3", "score": 85}],
	"stack": [{"name": "You", "score": 0}, {"name": "Player2", "score": 15}, {"name": "Player3", "score": 9}],
	"drift_rush": [{"name": "You", "score": 0}, {"name": "Player2", "score": 45}, {"name": "Player3", "score": 32}]
}

func update_player(game: String, score: int) -> void:
	if boards.has(game):
		boards[game][0].score = max(boards[game][0].score, score)
		boards[game].sort_custom(func(a, b): return a.score > b.score)
