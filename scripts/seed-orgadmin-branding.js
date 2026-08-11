// Seed a demo tenant with branding + an orgadmin user (for verifying live tenant branding).
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const LOGO_URL = 'https://static.prod-images.emergentagent.com/jobs/d245d107-83b2-43ae-bd4f-add6c0b1b01e/images/ae639e4fcd30377ad3c3cb0177b43f9d23f55c725c610c311d840007a22fc788.jpeg';

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'mitra-net' },
    create: { name: 'MitraNet', slug: 'mitra-net', plan: 'pro' },
    update: {},
  });

  const branding = {
    company_name: 'MitraNet',
    monitoring_name: 'MitraNet NOC',
    logo_url: LOGO_URL,
    primary_color: '#f97316',
  };
  for (const [key, value] of Object.entries(branding)) {
    await prisma.appSettings.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key } },
      create: { tenantId: tenant.id, key, value },
      update: { value },
    });
  }

  const hash = await bcrypt.hash('orgadmin123', 12);
  await prisma.appUser.upsert({
    where: { tenantId_username: { tenantId: tenant.id, username: 'mitraadmin' } },
    create: { tenantId: tenant.id, username: 'mitraadmin', password: hash, role: 'orgadmin', email: 'admin@mitra.net' },
    update: { password: hash, role: 'orgadmin' },
  });

  console.log('Tenant:', tenant.name, tenant.id);
  console.log('Orgadmin: mitraadmin / orgadmin123');
  console.log('Branding applied:', branding);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
