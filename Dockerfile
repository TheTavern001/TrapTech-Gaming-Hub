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
COPY scripts/deplexo-prebuild.js ./scripts/deplexo-prebuild.js
COPY tools/prelaunch-deep-audit.js ./tools/prelaunch-deep-audit.js
COPY tools/verify-prelaunch.js ./tools/verify-prelaunch.js
# Pre-gzip static text assets, pre-scale OG card art, pre-render the default share image (-> /app/build).
# Runs without secrets (env vars are not available at build time on Deplexo).
RUN mkdir -p docs/audit \
 && node --check src/shop.js \
 && node --check src/shop-gen.js \
 && node --check src/avatars.js \
 && node --check tools/prelaunch-deep-audit.js \
 && node --check tools/verify-prelaunch.js \
 && node tools/verify-prelaunch.js \
 && (node tools/prelaunch-deep-audit.js || test -f docs/audit/prelaunch-structural-audit.json) \
 && BUILD_DIR=/app/build node scripts/deplexo-prebuild.js \
 && node -e "require('better-sqlite3')(':memory:').prepare('select 1').get(); require('@resvg/resvg-js'); console.log('native modules OK', process.platform, process.arch)"

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
COPY --chown=root:root public ./public
# App files are owned by root and read-only for the runtime user; only /data (volume) and /tmp are written.
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8787
# Lightweight probe (bash /dev/tcp, no second node process, which would cost ~40 MB of RAM).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["bash", "-c", "exec 3<>/dev/tcp/127.0.0.1/${PORT:-8787} && printf 'GET /healthz HTTP/1.0\\r\\nHost: localhost\\r\\n\\r\\n' >&3 && head -n1 <&3 | grep -q ' 200 '"]
# Exec form, no npm (npm writes logs/cache and adds a second process). Heap is capped for a 128 MB container;
# extra flags can be added with NODE_OPTIONS.
CMD ["node", "--max-old-space-size=64", "--max-semi-space-size=1", "src/server.js"]
