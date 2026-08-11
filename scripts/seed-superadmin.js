// Idempotent superadmin seed (used by bootstrap).
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
async function main() {
    const existing = await prisma.appUser.findFirst({ where: { role: 'superadmin' } });
    if (existing) { console.log('superadmin exists'); return; }
    const tenant = await prisma.tenant.upsert({
        where: { slug: 'platform-admin' },
        create: { name: 'Platform Admin', slug: 'platform-admin', plan: 'enterprise' },
        update: {},
    });
    const hash = await bcrypt.hash(process.env.SUPERADMIN_PASSWORD || 'admin123', 12);
    await prisma.appUser.create({
        data: { tenantId: tenant.id, username: process.env.SUPERADMIN_USERNAME || 'admin', password: hash, role: 'superadmin' },
    });
    console.log('superadmin created');
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
