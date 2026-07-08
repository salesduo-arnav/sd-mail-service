# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev

# Built code + files needed for migrations at container start
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/config ./config
COPY --from=builder /app/.sequelizerc .

# AWS RDS CA bundle for SSL cert validation (prod DB)
RUN apk add --no-cache wget && \
    wget -q https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -O /app/rds-combined-ca-bundle.pem && \
    apk del wget

RUN mkdir -p /app/logs && chown -R node:node /app/logs
USER node
EXPOSE 3000

# Default command = api. Compose / ECS override CMD for worker & scheduler:
#   worker:    ["node", "dist/worker.js"]
#   scheduler: ["node", "dist/scheduler.js"]
# The api command runs pending migrations first (single migrator).
CMD ["npm", "start"]
