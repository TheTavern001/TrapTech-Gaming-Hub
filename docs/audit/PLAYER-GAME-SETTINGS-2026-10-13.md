Device-level settings and in-game visual/audio overrides implemented across shared Kit and 13 core-game shells. Pauses active play, preserves previously paused state, avoids emitting scoreboard events. All settings local and subject to Android/desktop tests. Source changes are not a game graphics/AAA certification; the 500-title target, 3D avatar, shop and achievement redesign remain open.

## Licensed engine exceptions
Catalog source verified: 77/80 library titles are Kit-driven, with independent MIT 2048, GPL-3.0 Hextris, and Chromium T-Rex clients as the remaining three. All have the shared settings entry; unsupported settings (fixed-resolution rendering or absent sound) are hidden rather than pretending to work. Real native pause/stop or puzzle-movement guards prevent live scoring while the settings panel is open. Await actual phone-level testing and source-license compliance review.

## Pause-safe title/restart regression
The main Kit loop previously allowed a pending title-screen/restart tap to begin an actual run behind the settings dialog. New `gameSettingsOpen` guard blocks title/restart transitions, clears pointer/key/button input states, suppresses settings-overlay game input telemetry and restores prior pause state on dismissal. No normal game difficulty, scoring, RNG or paid cosmetics were altered. Requires actual mobile browser QA before claiming pass.
