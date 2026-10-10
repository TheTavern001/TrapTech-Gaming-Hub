cd /workspace/jetpack-hub
r(){ echo "=== $1"; shift; timeout 2400 "$@" 2>&1 | tail -4; echo "exit=${PIPESTATUS[0]}"; }
r e2e-api tools/fresh-api.sh tools/e2e-api.js
r e2e-anticheat tools/fresh-api.sh tools/e2e-anticheat.js
r e2e-events tools/fresh-api.sh tools/e2e-events.js
r e2e-tiebreak tools/fresh-api.sh tools/e2e-tiebreak.js
r e2e-sponsor-brands env SEED=1 tools/fresh-api.sh tools/e2e-sponsor-brands.js
r e2e-payments env BTC_EXPLORER_URL=http://127.0.0.1:8796 BTC_PRICE_URL=http://127.0.0.1:8796/prices PAY_NO_SWEEP=1 tools/fresh-api.sh tools/e2e-payments.js
r e2e-avatars tools/fresh-api.sh tools/e2e-avatars.js
r e2e-timers node tools/e2e-timers.js
r e2e-economy node tools/e2e-economy.js
r e2e-admin bash -c 'cd tools && E2E_FAST=1 node e2e-admin.js'
r e2e-admin-sec bash -c 'cd tools && node e2e-admin-sec.js'
r e2e-admin-tour bash -c 'cd tools && node e2e-admin-tour.js'
r e2e-games-lib bash -c 'cd tools && BASE=http://localhost:8787 node e2e-games-lib.js'
r e2e-i18n bash -c "cd tools && node e2e-i18n.js"
r e2e-browser env SEED=1 tools/fresh-api.sh tools/e2e-browser.js
r e2e-mobile bash -c 'cd tools && node e2e-mobile.js'
echo ALLDONE
