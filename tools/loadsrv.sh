#!/usr/bin/env bash
# fresh server with Dockerfile limits on :8899 (seeded). prints pid.
cd /workspace/sys; pkill -f "LOADSRV=1" 2>/dev/null; sleep 1; rm -rf /tmp/load; mkdir -p /tmp/load
export NODE_ENV=production DB_PATH=/tmp/load/hub.db PORT=8899 ADMIN_PASSWORD=loadtest-pass-123 SECRET=loadtestloadtestloadtest0000 ADMIN_PATH=loadadminpath0123456789abcd BTC_ADDRESS=32Y22JCbcemRzTV661yqYzG1PU6tnoE2rB PAY_NO_SWEEP=1 MALLOC_ARENA_MAX=2 MALLOC_TRIM_THRESHOLD_=65536 UV_THREADPOOL_SIZE=2 PUBLIC_URL=
[ "$SEED" = 1 ] && DB_PATH=/tmp/load/hub.db node src/demo.js seed >/dev/null 2>&1
nohup node $NODEX --max-old-space-size=72 --max-semi-space-size=1 --single-threaded --no-opt src/server.js LOADSRV=1 > /tmp/load/srv.log 2>&1 &
echo $! > /tmp/load/pid
for i in $(seq 40); do curl -sf localhost:8899/healthz >/dev/null && break; sleep 0.5; done; cat /tmp/load/pid
node -e "const D=require('/workspace/sys/node_modules/better-sqlite3');const d=new D('/tmp/load/hub.db');d.prepare('UPDATE giveaways SET elig_min_runs7=0, elig_min_xp7=0, elig_account_age_days=0, elig_win_cooldown_days=0, elig_brand_month=0, open_to_all=1, audience=\'\' WHERE id=1').run();console.log('giveaway 1 eligibility relaxed for load test')"
