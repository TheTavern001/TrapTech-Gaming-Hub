#!/usr/bin/env bash
# Restart only the Node server (the tunnel and its public URL stay the same).
cd "$(dirname "$0")/.."
./scripts/stop.sh server; sleep 1; ./scripts/start-server.sh
