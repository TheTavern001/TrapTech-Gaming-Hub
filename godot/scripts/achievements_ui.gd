extends Control

@onready var list: VBoxContainer = $VBox/List
@onready var back: Button = $VBox/Back

func _ready() -> void:
	back.pressed.connect(func(): get_tree().change_scene_to_file("res://scenes/hub.tscn"))
	var ach = get_node("/root/Achievements") if has_node("/root/Achievements") else null
	var pd = get_node("/root/PlayerData")
	if ach and pd:
		ach.check_unlocks(pd)
		for a in ach.achievements:
			var lbl = Label.new()
			lbl.text = ("✓ " if a.unlocked else "○ ") + a.name + " — " + a.desc
			list.add_child(lbl)
