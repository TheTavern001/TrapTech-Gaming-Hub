extends Control

@onready var play_button: Button = $VBox/PlayButton
@onready var status_label: Label = $VBox/Status

func _ready() -> void:
	play_button.pressed.connect(_on_play_pressed)
	status_label.text = "Hub skeleton ready — Godot 4.3"

func _on_play_pressed() -> void:
	status_label.text = "Loading example game..."
	# Placeholder: will load a real game scene next
	await get_tree().create_timer(0.5).timeout
	status_label.text = "Example game would start here. Feedback welcome."
