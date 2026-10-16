extends Control

@onready var list: VBoxContainer = $VBox/List
@onready var back: Button = $VBox/Back

func _ready() -> void:
	back.pressed.connect(func(): get_tree().change_scene_to_file("res://scenes/hub.tscn"))
	var lb = get_node("/root/Leaderboard") if has_node("/root/Leaderboard") else null
	var pd = get_node("/root/PlayerData")
	if lb and pd:
		for game in pd.high_scores:
			lb.update_player(game, pd.high_scores[game])
		for game in lb.boards:
			var header = Label.new()
			header.text = "[b]%s[/b]" % game
			header.bbcode_enabled = true
			list.add_child(header)
			for i in range(lb.boards[game].size()):
				var entry = lb.boards[game][i]
				var row = Label.new()
				row.text = "%d. %s — %d" % [i+1, entry.name, entry.score]
				list.add_child(row)
			list.add_child(HSeparator.new())
