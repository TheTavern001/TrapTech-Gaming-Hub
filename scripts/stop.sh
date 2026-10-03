#!/usr/bin/env bash
# Usage: scripts/stop.sh [server|tunnel]   (no argument = both)
cd "$(dirname "$0")/.."
for n in ${1:-server tunnel}; do
  if [ -f logs/$n.pid ]; then P=$(cat logs/$n.pid); pkill -P "$P" 2>/dev/null; kill "$P" 2>/dev/null && echo "stopped $n ($P)"; rm -f logs/$n.pid; else echo "$n not running (no pid file)"; fi
done
