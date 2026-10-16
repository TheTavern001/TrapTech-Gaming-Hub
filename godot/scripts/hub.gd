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
	status_label.text = "Trap Tech Hub — Godot rebuild ready"
	_build_grid()

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
