import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
    const router = await p.routerDevice.findFirst({
        where: { hostname: { contains: 'CoreJujung' } }
    });
    
    if (!router) return console.log('Router not found.');

    const backups = await p.deviceConfigBackup.findMany({
        where: { deviceId: router.id },
        orderBy: { createdAt: 'desc' },
        take: 3
    });

    console.log(`Found ${backups.length} backups for ${router.hostname}`);
    backups.forEach((b, i) => {
        console.log(`\n\n=== BACKUP ${i} (${b.createdAt}) ===`);
        console.log(b.configText.substring(0, 300) + '...');
    });
}

main().finally(() => p.$disconnect());
