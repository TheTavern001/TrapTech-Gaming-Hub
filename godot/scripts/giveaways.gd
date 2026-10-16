extends Control

@onready var info: Label = $VBox/Info
@onready var list: VBoxContainer = $VBox/List
@onready var back: Button = $VBox/Back

var giveaways = [
	{"title": "Weekly Cosmetic Drop", "cost": 100},
	{"title": "Season Pass Boost", "cost": 250},
	{"title": "Exclusive Avatar", "cost": 400}
]

func _ready() -> void:
	back.pressed.connect(_on_back)
	_refresh()

func _refresh() -> void:
	var pd = get_node("/root/PlayerData") if has_node("/root/PlayerData") else null
	if pd:
		info.text = "Your XP: %d | Booked: %d" % [pd.season_xp, pd.giveaway_bookings.size()]
	for g in giveaways:
		var btn = Button.new()
		btn.text = g.title + " \u2014 %d XP" % g.cost
		btn.pressed.connect(_book.bind(g))
		list.add_child(btn)

func _book(g: Dictionary) -> void:
	var pd = get_node("/root/PlayerData")
	if pd and pd.book_giveaway(g.title, g.cost):
		_refresh()
	else:
		info.text = "Not enough XP"

func _on_back() -> void:
	get_tree().change_scene_to_file("res://scenes/hub.tscn")
