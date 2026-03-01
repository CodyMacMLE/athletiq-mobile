#!/bin/sh
set -e

if [ "$NODE_ENV" = "production" ]; then
  echo "Running database migrations (prisma migrate deploy)..."
  # Baseline: mark the initial migration as already applied if it hasn't been
  # tracked yet. This handles databases that were originally created with
  # `prisma db push` and have no _prisma_migrations history.
  # `migrate resolve` is idempotent-safe here — the `|| true` suppresses the
  # error if the migration is already recorded.
  npx prisma migrate resolve --applied 0_init 2>/dev/null || true
  npx prisma migrate deploy
else
  echo "Running database schema push (non-production)..."
  npx prisma db push --accept-data-loss
fi

echo "Starting server..."
exec node dist/index.js
