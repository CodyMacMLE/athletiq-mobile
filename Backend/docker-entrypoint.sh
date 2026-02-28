#!/bin/sh
set -e

# In production, apply versioned migrations safely.
# In development/test, db push is acceptable for fast iteration.
if [ "$NODE_ENV" = "production" ]; then
  echo "Running database migrations (prisma migrate deploy)..."
  npx prisma migrate deploy
else
  echo "Running database schema push (non-production)..."
  npx prisma db push --accept-data-loss
fi

echo "Starting server..."
exec node dist/index.js
