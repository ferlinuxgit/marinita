#!/bin/sh
set -e

if [ "$RUN_MIGRATIONS" = "true" ]; then
  node scripts/migrate.mjs
fi

exec "$@"
