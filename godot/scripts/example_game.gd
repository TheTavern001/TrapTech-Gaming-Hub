extends Node2D

var score: int = 0
var speed: float = 200.0
var player: ColorRect
var obstacles: Array = []
var game_over: bool = false

func _ready() -> void:
	player = ColorRect.new()
	player.size = Vector2(40, 40)
	player.color = Color(0.2, 0.8, 1.0)
	player.position = Vector2(200, 360)
	add_child(player)
	
	var label = Label.new()
	label.name = "ScoreLabel"
	label.position = Vector2(20, 20)
	label.add_theme_font_size_override("font_size", 32)
	add_child(label)
	
	var timer = Timer.new()
	timer.wait_time = 1.2
	timer.timeout.connect(_spawn_obstacle)
	add_child(timer)
	timer.start()

func _process(delta: float) -> void:
	if game_over:
		return
	if Input.is_action_pressed("ui_accept") or Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
		player.position.y -= speed * delta * 1.5
	else:
		player.position.y += speed * delta * 0.6
	player.position.y = clamp(player.position.y, 40, 680)
	
	for obs in obstacles:
		obs.position.x -= speed * delta
		if obs.position.x < -50:
			obs.queue_free()
			obstacles.erase(obs)
			score += 1
		elif player.get_rect().intersects(obs.get_rect()):
			_game_over()
	$ScoreLabel.text = "Score: %d" % score

func _spawn_obstacle() -> void:
	if game_over:
		return
	var obs = ColorRect.new()
	obs.size = Vector2(30, randf_range(80, 180))
	obs.color = Color(1.0, 0.3, 0.4)
	obs.position = Vector2(1280, randf_range(50, 500))
	add_child(obs)
	obstacles.append(obs)

func _game_over() -> void:
	game_over = true
	var label = Label.new()
	label.text = "Game Over\nScore: %d\nClick to return" % score
	label.position = Vector2(500, 300)
	label.add_theme_font_size_override("font_size", 40)
	add_child(label)
	await get_tree().create_timer(0.1).timeout
	# Simple return on next click
	get_tree().get_root().get_node("Hub").visible = true if get_tree().get_root().has_node("Hub") else null

func _input(event: InputEvent) -> void:
	if game_over and event is InputEventMouseButton and event.pressed:
		get_tree().change_scene_to_file("res://scenes/hub.tscn")
