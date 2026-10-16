extends Control

@onready var play_button: Button = $VBox/PlayButton
@onready var status_label: Label = $VBox/Status
@onready var grid: GridContainer = $VBox/GameGrid

var games = [
	{"title": "Sky Hopper", "scene": "res://scenes/example_game.tscn", "desc": "Tap to rise, dodge bars"},
	{"title": "Stack", "scene": "res://scenes/stack_game.tscn", "desc": "Time the drop, build the tower"},
	{"title": "Drift Rush", "scene": "res://scenes/drift_game.tscn", "desc": "Steer left/right, dodge obstacles"}
]

func _ready() -> void:
	play_button.pressed.connect(_on_play_pressed)
	status_label.text = "Trap Tech Hub — play, earn XP, unlock cosmetics"
	_build_grid()
	_add_nav()

func _add_nav() -> void:
	var nav = HBoxContainer.new()
	nav.alignment = BoxContainer.ALIGNMENT_CENTER
	nav.add_theme_constant_override("separation", 8)
	var buttons = [
		["Shop / Season", "res://scenes/shop.tscn"],
		["Giveaways", "res://scenes/giveaways.tscn"],
		["Achievements", "res://scenes/achievements.tscn"],
		["Quests", "res://scenes/quests.tscn"],
		["Leaderboard", "res://scenes/leaderboard.tscn"],
		["Notifications", "res://scenes/notifications.tscn"],
		["Profile", "res://scenes/profile.tscn"]
	]
	for b in buttons:
		var btn = Button.new()
		btn.text = b[0]
		btn.pressed.connect(_go.bind(b[1]))
		nav.add_child(btn)
	$VBox.add_child(nav)
	$VBox.move_child(nav, 3)

func _go(path: String) -> void:
	get_tree().change_scene_to_file(path)

func _build_grid() -> void:
	for g in games:
		var btn = Button.new()
		btn.text = g.title + "\n" + g.desc
		btn.custom_minimum_size = Vector2(300, 140)
		btn.add_theme_font_size_override("font_size", 18)
		btn.pressed.connect(_load_game.bind(g.scene))
		grid.add_child(btn)

func _on_play_pressed() -> void:
	_load_game("res://scenes/example_game.tscn")

func _load_game(path: String) -> void:
	status_label.text = "Loading..."
	get_tree().change_scene_to_file(path)
