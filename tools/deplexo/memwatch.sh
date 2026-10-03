#!/usr/bin/env bash
# Sample a PID every 250 ms: '<epoch> <VmRSS kB> <VmHWM kB> <RssAnon kB>' lines.
# Usage: tools/deplexo/memwatch.sh <pid> <outfile>
pid=$1; out=${2:-/tmp/memwatch.log}; : > "$out"
while kill -0 "$pid" 2>/dev/null; do
  rss=$(awk '/VmRSS/{print $2}' /proc/$pid/status 2>/dev/null); hwm=$(awk '/VmHWM/{print $2}' /proc/$pid/status 2>/dev/null); anon=$(awk '/RssAnon/{print $2}' /proc/$pid/status 2>/dev/null)
  echo "$(date +%s.%N | cut -c1-14) $rss $hwm $anon" >> "$out"; sleep 0.25
done
