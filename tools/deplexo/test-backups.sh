#!/usr/bin/env bash
# Backup test: local snapshots + rotation, admin endpoints, download, and the GitHub push against tools/deplexo/mock-github.js.
# Usage: BASE=http://127.0.0.1:8811 DATA_DIR=/tmp/hub-x MOCK=http://127.0.0.1:8820 tools/deplexo/test-backups.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
PW=${ADMIN_PASSWORD:-$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)}; J=$(mktemp); trap 'rm -f $J' EXIT
curl -sf -c $J -H 'Content-Type: application/json' -d "{\"password\":\"$PW\"}" $BASE/api/admin/login >/dev/null
for i in 1 2 3 4 5 6 7; do curl -sf -b $J -X POST $BASE/api/admin/backups | python3 -c "import json,sys;d=json.load(sys.stdin);print('backup',d['name'],d['size'],'push',d.get('push'))"; sleep 1.1; done
curl -sf -b $J $BASE/api/admin/backups | python3 -c "import json,sys;d=json.load(sys.stdin);print('local backups kept:',len(d['backups']),'(keep',d['keep'],')');print('og_cache',d['og_cache'])"
curl -sf -b $J -o /tmp/dl.db.gz -D /tmp/dl.h $BASE/api/admin/backups/download; grep -i content-disposition /tmp/dl.h
gunzip -c /tmp/dl.db.gz > /tmp/dl.db && sqlite3 /tmp/dl.db 'PRAGMA integrity_check; SELECT count(*) FROM users;'
code=$(curl -s -o /dev/null -w '%{http_code}' $BASE/api/admin/backups/download); echo "download without admin cookie -> $code"
code=$(curl -s -o /dev/null -w '%{http_code}' -b $J "$BASE/api/admin/backups/download?name=../hub.db"); echo "path traversal name -> $code"
if [ -n "${MOCK:-}" ]; then
  curl -sf $MOCK/_state | python3 -c "
import json,sys,hashlib,os
d=json.load(sys.stdin);print('mock refs',d['refs'],'parents',d['parents'])
for f in d['files']:
  p=os.path.join('$DATA_DIR','backups',os.path.basename(f['path']))
  loc=hashlib.sha256(open(p,'rb').read()).hexdigest() if os.path.exists(p) else None
  print(' ',f['path'],f['size'],'matches local' if loc==f['sha256'] else ('(local rotated away)' if loc is None else 'MISMATCH'))
print('calls',len(d['log']),sorted(set(' '.join(x.split()[:2]) for x in d['log'])))"
fi
