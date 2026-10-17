# Lightweight image for Deplexo free tier.
# Serves the games catalog at the normal root URL.
FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8787 DATA_DIR=/data
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY src ./src
COPY public ./public
EXPOSE 8787
CMD ["node", "src/start-with-external.js"]
# clean deploy
