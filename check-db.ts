import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
    console.log("Checking DB...");
    const count = await prisma.bgpCurrentState.count();
    console.log("Total DB BGP Records:", count);
    
    // Group by deviceId
    const devices = await prisma.bgpCurrentState.findMany({
        select: { deviceId: true, deviceName: true },
        distinct: ['deviceId']
    });
    console.log("Distinct Devices:", devices);
    
    const unk = await prisma.bgpCurrentState.count({ where: { deviceName: 'Unknown Device' }});
    console.log("Unknown Devices count:", unk);
}
run().catch(console.error).finally(() => process.exit(0));
