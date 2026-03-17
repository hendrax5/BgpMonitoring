const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const router = await prisma.routerDevice.findFirst({ where: { ipAddress: '113.192.29.254' } });
  console.log('RouterDevice:', router);
}
main().finally(() => prisma.$disconnect());
