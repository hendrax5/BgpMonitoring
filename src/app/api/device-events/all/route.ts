import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    const userRole = req.headers.get('x-user-role');

    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Isolasi tenant: superadmin lihat semua, user lain hanya tenant sendiri
    const where: any = { sshCredentialId: { not: null } };
    if (userRole !== 'superadmin') where.tenantId = tenantId;

    const devices = await prisma.routerDevice.findMany({
        select: { id: true, hostname: true, ipAddress: true, vendor: true, sshCredential: true },
        where,
    });

    if (devices.length === 0) {
        return NextResponse.json({ events: [], deviceCount: 0 });
    }

    const results = await Promise.allSettled(
        devices.map(async (device) => {
            let poller: any;
            const vendor = device.vendor.toLowerCase();
            if (vendor === 'mikrotik') {
                const { MikrotikPoller } = require('@/lib/pollers/vendors/mikrotik');
                poller = new MikrotikPoller({ ...device, sshCredential: device.sshCredential });
            } else if (vendor === 'cisco') {
                const { CiscoPoller } = require('@/lib/pollers/vendors/cisco');
                poller = new CiscoPoller({ ...device, sshCredential: device.sshCredential });
            } else if (vendor === 'danos') {
                const { DanosPoller } = require('@/lib/pollers/vendors/danos');
                poller = new DanosPoller({ ...device, sshCredential: device.sshCredential });
            } else if (vendor === 'vyos') {
                const { VyosPoller } = require('@/lib/pollers/vendors/vyos');
                poller = new VyosPoller({ ...device, sshCredential: device.sshCredential });
            } else if (vendor === 'juniper') {
                const { JuniperPoller } = require('@/lib/pollers/vendors/juniper');
                poller = new JuniperPoller({ ...device, sshCredential: device.sshCredential });
            } else if (vendor === 'huawei') {
                const { HuaweiPoller } = require('@/lib/pollers/vendors/huawei');
                poller = new HuaweiPoller({ ...device, sshCredential: device.sshCredential });
            } else {
                return [];
            }

            const events = await poller.fetchBgpLog();
            return events.map((e: any) => ({ ...e, deviceName: device.hostname, deviceId: device.id }));
        })
    );

    const allEvents = results
        .filter((r): r is PromiseFulfilledResult<any[]> => r.status === 'fulfilled')
        .flatMap(r => r.value);

    return NextResponse.json({ events: allEvents, deviceCount: devices.length });
}
