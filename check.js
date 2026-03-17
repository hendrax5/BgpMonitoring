const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://bgpmon:bgpmon_secret@localhost:5432/bgpmon?schema=public'
    }
  }
});

async function main() {
    const devices = await prisma.routerDevice.findMany();
    console.log(JSON.stringify(devices, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
