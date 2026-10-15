# The Gaming Hub - container image tuned for small hosts (Deplexo free plan: 128 MB RAM, 0.25 CPU,
# read-only root filesystem, unprivileged user, persistent noexec volume at /data, small noexec /tmp).
# See DEPLOY-DEPLEXO.md. Also works on any Docker host:
#   docker build -t gaming-hub .
#   docker run -d -p 8787:8787 --read-only --tmpfs /tmp -v hubdata:/data \
#     -e ADMIN_PASSWORD='long-random' -e SECRET="$(openssl rand -base64 32)" gaming-hub
# No --platform pin: the image is built for whatever architecture the builder runs on, and npm ci installs the
# matching prebuilt native binaries (better-sqlite3, @resvg/resvg-js). The toolchain is only a fallback.

# ---------- build stage: production deps + build-time assets ----------
FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY src ./src
COPY public ./public
# Build-time audits consume the generated library inventory and supporting audit data.
COPY docs ./docs
COPY scripts/deplexo-prebuild.js ./scripts/deplexo-prebuild.js
# Source-only R1 audit inspects this shell gate; it is not shipped in runtime image.
COPY scripts/offline-release-gate.sh ./scripts/offline-release-gate.sh
COPY tools ./tools
# Audit inspects Dockerfile and .dockerignore; both must exist in build stage.
# These do not enter the final runtime image.
COPY Dockerfile .dockerignore ./
# Replace legacy purple-controller install PNGs with the exact existing gold-crown TT vector.
# The same files are served for PWA manifest, Android adaptive icon and iOS home screen.
RUN node tools/build-traptech-pwa-icons.js && node tools/test-traptech-pwa-icons.js
# Pre-gzip static text assets, pre-scale OG card art, pre-render the default share image (-> /app/build).
# Runs without secrets (env vars are not available at build time on Deplexo).
RUN test -s tools/games-lib-static-check.js \
 && test -s tools/test-endless-buffers.js \
 && test -s tools/verify-prelaunch.js \
 && test -s docs/GAMES-LIB.md \
 && test -s docs/score-ranges.json \
 && echo 'Required prelaunch audit inputs present' \
 && node tools/test-docker-audit-context.js \
 && node tools/test-post-r1-build-evidence.js \
 && node tools/test-r1-incident-gates.js \
 && mkdir -p docs/audit \
 && node --check tools/verify-private-preview-live.js \
 && node --check tools/test-config-secret-preflight.js \
 && node tools/test-config-secret-preflight.js \
 && node --check tools/test-session-revocation.js \
 && node tools/test-session-revocation.js \
 && node --check tools/test-auth-session-live.js \
 && node --check src/unified-wallet.js \
 && node --check tools/test-reviewed-wallet-read.js \
 && node tools/test-reviewed-wallet-read.js \
 && node --check tools/test-unified-wallet.js \
 && node tools/test-unified-wallet.js \
 && node --check tools/test-payment-order-snapshots.js \
 && node tools/test-payment-order-snapshots.js \
 && node --check src/payment-settlement-proof.js \
 && node --check tools/test-payment-settlement-proof.js \
 && node tools/test-payment-settlement-proof.js \
 && node --check tools/test-reward-integrity.js \
 && node tools/test-reward-integrity.js \
 && node --check src/prize-score-proof.js \
 && node --check tools/test-prize-score-proof.js \
 && node tools/test-prize-score-proof.js \
 && node --check src/shop.js \
 && node --check src/shop-gen.js \
 && node --check src/avatars.js \
 && node --check src/rotating-quests.js \
 && node --check src/v3.js \
 && node --check tools/test-rotating-quests.js \
 && node tools/test-rotating-quests.js \
 && test -s tools/test-season-future-calendar.js \
 && node --check tools/test-season-future-calendar.js \
 && node tools/test-season-future-calendar.js \
 && test -s tools/test-avatar-free-face.js \
 && node --check tools/test-avatar-free-face.js \
 && node tools/test-avatar-free-face.js \
 && test -s tools/audit-avatar-renderability.js \
 && node --check tools/test-neutral-avatar-source.js \
 && node tools/test-neutral-avatar-source.js \
 && node tools/test-avatar-current-entitlements.js \
 && node tools/test-avatar-one-credit-wallet.js \
 && node tools/test-avatar-credit-spend-behavior.js \
 && node tools/test-shop-avatar-credit-integration.js \
 && node tools/test-existing-game-review-register.js \
 && node tools/test-private-10k-harness.js \
 && node tools/test-giveaway-booking-release-gates.js \
 && node tools/test-booked-skill-winner-contract.js \
 && node tools/test-booking-library-selection.js \
 && node tools/test-optional-sponsor-channel.js \
 && node tools/test-avatar-async-stale-render.js \
 && node tools/test-avatar-rig-mobile-budget.js \
 && node tools/test-avatar-offscreen-fallback.js \
 && node tools/test-profile-avatar-navigation.js \
 && node tools/test-spa-stale-route.js \
 && node tools/test-game-adapter-start-isolation.js \
 && node tools/test-adapter-proof-snapshot.js \
 && node tools/test-adapter-invalid-score.js \
 && node --check tools/audit-avatar-renderability.js \
 && node tools/audit-avatar-renderability.js \
 && test -s tools/test-avatar-renderability.js \
 && node --check tools/test-avatar-renderability.js \
 && node tools/test-avatar-renderability.js \
 && node --check tools/verify-game-syntax.js \
 && node tools/verify-game-syntax.js \
 && node --check tools/test-endless-buffers.js \
 && node tools/test-endless-buffers.js \
 && node --check tools/games-lib-static-check.js \
 && node tools/games-lib-static-check.js \
 && test -s tools/game-source-mechanics.js \
 && node --check tools/game-source-mechanics.js \
 && node tools/game-source-mechanics.js \
 && test -s tools/test-game-source-mechanics.js \
 && node --check tools/test-game-source-mechanics.js \
 && node tools/test-game-source-mechanics.js \
 && test -s tools/test-vehicle-lab-assets.js \
 && node --check tools/test-vehicle-lab-assets.js \
 && node --check public/games-lib/labs/garage/garage.mjs \
 && node tools/test-vehicle-lab-assets.js \
 && test -s tools/test-player-game-settings.js \
 && node --check tools/test-player-game-settings.js \
 && node tools/test-player-game-settings.js \
 && test -s tools/test-runner-train-assets.js \
 && node --check tools/test-runner-train-assets.js \
 && node tools/test-runner-train-assets.js \
 && node --check tools/test-owner-reported-gameplay.js \
 && node tools/test-owner-reported-gameplay.js \
 && node tools/test-keep-guard-barracks.js \
 && node tools/test-td-keyboard-touch-parity.js \
 && node --check tools/test-cannabis-gameplay-qa.js \
 && node tools/test-cannabis-gameplay-qa.js \
 && node tools/test-arrow-hero-swept-collision.js \
 && node tools/test-arrow-hero-hostile-projectiles.js \
 && node tools/test-arrow-hero-contact-after-move.js \
 && node tools/test-arrow-hero-room-reachability.js \
 && node tools/test-grow-op-timed-difficulty.js \
 && node tools/test-grow-op-wave-catchup.js \
 && node tools/test-grow-op-newborn-pests.js \
 && node tools/test-grow-op-immediate-swat.js \
 && node tools/test-grow-op-expiring-pest.js \
 && node tools/test-grow-op-suspended-tab.js \
 && node tools/test-kit-mobile-lifecycle.js \
 && node tools/test-kit-score-submit-error.js \
 && node tools/test-kit-game-start-error.js \
 && node tools/test-kit-run-serial.js \
 && node tools/test-kit-hidden-start.js \
 && node tools/test-private-preview-readiness.js \
 && node tools/test-private-review-access.js \
 && node tools/test-owner-preview-payment-lock.js \
 && node --check tools/test-owner-gameplay-distinctness.js \
 && node tools/test-owner-gameplay-distinctness.js \
 && node --check tools/test-goo-touch-gesture.js \
 && node tools/test-goo-touch-gesture.js \
 && node --check tools/test-vendor-signed-run-start.js \
 && node tools/test-vendor-signed-run-start.js \
 && node --check tools/test-grow-op-touch-fairness.js \
 && node tools/test-grow-op-touch-fairness.js \
 && node --check tools/test-mobile-frame-allocation-regressions.js \
 && node tools/test-mobile-frame-allocation-regressions.js \
 && node --check tools/test-imported-kenney-cars.js \
 && node tools/test-imported-kenney-cars.js \
 && node --check tools/test-owner-duplicate-retirements.js \
 && node tools/test-owner-duplicate-retirements.js \
 && node --check src/meta-fairness-contract.js \
 && node --check tools/test-full-hub-meta-contract.js \
 && node tools/test-full-hub-meta-contract.js \
 && node --check tools/test-game-candidate-queue.js \
 && node tools/test-game-candidate-queue.js \
 && node --check tools/preflight-manual-release.js \
 && node --check tools/release-status.js \
 && node --check tools/test-deplexo-release-evidence.js \
 && node tools/test-deplexo-release-evidence.js \
 && node --check tools/audit-full-game-mechanics.js \
 && node --check tools/test-audit-game-runtime-paths.js \
 && node tools/test-audit-game-runtime-paths.js \
 && node tools/audit-full-game-mechanics.js \
 && node --check tools/test-87-runtime-source-depth.js \
 && node tools/test-87-runtime-source-depth.js \
 && node --check tools/test-qa-87-browser-contract.js \
 && node tools/test-qa-87-browser-contract.js  && node tools/test-qa-game-batches.js \
 && node tools/test-qa-browser-runtime-integrity.js \
 && node --check tools/qa-frame-pacing.js \
 && node tools/test-qa-frame-pacing.js \
 && test -s docs/audit/ALL-GAME-MECHANICS-SOURCE-LEDGER.json \
 && node --check tools/prelaunch-deep-audit.js \
 && node --check tools/local-imports.js \
 && node --check tools/test-prelaunch-imports.js \
 && node tools/test-prelaunch-imports.js \
 && node --check tools/verify-prelaunch.js \
 && node tools/verify-prelaunch.js \
 && node tools/prelaunch-deep-audit.js \
 && BUILD_DIR=/app/build node scripts/deplexo-prebuild.js \
 && mkdir -p /app/build/audit \
 && cp docs/audit/prelaunch-structural-audit.json /app/build/audit/prelaunch-structural-audit.json \
 && cp docs/audit/game-source-mechanics.json /app/build/audit/game-source-mechanics.json \
 && cp docs/audit/avatar-renderability.json /app/build/audit/avatar-renderability.json \
 && cp docs/audit/ALL-GAME-MECHANICS-SOURCE-LEDGER.json /app/build/audit/ALL-GAME-MECHANICS-SOURCE-LEDGER.json \
 && node -e "require('better-sqlite3')(':memory:').prepare('select 1').get(); require('@resvg/resvg-js'); console.log('native modules OK', process.platform, process.arch)"

# Exercise consistent pre-start backups before any schema migration can touch a live DB.
RUN node tools/test-prestart-db-snapshot.js

# Run the actual server in an isolated, disposable build-time database and verify its HTTP routes.
# This catches startup/runtime/icon/static-file regressions before the image is produced.
RUN set -eu; \
 mkdir -p /tmp/hub-build-smoke; \
 ADMIN_PASSWORD='BuildOnlyPassword-123!' SECRET='BuildOnlySecret-OnlyForSmokeTest-NotProduction-42' DATA_DIR=/tmp/hub-build-smoke PORT=18787 NODE_ENV=production node src/server.js >/tmp/hub-build-smoke.log 2>&1 & \
 server_pid=$!; \
 trap 'kill "$server_pid" 2>/dev/null || true' EXIT; \
 if ! node -e 'const t=Date.now(); (async()=>{while(Date.now()-t<30000){try{const r=await fetch("http://127.0.0.1:18787/healthz");if(r.ok)process.exit(0)}catch{};await new Promise(r=>setTimeout(r,250))}process.exit(1)})()'; then cat /tmp/hub-build-smoke.log; exit 1; fi; \
 set +e; \
 BASE=http://127.0.0.1:18787 BUILD_SMOKE=1 node tools/verify-live-deployment.js > /tmp/hub-build-smoke-verification.log 2>&1; verify_status=$?; \
 set -e; \
 if [ "$verify_status" -ne 0 ]; then echo "LIVE VERIFICATION FAILED (exit $verify_status):"; cat /tmp/hub-build-smoke-verification.log; echo "SERVER LOG:"; cat /tmp/hub-build-smoke.log; exit "$verify_status"; fi; \
 if ! BASE=http://127.0.0.1:18787 BUILD_SMOKE=1 node tools/test-auth-session-live.js >/tmp/hub-build-smoke-auth.log 2>&1; then echo 'LOCAL AUTH REVOCATION HTTP SMOKE FAILED:'; cat /tmp/hub-build-smoke-auth.log; echo 'SERVER LOG:'; cat /tmp/hub-build-smoke.log; exit 1; fi; \
 kill "$server_pid" 2>/dev/null || true; wait "$server_pid" 2>/dev/null || true

# ---------- runtime stage ----------
FROM node:20-bookworm-slim
ENV NODE_ENV=production \
    PORT=8787 \
    DATA_DIR=/data \
    BUILD_DIR=/app/build \
    TMPDIR=/tmp \
    MALLOC_ARENA_MAX=2 \
    UV_THREADPOOL_SIZE=2
WORKDIR /app
COPY --from=build --chown=root:root /app/node_modules ./node_modules
COPY --from=build --chown=root:root /app/build ./build
COPY --chown=root:root package.json ./
COPY --chown=root:root src ./src
COPY --chown=root:root tools/prestart-db-snapshot.js ./tools/prestart-db-snapshot.js
COPY --chown=root:root public ./public
# The shop uses these score ranges to expose legitimate score-gated cosmetics at runtime.
COPY --chown=root:root docs/score-ranges.json ./docs/score-ranges.json
# App files are owned by root and read-only for the runtime user; only /data (volume) and /tmp are written.
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8787
# Lightweight probe (bash /dev/tcp, no second node process, which would cost ~40 MB of RAM).
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD ["bash", "-c", "exec 3<>/dev/tcp/127.0.0.1/${PORT:-8787} && printf 'GET /healthz HTTP/1.0\\r\\nHost: localhost\\r\\n\\r\\n' >&3 && head -n1 <&3 | grep -q ' 200 '"]
# Exec form, no npm (npm writes logs/cache and adds a second process). Heap is capped for a 128 MB container;
# extra flags can be added with NODE_OPTIONS.
CMD ["sh", "-c", "node --max-old-space-size=64 tools/prestart-db-snapshot.js && exec node --max-old-space-size=64 --max-semi-space-size=1 src/server.js"]
