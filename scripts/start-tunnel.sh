#!/usr/bin/env bash
# Starts a Cloudflare quick tunnel to the local server. The URL changes every time this restarts.
cd "$(dirname "$0")/.."
PORT=$(grep -E '^PORT=' .env | cut -d= -f2); PORT=${PORT:-8787}
if [ -f logs/tunnel.pid ] && kill -0 "$(cat logs/tunnel.pid)" 2>/dev/null; then echo "tunnel already running (pid $(cat logs/tunnel.pid))"; grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' logs/tunnel.log | tail -1; exit 0; fi
: > logs/tunnel.log
nohup cloudflared tunnel --no-autoupdate --protocol http2 --url "http://localhost:$PORT" >> logs/tunnel.log 2>&1 &
echo $! > logs/tunnel.pid
for i in $(seq 1 40); do URL=$(grep -o "https://[a-z0-9-]*\.trycloudflare\.com" logs/tunnel.log | tail -1); grep -q "Registered tunnel connection" logs/tunnel.log && [ -n "$URL" ] && break; sleep 1; done
echo "${URL:-tunnel URL not found yet - check logs/tunnel.log}" | tee logs/public-url.txt
