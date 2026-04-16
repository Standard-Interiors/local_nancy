FROM node:18-slim

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY src/ ./src/

EXPOSE 3100

HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=30s \
  CMD wget -q --spider http://localhost:3100/health || exit 1

CMD ["node", "src/index.js"]
