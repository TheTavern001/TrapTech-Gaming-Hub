extends Control

@onready var info: Label = $VBox/Info
@onready var grid: GridContainer = $VBox/Grid
@onready var back: Button = $VBox/Back

var cosmetics = [
	{"id": "gold_crown", "name": "Gold Crown", "cost": 0, "owned": true},
	{"id": "neon_frame", "name": "Neon Frame", "cost": 200, "owned": false},
	{"id": "trap_aura", "name": "Trap Aura", "cost": 500, "owned": false}
]

func _ready() -> void:
	back.pressed.connect(_on_back)
	_refresh()

func _refresh() -> void:
	var pd = get_node("/root/PlayerData") if has_node("/root/PlayerData") else null
	if pd:
		info.text = "Season Level: %d | XP: %d" % [pd.season_level, pd.season_xp]
	for c in cosmetics:
		var btn = Button.new()
		var status = "OWNED" if c.owned else "Buy %d XP" % c.cost
		btn.text = c.name + "\n" + status
		btn.custom_minimum_size = Vector2(250, 100)
		if not c.owned:
			btn.pressed.connect(_buy.bind(c))
		grid.add_child(btn)

func _buy(item: Dictionary) -> void:
	var pd = get_node("/root/PlayerData")
	if pd and pd.season_xp >= item.cost:
		pd.season_xp -= item.cost
		pd.owned_cosmetics.append(item.id)
		pd.save_data()
		item.owned = true
		_refresh()

func _on_back() -> void:
	get_tree().change_scene_to_file("res://scenes/hub.tscn")
