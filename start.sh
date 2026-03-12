#!/bin/sh

# Push Prisma schema to database (assuming connection URL is provided via ENV)
# For production, deploy migrations instead of push, but push is simpler
echo "Running Prisma DB Push..."
mkdir -p /app/data
chmod 777 /app/data
npx prisma db push --accept-data-loss

# Start the background worker script via tsx in the background
echo "Starting LibreNMS Background Sync Worker..."
tsx src/worker/index.ts &

# Start the Next.js standalone server
echo "Starting Next.js App..."
node server.js
