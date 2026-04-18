#!/bin/sh
set -eu

LOCKFILE_HASH="$(sha256sum package-lock.json | awk '{print $1}')"
INSTALLED_HASH_FILE="node_modules/.package-lock.hash"

if [ ! -d node_modules ] || [ ! -f "$INSTALLED_HASH_FILE" ] || [ "$(cat "$INSTALLED_HASH_FILE")" != "$LOCKFILE_HASH" ]; then
  npm ci
  printf "%s" "$LOCKFILE_HASH" > "$INSTALLED_HASH_FILE"
fi

npm run db:migrate
exec npm run dev
