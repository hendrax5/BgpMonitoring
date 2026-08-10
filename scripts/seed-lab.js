// One-off seed: a lab RouterDevice + SSH credential pointing at the in-pod fake
// router (127.0.0.1:2222), linked to existing BGP peers, plus live Redis sessions
// so Live Match + Drift Alerts are demonstrable.
const { PrismaClient } = require('@prisma/client');
const Redis = require('ioredis');
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

async function main() {
    const tenant = await prisma.tenant.findUnique({ where: { slug: 'platform-admin' } });
    if (!tenant) throw new Error('platform-admin tenant not found');
    const tenantId = tenant.id;

    // SSH credential for the fake router
    const cred = await prisma.deviceCredential.upsert({
        where: { tenantId_deviceIp: { tenantId, deviceIp: '127.0.0.1' } },
        create: { tenantId, deviceIp: '127.0.0.1', sshPort: 2222, sshUser: 'labadmin', sshPass: 'labpass', vendor: 'cisco', notes: 'In-pod lab router' },
        update: { sshPort: 2222, sshUser: 'labadmin', sshPass: 'labpass', vendor: 'cisco' },
    });

    // Lab router device
    const device = await prisma.routerDevice.upsert({
        where: { tenantId_ipAddress: { tenantId, ipAddress: '127.0.0.1' } },
        create: { tenantId, hostname: 'lab-router-01', ipAddress: '127.0.0.1', vendor: 'cisco', pollMethod: 'ssh_only', sshCredentialId: cred.id, isBgpMonitoring: true },
        update: { hostname: 'lab-router-01', vendor: 'cisco', sshCredentialId: cred.id },
    });
    console.log('Lab device id:', device.id);

    // Link existing peers to the lab device
    await prisma.bgpPeer.updateMany({ where: { tenantId }, data: { deviceId: device.id } });

    // Seed Redis live sessions for the two known peer IPs
    const now = new Date().toISOString();
    const sessions = [
        { peerIp: '203.0.113.10', remoteAsn: 64512, bgpState: 'Idle', acceptedPrefixes: 0, advertisedPrefixes: 0 },   // DOWN → drift (enabled)
        { peerIp: '198.51.100.7', remoteAsn: 65100, bgpState: 'Established', acceptedPrefixes: 812, advertisedPrefixes: 25 },
    ];
    for (const s of sessions) {
        const key = `BgpSession:${tenantId}:lab:${device.id}:${s.peerIp}`;
        const data = { ...s, deviceId: device.id, deviceName: 'lab-router-01', serverName: 'lab', stateChangedAt: now, lastUpdated: now };
        await redis.hset(key, 'data', JSON.stringify(data));
        console.log('Seeded live session:', key, s.bgpState);
    }

    await prisma.$disconnect();
    await redis.quit();
    console.log('Seed complete.');
}
main().catch(e => { console.error(e); process.exit(1); });
