extends Node2D

var score: int = 0
var speed: float = 220.0
var player: ColorRect
var obstacles: Array = []
var game_over: bool = false

func _ready() -> void:
	player = ColorRect.new()
	player.size = Vector2(50, 30)
	player.color = Color(1.0, 0.8, 0.2)
	player.position = Vector2(200, 500)
	add_child(player)
	
	var label = Label.new()
	label.name = "ScoreLabel"
	label.position = Vector2(20, 20)
	label.add_theme_font_size_override("font_size", 32)
	add_child(label)
	
	var timer = Timer.new()
	timer.wait_time = 0.9
	timer.timeout.connect(_spawn)
	add_child(timer)
	timer.start()

func _process(delta: float) -> void:
	if game_over: return
	if Input.is_action_pressed("ui_left") or (Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT) and get_global_mouse_position().x < 640):
		player.position.x -= speed * delta
	if Input.is_action_pressed("ui_right") or (Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT) and get_global_mouse_position().x >= 640):
		player.position.x += speed * delta
	player.position.x = clamp(player.position.x, 40, 1200)
	
	for obs in obstacles:
		obs.position.y += speed * delta
		if obs.position.y > 750:
			obs.queue_free()
			obstacles.erase(obs)
			score += 1
		elif player.get_rect().intersects(obs.get_rect()):
			_game_over()
	$ScoreLabel.text = "Score: %d" % score

func _spawn() -> void:
	if game_over: return
	var obs = ColorRect.new()
	obs.size = Vector2(60, 40)
	obs.color = Color(0.8, 0.2, 0.2)
	obs.position = Vector2(randf_range(50, 1150), -40)
	add_child(obs)
	obstacles.append(obs)

func _game_over() -> void:
	game_over = true
	var pd = get_node("/root/PlayerData")
	if pd: pd.add_score("drift_rush", score)
	var label = Label.new()
	label.text = "Game Over\nScore: %d\nClick to return" % score
	label.position = Vector2(500, 300)
	label.add_theme_font_size_override("font_size", 36)
	add_child(label)

func _input(event: InputEvent) -> void:
	if game_over and event is InputEventMouseButton and event.pressed:
		get_tree().change_scene_to_file("res://scenes/hub.tscn")
