#!/usr/bin/env python3
# Games Library: apply ONLY the marked [games-lib hook] lines to shared files and stage them, without staging other
# workers' uncommitted edits in the same files. --stage: stage HEAD+hooks into the index; --work: ensure hooks in the working tree.
import subprocess, sys
HOOKS = {
 'src/config.js': [
  ("module.exports = {\n  ROOT,", "// [games-lib hook] library games (src/games-lib.js) join run/score/leaderboard lookups only, not the core catalog list\nconst LIB_GAMES = require('./games-lib').games;\n\nmodule.exports = {\n  ROOT,"),
  ("GAME_MAP: Object.fromEntries(GAMES.map(g => [g.id, g])),", "GAME_MAP: Object.fromEntries([...GAMES, ...LIB_GAMES].map(g => [g.id, g])), LIB_GAMES, // [games-lib hook]"),
  ("giveawayEligible: (id) => !!(GAMES.find(g => g.id === id) || {}).giveaway,", "giveawayEligible: (id) => !!([...GAMES, ...LIB_GAMES].find(g => g.id === id) || {}).giveaway, // [games-lib hook]"),
  ("gameInfo: (id) => GAMES.find(g => g.id === id) || RETIRED.find(g => g.id === id) || null,", "gameInfo: (id) => GAMES.find(g => g.id === id) || RETIRED.find(g => g.id === id) || LIB_GAMES.find(g => g.id === id) || null, // [games-lib hook]")],
 'src/server.js': [("app.use('/api', (req, res) => bad(res, 404, 'Not found'));", "require('./games-lib').mount(app); // [games-lib hook] GET /api/games-lib\napp.use('/api', (req, res) => bad(res, 404, 'Not found'));")],
 'src/results.js': [("[...cfg.GAMES, ...cfg.RETIRED].map(x =>", "[...cfg.GAMES, ...cfg.RETIRED, ...(cfg.LIB_GAMES || [])].map(x => /* [games-lib hook] */")],
 'public/js/app.js': [("${S.games.length} playable</span></h1>", "${S.games.length} playable</span></h1><a class=\"btn sm\" style=\"margin:-6px 0 12px\" href=\"/games-lib/index.html\">Games Library: 150+ more games</a><!-- [games-lib hook] -->")],
}
def apply(s, f):
  for old, new in HOOKS[f]:
    if new in s: continue
    if s.count(old) != 1: sys.exit(f'hook anchor not found once in {f}: {old[:60]}')
    s = s.replace(old, new, 1)
  return s
mode = sys.argv[1] if len(sys.argv) > 1 else '--work'
for f in HOOKS:
  if mode == '--work':
    s = open(f).read(); t = apply(s, f)
    if t != s: open(f, 'w').write(t); print('hooked', f)
  else:
    head = subprocess.run(['git', 'show', 'HEAD:' + f], capture_output=True, text=True, check=True).stdout
    idx = subprocess.run(['git', 'show', ':' + f], capture_output=True, text=True, check=True).stdout
    base = idx  # keep anything another worker already staged in this file; only add the hook lines
    t = apply(base, f)
    h = subprocess.run(['git', 'hash-object', '-w', '--stdin'], input=t, capture_output=True, text=True, check=True).stdout.strip()
    mode_ = subprocess.run(['git', 'ls-files', '-s', f], capture_output=True, text=True).stdout.split()[0] if subprocess.run(['git', 'ls-files', '-s', f], capture_output=True, text=True).stdout else '100644'
    subprocess.run(['git', 'update-index', '--cacheinfo', f'{mode_},{h},{f}'], check=True); print('staged hooks only:', f)
