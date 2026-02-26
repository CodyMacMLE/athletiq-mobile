#!/bin/sh
set -e

echo "Running database schema push..."
npx prisma db push --accept-data-loss

echo "Starting server..."
exec node dist/index.js
