import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Clearing old data from BgpCurrentState...');
    await prisma.bgpCurrentState.deleteMany({});

    console.log('Clearing old data from HistoricalEvent...');
    await prisma.historicalEvent.deleteMany({});

    console.log('Database successfully wiped of old/mock data.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
