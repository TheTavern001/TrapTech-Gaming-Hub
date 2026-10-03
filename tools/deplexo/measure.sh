#!/usr/bin/env bash
# Start a server, wait for idle, run the load test while sampling RSS, print idle/peak numbers.
# Usage: LABEL=opt PORT=8802 DATA_SRC=data/hub.db NODE_FLAGS="--max-old-space-size=64" tools/deplexo/measure.sh
# Env: CAPPED=1 runs it inside the 128 MB / 0.25 CPU cgroup (tools/deplexo/run-capped.sh). USERS, DURATION, OG passed to loadtest.
set -uo pipefail
cd "$(dirname "$0")/../.."
LABEL=${LABEL:-run}; PORT=${PORT:-8802}; D=/tmp/hub-$LABEL; rm -rf "$D"; mkdir -p "$D"
node -e "const D=require('better-sqlite3');new D(process.argv[1],{readonly:true}).backup(process.argv[2]).then(()=>{})" "${DATA_SRC:-data/hub.db}" "$D/hub.db"
if [ "${CAPPED:-0}" = 1 ]; then
  DATA_DIR=$D PORT=$PORT BUILD_DIR=${BUILD_DIR:-} tools/deplexo/run-capped.sh ${NODE_FLAGS:-} > /tmp/$LABEL-server.log 2>&1 &
else
  env NODE_ENV=production PORT=$PORT DATA_DIR=$D BUILD_DIR=${BUILD_DIR:-} MALLOC_ARENA_MAX=2 UV_THREADPOOL_SIZE=2 node ${NODE_FLAGS:-} src/server.js > /tmp/$LABEL-server.log 2>&1 &
fi
for i in $(seq 1 60); do curl -sf localhost:$PORT/healthz >/dev/null && break; sleep 0.5; done
PID=$(pgrep -f "node.*src/server.js" -n -u "$(id -u)" | head -1); for p in $(pgrep -u "$(id -u)" -f "src/server.js"); do grep -q "DATA_DIR=$D" /proc/$p/environ 2>/dev/null && PID=$p; done
sleep 10; idle=$(awk '/VmRSS/{print int($2/1024)}' /proc/$PID/status); idleanon=$(awk '/RssAnon/{print int($2/1024)}' /proc/$PID/status)
tools/deplexo/memwatch.sh $PID /tmp/$LABEL-mem.log & W=$!
BASE=http://127.0.0.1:$PORT node tools/deplexo/loadtest.js > /tmp/$LABEL-load.json
sleep 15
peak=$(awk '/VmHWM/{print int($2/1024)}' /proc/$PID/status); after=$(awk '/VmRSS/{print int($2/1024)}' /proc/$PID/status); afteranon=$(awk '/RssAnon/{print int($2/1024)}' /proc/$PID/status)
kill $W 2>/dev/null; peakanon=$(awk '$4>m{m=$4}END{print int(m/1024)}' /tmp/$LABEL-mem.log)
CG=""; [ "${CAPPED:-0}" = 1 ] && CG=" cgroup_peak_MB=$(( $(cat /sys/fs/cgroup/${CGNAME:-deplexo-sim}/memory.peak 2>/dev/null || echo 0) / 1048576 )) oom_kills=$(awk '/oom_kill /{print $2}' /sys/fs/cgroup/${CGNAME:-deplexo-sim}/memory.events 2>/dev/null)"
echo "[$LABEL] pid=$PID idle_rss_MB=$idle idle_anon_MB=$idleanon peak_rss_MB=$peak peak_anon_MB=$peakanon after_rss_MB=$after after_anon_MB=$afteranon$CG"
python3 -c "import json;d=json.load(open('/tmp/$LABEL-load.json'));print({k:d[k] for k in d if k!='by'});print({k:(v['n'],v['avg_ms'],v['err5xx']) for k,v in d['by'].items()})"
[ "${KEEP:-0}" = 1 ] || kill $PID
