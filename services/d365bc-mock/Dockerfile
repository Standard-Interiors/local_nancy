FROM node:18-slim

WORKDIR /app

COPY package.json ./
RUN npm install --production --no-audit --no-fund

COPY src ./src

EXPOSE 3200

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -qO- http://localhost:3200/health || exit 1

CMD ["node", "src/index.js"]
