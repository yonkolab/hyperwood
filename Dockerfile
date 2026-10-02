# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./

RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY drizzle ./drizzle
COPY scripts/db-migrate.mjs ./scripts/db-migrate.mjs
COPY scripts/docker/prod-entrypoint.sh ./scripts/docker/prod-entrypoint.sh

EXPOSE 3000

CMD ["sh", "./scripts/docker/prod-entrypoint.sh"]
