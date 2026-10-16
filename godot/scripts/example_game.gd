extends Node2D

var score: int = 0
var speed: float = 220.0
var player: ColorRect
var obstacles: Array = []
var game_over: bool = false
var particles: CPUParticles2D

func _ready() -> void:
	player = ColorRect.new()
	player.size = Vector2(36, 36)
	player.color = Color(0.3, 0.9, 1.0)
	player.position = Vector2(180, 360)
	add_child(player)
	
	particles = CPUParticles2D.new()
	particles.emitting = true
	particles.amount = 16
	particles.lifetime = 0.4
	particles.direction = Vector2(-1, 0)
	particles.spread = 30
	particles.gravity = Vector2(0, 0)
	particles.initial_velocity_min = 40
	particles.initial_velocity_max = 80
	particles.color = Color(0.4, 0.8, 1.0, 0.6)
	player.add_child(particles)
	
	var label = Label.new()
	label.name = "ScoreLabel"
	label.position = Vector2(20, 20)
	label.add_theme_font_size_override("font_size", 36)
	add_child(label)
	
	var timer = Timer.new()
	timer.wait_time = 1.1
	timer.timeout.connect(_spawn_obstacle)
	add_child(timer)
	timer.start()

func _process(delta: float) -> void:
	if game_over: return
	var rising = Input.is_action_pressed("ui_accept") or Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT)
	if rising:
		player.position.y -= speed * delta * 1.6
		particles.emitting = true
	else:
		player.position.y += speed * delta * 0.55
		particles.emitting = false
	player.position.y = clamp(player.position.y, 30, 670)
	
	for obs in obstacles:
		obs.position.x -= speed * delta
		if obs.position.x < -40:
			obs.queue_free()
			obstacles.erase(obs)
			score += 1
			_flash()
		elif player.get_rect().intersects(obs.get_rect()):
			_game_over()
	$ScoreLabel.text = "Score: %d" % score

func _spawn_obstacle() -> void:
	if game_over: return
	var obs = ColorRect.new()
	obs.size = Vector2(28, randf_range(70, 160))
	obs.color = Color(1.0, 0.25, 0.35)
	obs.position = Vector2(1260, randf_range(40, 520))
	add_child(obs)
	obstacles.append(obs)

func _flash() -> void:
	player.modulate = Color(1.5, 1.5, 1.5)
	await get_tree().create_timer(0.08).timeout
	if is_instance_valid(player):
		player.modulate = Color(1, 1, 1)

func _game_over() -> void:
	game_over = true
	var pd = get_node("/root/PlayerData")
	if pd: pd.add_score("sky_hopper", score)
	var label = Label.new()
	label.text = "Game Over\nScore: %d\nClick to return" % score
	label.position = Vector2(480, 280)
	label.add_theme_font_size_override("font_size", 40)
	add_child(label)

func _input(event: InputEvent) -> void:
	if game_over and event is InputEventMouseButton and event.pressed:
		get_tree().change_scene_to_file("res://scenes/hub.tscn")
