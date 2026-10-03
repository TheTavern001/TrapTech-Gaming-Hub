# Alternative to the native Render runtime: works on Render (runtime: docker), Fly.io, Railway, any VPS.
#   docker build -t gaming-hub .
#   docker run -d -p 8787:8787 -v hubdata:/data -e ADMIN_PASSWORD='long-random' -e SECRET="$(openssl rand -base64 32)" gaming-hub
FROM node:20-bookworm-slim AS deps
WORKDIR /app
# Toolchain only used if better-sqlite3 has no prebuilt binary for this platform
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-bookworm-slim
ENV NODE_ENV=production PORT=8787 DATA_DIR=/data
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY public ./public
RUN mkdir -p /data && chown -R node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
