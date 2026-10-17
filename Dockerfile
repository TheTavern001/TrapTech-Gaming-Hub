# Full hub for Deplexo free tier.
FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8787 DATA_DIR=/data MALLOC_ARENA_MAX=2
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY src ./src
COPY public ./public
EXPOSE 8787
CMD ["node", "--max-old-space-size=64", "src/server.js"]
