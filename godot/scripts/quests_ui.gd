extends Control

@onready var list: VBoxContainer = $VBox/List
@onready var back: Button = $VBox/Back

func _ready() -> void:
	back.pressed.connect(func(): get_tree().change_scene_to_file("res://scenes/hub.tscn"))
	var q = get_node("/root/Quests") if has_node("/root/Quests") else null
	var pd = get_node("/root/PlayerData")
	if q and pd:
		q.update_from_data(pd)
		for quest in q.quests:
			var lbl = Label.new()
			var status = "DONE" if quest.done else "%d / %d" % [quest.progress, quest.target]
			lbl.text = quest.name + " — " + status + " (+%d XP)" % quest.reward_xp
			list.add_child(lbl)
