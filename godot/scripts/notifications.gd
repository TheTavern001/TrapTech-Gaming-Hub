extends Node

var notes = [
	{"text": "Welcome to Trap Tech Hub", "time": "now"},
	{"text": "Season track is active — earn XP", "time": "now"}
]

func add(text: String) -> void:
	notes.insert(0, {"text": text, "time": "now"})
	if notes.size() > 10:
		notes.pop_back()
