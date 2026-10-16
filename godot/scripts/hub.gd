extends Control

@onready var play_button: Button = $VBox/PlayButton
@onready var status_label: Label = $VBox/Status
@onready var grid: GridContainer = $VBox/GameGrid

var games = [
	{"title": "Sky Hopper", "scene": "res://scenes/example_game.tscn", "desc": "Tap to rise, dodge the bars"},
	{"title": "Stack", "scene": "res://scenes/example_game.tscn", "desc": "Timing drop (placeholder)"},
	{"title": "Drift Rush", "scene": "res://scenes/example_game.tscn", "desc": "Coming next"}
]

func _ready() -> void:
	play_button.pressed.connect(_on_play_pressed)
	status_label.text = "Trap Tech Hub — free games, season pass, giveaways"
	_build_grid()
	_add_nav()

func _add_nav() -> void:
	var nav = HBoxContainer.new()
	nav.alignment = BoxContainer.ALIGNMENT_CENTER
	var shop_btn = Button.new()
	shop_btn.text = "Cosmetics / Season"
	shop_btn.pressed.connect(func(): get_tree().change_scene_to_file("res://scenes/shop.tscn"))
	var give_btn = Button.new()
	give_btn.text = "Giveaways"
	give_btn.pressed.connect(func(): get_tree().change_scene_to_file("res://scenes/giveaways.tscn"))
	nav.add_child(shop_btn)
	nav.add_child(give_btn)
	$VBox.add_child(nav)
	$VBox.move_child(nav, 3)

func _build_grid() -> void:
	for g in games:
		var btn = Button.new()
		btn.text = g.title + "\n" + g.desc
		btn.custom_minimum_size = Vector2(280, 120)
		btn.pressed.connect(_load_game.bind(g.scene))
		grid.add_child(btn)

func _on_play_pressed() -> void:
	_load_game("res://scenes/example_game.tscn")

func _load_game(path: String) -> void:
	status_label.text = "Loading game..."
	get_tree().change_scene_to_file(path)
