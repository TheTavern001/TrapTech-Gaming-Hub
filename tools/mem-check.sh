#!/usr/bin/env bash
# v7 Phase 9: peak RSS under a mixed burst, with the production node flags. Usage: tools/mem-check.sh [db-path]
set -e; cd "$(dirname "$0")/.."; DB=${1:-/tmp/memcheck/hub.db}; PORT=${PORT:-8797}
if [ ! -f "$DB" ]; then mkdir -p "$(dirname "$DB")"; fi
export NODE_ENV=production DB_PATH="$DB" PORT ADMIN_PASSWORD=${ADMIN_PASSWORD:-memcheck-pass-123} SECRET=${SECRET:-memcheckmemcheckmemcheck00} BTC_ADDRESS=32Y22JCbcemRzTV661yqYzG1PU6tnoE2rB PAY_NO_SWEEP=1
node --max-old-space-size=64 --max-semi-space-size=1 src/server.js >/tmp/memcheck.log 2>&1 & PID=$!
trap 'kill $PID 2>/dev/null' EXIT; for i in $(seq 40); do curl -sf localhost:$PORT/healthz >/dev/null && break; sleep 0.25; done
echo "idle after boot: $(grep VmRSS /proc/$PID/status)"
U=$(node -e "const D=require('better-sqlite3');console.log(new D(process.argv[1],{readonly:true}).prepare('SELECT username FROM users LIMIT 40').all().map(r=>r.username).join(' '))" "$DB")
paths="/ /games /leaderboard /giveaways /store /prestige /about /api/games /api/shop /api/store /api/leaderboard?period=all /api/giveaways /og/home.png"
for g in $(node -e "console.log(require('./src/config').GAMES.map(g=>g.id).join(' '))"); do paths="$paths /api/leaderboard/$g /play/$g /og/game/$g.png"; done
for u in $U; do paths="$paths /avatar/$u.svg /api/users/$u /api/users/$u/prestige"; done
for round in 1 2 3; do printf "%s\n" $paths | xargs -P 24 -I{} curl -s -o /dev/null "localhost:$PORT{}"; done
echo "after 3 parallel rounds of $(echo $paths | wc -w) requests: $(grep -E 'VmRSS|VmHWM' /proc/$PID/status | tr -s ' \n' ' ')"
HWM=$(awk '/VmHWM/{print int($2/1024)}' /proc/$PID/status); echo "PEAK_RSS_MB=$HWM (budget 100)"; [ "$HWM" -lt 100 ]
