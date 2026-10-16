extends Control

@onready var list: VBoxContainer = $VBox/List
@onready var back: Button = $VBox/Back

func _ready() -> void:
	back.pressed.connect(func(): get_tree().change_scene_to_file("res://scenes/hub.tscn"))
	var n = get_node("/root/Notifications") if has_node("/root/Notifications") else null
	if n:
		for note in n.notes:
			var lbl = Label.new()
			lbl.text = note.text + " (" + note.time + ")"
			list.add_child(lbl)
