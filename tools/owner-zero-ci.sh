#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
node -e "const major=+process.versions.node.split('.')[0]; if(major<20){console.error('Node.js 20+ is required');process.exit(1)}"
if [[ ! -d node_modules ]]; then echo "Missing node_modules; run npm ci first." >&2; exit 2; fi
echo "[1/3] Syntax-checking server/tool JavaScript..."
for f in src/*.js src/admin*.js tools/*.js public/games-lib/*.js; do
  [[ -f "$f" ]] || continue
  node --check "$f"
done
echo "[1/3] Syntax-checking browser ES modules..."
for f in public/js/*.js src/admin-ui/*.js; do
  [[ -f "$f" ]] || continue
  node --input-type=module --check < "$f"
done
echo "Syntax checks passed."
echo "[2/3] Testing premium cosmetic progression / no competitive advantage..."
node tools/e2e-cosmetic-economy.js
echo "[3/3] Running disposable API/browser suites..."
echo "Now exercising disposable API/browser suites; each suite gets a fresh test DB."
for suite in \
  tools/e2e-api.js \
  tools/e2e-sponsor-brands.js \
  tools/e2e-avatars.js \
  tools/e2e-games-lib.js \
  tools/e2e-hub-library.js \
  tools/e2e-browser.js; do
  echo "=== $suite ==="
  bash tools/fresh-api.sh "$suite"
done
echo "All local suites passed."
