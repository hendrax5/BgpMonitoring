#!/bin/sh

# Wait for PostgreSQL to be ready (handled by docker-compose healthcheck)
echo "Running Prisma Migrate Deploy..."
prisma migrate deploy

if [ $? -ne 0 ]; then
    echo "⚠️ Prisma migrate failed, trying prisma db push..."
    prisma db push --accept-data-loss
fi

# Start the background worker script via tsx in the background
echo "Starting BGP Background Sync Worker..."
NODE_PATH=/app/worker_deps/node_modules tsx src/worker/index.ts &

# Start the Next.js standalone server
echo "Starting Next.js App..."
node server.js
