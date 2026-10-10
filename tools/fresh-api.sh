#!/usr/bin/env bash
# Run an e2e suite against a throwaway server on a fresh DB (port 8799). Usage: tools/fresh-api.sh tools/e2e-api.js [log]
cd "$(dirname "$0")/.."
pkill -f "FRESH_HUB=1" 2>/dev/null; sleep 1; rm -rf /tmp/fresh; mkdir -p /tmp/fresh
[ -n "$SEED" ] && DB_PATH=/tmp/fresh/hub.db node src/demo.js seed >/dev/null 2>&1
FRESH_HUB=1 PORT=8799 DB_PATH=/tmp/fresh/hub.db nohup node src/server.js FRESH_HUB=1 > /tmp/fresh/srv.log 2>&1 &
for i in $(seq 30); do curl -sf localhost:8799/api/games >/dev/null && break; sleep 0.5; done
BASE=http://localhost:8799 DB_PATH=/tmp/fresh/hub.db node "$1"; rc=$?
pkill -f "FRESH_HUB=1"; exit $rc
