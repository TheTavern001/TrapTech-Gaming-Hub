#!/bin/sh
# Commit Games Library paths + hook lines only, using a private index so other workers' staged/unstaged edits are untouched.
# Usage: tools/games-lib-commit.sh "message"
set -e
cd "$(dirname "$0")/.."
MINE="public/games-lib src/games-lib.js tools/e2e-games-lib.js tools/games-lib-build.js tools/games-lib-research.json tools/games-lib-next.md tools/games-lib-hooks.py tools/games-lib-commit.sh docs/GAMES-LIB.md"
export GIT_INDEX_FILE="$(mktemp -u /tmp/glidx.XXXX)"
git read-tree HEAD
git add -- $MINE
python3 tools/games-lib-hooks.py --stage >/dev/null
git commit -q -m "$1"
rm -f "$GIT_INDEX_FILE"; unset GIT_INDEX_FILE
# sync the real index for our own paths; for shared files add only the hook lines on top of whatever is staged there
git reset -q -- $MINE 2>/dev/null || true
python3 tools/games-lib-hooks.py --stage >/dev/null
git log --oneline -1
