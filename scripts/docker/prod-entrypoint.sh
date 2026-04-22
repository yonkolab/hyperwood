#!/bin/sh
set -eu

npm run db:migrate
npm run build

exec npm run start
