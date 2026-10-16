# Lightweight image for testing the external games catalog only.
# Does not run the heavy prelaunch audits.
FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8787
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY src ./src
EXPOSE 8787
CMD ["node", "src/start-with-external.js"]
