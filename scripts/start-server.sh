#!/usr/bin/env bash
# Starts the hub server in the background with auto-restart on crash.
cd "$(dirname "$0")/.."
if [ -f logs/server.pid ] && kill -0 "$(cat logs/server.pid)" 2>/dev/null; then echo "server already running (pid $(cat logs/server.pid))"; exit 0; fi
nohup bash -c 'while true; do node src/server.js; echo "[$(date)] server exited ($?), restarting in 2s"; sleep 2; done' >> logs/server.log 2>&1 &
echo $! > logs/server.pid
echo "server supervisor started (pid $!), log: logs/server.log"
