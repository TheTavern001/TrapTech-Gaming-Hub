extends Node2D

var score: int = 0
var tower_height: float = 100.0
var current_width: float = 200.0
var moving_right: bool = true
var speed: float = 180.0
var slab: ColorRect
var base: ColorRect
var game_over: bool = false

func _ready() -> void:
	base = ColorRect.new()
	base.size = Vector2(current_width, 30)
	base.color = Color(0.3, 0.7, 0.4)
	base.position = Vector2(540, 650)
	add_child(base)
	
	slab = ColorRect.new()
	slab.size = Vector2(current_width, 25)
	slab.color = Color(0.9, 0.6, 0.2)
	slab.position = Vector2(100, 200)
	add_child(slab)
	
	var label = Label.new()
	label.name = "ScoreLabel"
	label.position = Vector2(20, 20)
	label.add_theme_font_size_override("font_size", 32)
	add_child(label)

func _process(delta: float) -> void:
	if game_over: return
	if moving_right:
		slab.position.x += speed * delta
		if slab.position.x > 1000: moving_right = false
	else:
		slab.position.x -= speed * delta
		if slab.position.x < 80: moving_right = true
	$ScoreLabel.text = "Score: %d" % score

func _input(event: InputEvent) -> void:
	if game_over and event is InputEventMouseButton and event.pressed:
		get_tree().change_scene_to_file("res://scenes/hub.tscn")
		return
	if event is InputEventMouseButton and event.pressed and not game_over:
		_drop()

func _drop() -> void:
	var overlap = abs(slab.position.x - base.position.x)
	if overlap > current_width * 0.6:
		_game_over()
		return
	current_width *= 0.92
	slab.size.x = current_width
	base.size.x = current_width
	base.position.x = (slab.position.x + base.position.x) / 2.0
	score += 1
	speed += 15
	slab.position.y = 200
	if score > 20: _game_over()

func _game_over() -> void:
	game_over = true
	var pd = get_node("/root/PlayerData")
	if pd: pd.add_score("stack", score)
	var label = Label.new()
	label.text = "Game Over\nScore: %d\nClick to return" % score
	label.position = Vector2(500, 300)
	label.add_theme_font_size_override("font_size", 36)
	add_child(label)
