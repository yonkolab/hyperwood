#!/usr/bin/env bash
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-}"
DEPLOY_DIR="${DEPLOY_DIR:-hyperwood}"
IMAGE="hyperwood-api:latest"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE="${ENV_FILE:-.env.prod}"

if [ -z "$DEPLOY_HOST" ]; then
  echo "usage: DEPLOY_HOST=opc@<VM_IP> npm run deploy" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "missing $ENV_FILE — copy .env.example, fill real secrets, and save as $ENV_FILE" >&2
  exit 1
fi

echo ">>> building image"
docker build -t "$IMAGE" .

echo ">>> transferring image to $DEPLOY_HOST"
docker save "$IMAGE" | gzip | ssh "$DEPLOY_HOST" "gunzip | docker load"

echo ">>> syncing config files"
ssh "$DEPLOY_HOST" "mkdir -p '$DEPLOY_DIR'"
scp "$COMPOSE_FILE" Caddyfile "$DEPLOY_HOST:$DEPLOY_DIR/"
scp "$ENV_FILE" "$DEPLOY_HOST:$DEPLOY_DIR/.env"

echo ">>> starting stack"
ssh "$DEPLOY_HOST" "cd '$DEPLOY_DIR' && docker compose -f $COMPOSE_FILE up -d && docker image prune -f"

echo ">>> done. API: https://hyperwood.yonkolab.xyz/api/v1 — health: https://hyperwood.yonkolab.xyz/health"
