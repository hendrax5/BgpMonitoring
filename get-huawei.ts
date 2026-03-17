import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.routerDevice.findFirst({
    where: { hostname: { contains: 'CoreJujung' } },
    include: { sshCredential: true }
}).then(d => {
    console.log(d?.ipAddress);
    console.log(d?.sshCredential?.sshUser);
    console.log(d?.sshCredential?.sshPass);
}).finally(() => p.$disconnect());
