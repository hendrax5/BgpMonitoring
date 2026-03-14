#!/bin/sh

# Push Prisma schema to database
echo "Running Prisma DB Push..."
mkdir -p /app/data
chmod 777 /app/data
prisma db push --accept-data-loss

# Auto-seed default admin user if no users exist
echo "Checking for existing users..."
node -e "
const { PrismaClient } = require('/app/node_modules/@prisma/client');
const bcrypt = require('/app/node_modules/bcryptjs');
const prisma = new PrismaClient({ datasources: { db: { url: 'file:///app/data/bgp_watcher.db' } } });
prisma.appUser.count().then(count => {
  if (count === 0) {
    return bcrypt.hash('password123', 10).then(hash =>
      prisma.appUser.create({ data: { username: 'admin', password: hash } })
    ).then(() => console.log('✅ Default admin user created (username: admin, password: password123)'));
  } else {
    console.log('✅ Users already exist, skipping seed.');
  }
}).catch(e => console.error('⚠️ Seed error:', e.message)).finally(() => prisma.\$disconnect());
"

# Start the background worker script via tsx in the background
echo "Starting BGP Background Sync Worker..."
NODE_PATH=/app/worker_deps/node_modules tsx src/worker/index.ts &

# Start the Next.js standalone server
echo "Starting Next.js App..."
node server.js
