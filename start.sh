#!/bin/sh

# Push Prisma schema to database (creates/updates tables)
echo "Running Prisma DB Push..."
prisma db push --accept-data-loss

# Seed superadmin if SUPERADMIN_USERNAME is set
if [ -n "$SUPERADMIN_USERNAME" ] && [ -n "$SUPERADMIN_PASSWORD" ]; then
    echo "Seeding superadmin user..."
    node -e "
    const { PrismaClient } = require('/app/node_modules/@prisma/client');
    const bcrypt = require('/app/node_modules/bcryptjs');
    const prisma = new PrismaClient();
    async function seed() {
        try {
            // Check if superadmin already exists
            const existing = await prisma.appUser.findFirst({ where: { role: 'superadmin' } });
            if (existing) { console.log('✅ Superadmin already exists, skipping.'); return; }
            // Create platform tenant
            const tenant = await prisma.tenant.upsert({
                where: { slug: 'platform-admin' },
                create: { name: 'Platform Admin', slug: 'platform-admin', plan: 'enterprise' },
                update: {}
            });
            const hash = await bcrypt.hash(process.env.SUPERADMIN_PASSWORD, 12);
            await prisma.appUser.create({
                data: {
                    tenantId: tenant.id,
                    username: process.env.SUPERADMIN_USERNAME,
                    password: hash,
                    role: 'superadmin'
                }
            });
            console.log('✅ Superadmin created: ' + process.env.SUPERADMIN_USERNAME);
        } catch(e) { console.error('⚠️ Superadmin seed error:', e.message); }
        finally { await prisma.\$disconnect(); }
    }
    seed();
    "
fi

# Start the background worker script via tsx in the background
echo "Starting BGP Background Sync Worker..."
NODE_PATH=/app/worker_deps/node_modules tsx src/worker/index.ts &

# Start the Next.js standalone server
echo "Starting Next.js App..."
node server.js
