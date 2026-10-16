extends Control

@onready var info: RichTextLabel = $VBox/Info
@onready var back: Button = $VBox/Back

func _ready() -> void:
	back.pressed.connect(func(): get_tree().change_scene_to_file("res://scenes/hub.tscn"))
	var pd = get_node("/root/PlayerData")
	var text = "[b]Season Level:[/b] %d\n[b]Season XP:[/b] %d\n\n[b]High Scores:[/b]\n" % [pd.season_level, pd.season_xp]
	for game in pd.high_scores:
		text += "• %s: %d\n" % [game, pd.high_scores[game]]
	if pd.high_scores.is_empty():
		text += "(none yet)\n"
	text += "\n[b]Owned Cosmetics:[/b]\n"
	for c in pd.owned_cosmetics:
		text += "• %s\n" % c
	text += "\n[b]Giveaway Bookings:[/b] %d\n" % pd.giveaway_bookings.size()
	info.text = text
