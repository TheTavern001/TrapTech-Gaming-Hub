#!/usr/bin/env bash
# Run the server inside a cgroup v2 slice that mimics Deplexo's free plan: 128 MB RAM (no swap), 0.25 CPU.
# Usage: DATA_DIR=/tmp/hub-opt PORT=8802 tools/deplexo/run-capped.sh [node flags...]   (needs sudo + cgroup v2)
# Env: APP_DIR (app root to run, default this repo), CG (cgroup name, default deplexo-sim), MEM (default 128M), CPU_QUOTA (default "25000 100000" = 0.25 CPU)
set -euo pipefail
CG=${CG:-deplexo-sim}; MEM=${MEM:-128M}; CPU_QUOTA=${CPU_QUOTA:-"25000 100000"}
D=/sys/fs/cgroup/$CG
sudo rmdir "$D" 2>/dev/null || true  # fresh cgroup per run so memory.peak / memory.events start at zero
sudo mkdir -p "$D"
echo "$MEM" | sudo tee "$D/memory.max" >/dev/null
echo 0 | sudo tee "$D/memory.swap.max" >/dev/null
echo "$CPU_QUOTA" | sudo tee "$D/cpu.max" >/dev/null
echo "cgroup $D: memory.max=$(cat $D/memory.max) cpu.max=$(cat $D/cpu.max)" >&2
cd "${APP_DIR:-$(dirname "$0")/../..}"
exec sudo --preserve-env=PATH bash -c 'echo $$ > '"$D"'/cgroup.procs; exec /usr/sbin/runuser -u '"$(id -un)"' -- env NODE_ENV=production PORT='"${PORT:-8802}"' DATA_DIR='"${DATA_DIR:-/tmp/hub-opt}"' BUILD_DIR='"${BUILD_DIR:-}"' MALLOC_ARENA_MAX=2 UV_THREADPOOL_SIZE=2 '"${EXTRA_ENV:-}"' node "$@" src/server.js' _ "$@"
