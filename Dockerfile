# The Gaming Hub - Deplexo Free (128 MB RAM, Dockerfile build, auto-deploys from main).
# Node is pinned to 20 on purpose: Node 24 lifted the default heap to ~260 MB and the container got OOM-killed / crashed.
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8787 DATA_DIR=/data MALLOC_ARENA_MAX=2 UV_THREADPOOL_SIZE=2
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force \
 && apt-get purge -y python3 make g++ && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
COPY src ./src
COPY public ./public
# JSON read at require() time by src/pass-quests.js and src/shop.js (a missing file crashed startup).
COPY docs/pass-quests.json docs/score-ranges.json ./docs/
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8787
# One plain start command. Do not set a custom start command in the Deplexo dashboard (no "npm run start:external", no trailing dots).
CMD ["node", "--max-old-space-size=72", "--max-semi-space-size=1", "--single-threaded", "src/server.js"]
