# Season rollover compatibility and user-protected migration (draft branch)
Date: 2026-10-13. Current deployed season (Season 1) runs October 1 through November 25, 2026, **56 days**, unchanged. New seasons beginning with Season 2 default to **42 days**, meeting the 4–6-week owner brief without truncating player-earned cosmetics, season XP, current leaderboard, winner archive, account saves, special titles or season overrides. This source change does not rewrite SQLite tables.

Source `src/seasons.js` distinguishes `LEGACY_FIRST_SEASON_DAYS=56` from `LEN_DAYS=42`; info/seasonAt remain contiguous, admin override ends retain priority. Returned `length_days` uses the actual current season length; `standard_future_length_days` communicates the future policy. This preserves original Season 1 promises instead of silently shortening them.

`tools/test-season-future-calendar.js` verifies Oct 13 remains Season 1, all rollover boundaries are contiguous, Season 2 and 3 last 42 days, and a manual Season 2 end-date override is respected. The test cannot prove actual production player XP/database backups; a staging duplicate database and private-device regression remain required before integration.

This draft is isolated from the Deplexo auto-deploy branch until the `9f9a03d` game-source audit's READY status is known. Does not implement 3D cosmetics, premium pass offers or finished public launch.
