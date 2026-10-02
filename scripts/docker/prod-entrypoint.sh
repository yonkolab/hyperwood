#!/bin/sh
set -eu

node ./scripts/db-migrate.mjs

exec node ./dist/index.js
