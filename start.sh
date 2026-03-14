#!/bin/sh

# Push Prisma schema to database (creates/updates tables)
echo "Running Prisma DB Push..."
prisma db push --accept-data-loss


# Start the background worker script via tsx in the background
echo "Starting BGP Background Sync Worker..."
NODE_PATH=/app/worker_deps/node_modules tsx src/worker/index.ts &

# Start the Next.js standalone server
echo "Starting Next.js App..."
node server.js
