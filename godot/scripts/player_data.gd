extends Node

# Simple persistent player state (local for now; can hook to backend later)
var high_scores: Dictionary = {}
var owned_cosmetics: Array = ["default_avatar", "gold_crown"]
var season_xp: int = 0
var season_level: int = 1
var giveaway_bookings: Array = []

func _ready() -> void:
	load_data()

func add_score(game_id: String, score: int) -> void:
	if not high_scores.has(game_id) or score > high_scores[game_id]:
		high_scores[game_id] = score
	season_xp += score / 10
	_check_level()
	save_data()

func _check_level() -> void:
	var needed = season_level * 500
	if season_xp >= needed:
		season_level += 1
		season_xp -= needed
		# Unlock a cosmetic placeholder
		if not owned_cosmetics.has("season_%d" % season_level):
			owned_cosmetics.append("season_%d" % season_level)

func book_giveaway(title: String, entry_cost: int) -> bool:
	if season_xp >= entry_cost:
		season_xp -= entry_cost
		giveaway_bookings.append({"title": title, "time": Time.get_datetime_string_from_system()})
		save_data()
		return true
	return false

func save_data() -> void:
	var data = {
		"high_scores": high_scores,
		"owned_cosmetics": owned_cosmetics,
		"season_xp": season_xp,
		"season_level": season_level,
		"giveaway_bookings": giveaway_bookings
	}
	var file = FileAccess.open("user://player_data.json", FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(data))
		file.close()

func load_data() -> void:
	if FileAccess.file_exists("user://player_data.json"):
		var file = FileAccess.open("user://player_data.json", FileAccess.READ)
		if file:
			var data = JSON.parse_string(file.get_as_text())
			file.close()
			if data:
				high_scores = data.get("high_scores", {})
				owned_cosmetics = data.get("owned_cosmetics", ["default_avatar"])
				season_xp = data.get("season_xp", 0)
				season_level = data.get("season_level", 1)
				giveaway_bookings = data.get("giveaway_bookings", [])
