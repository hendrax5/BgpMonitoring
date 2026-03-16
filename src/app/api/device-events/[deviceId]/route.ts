import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ deviceId: string }> }
) {
    const { deviceId } = await params;
    const id = parseInt(deviceId);
    const tenantId = req.headers.get('x-tenant-id');
    const userRole = req.headers.get('x-user-role');

    if (!id) return NextResponse.json({ error: 'Invalid deviceId' }, { status: 400 });
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const device = await prisma.routerDevice.findFirst({
        where: { id },
        include: { sshCredential: true },
    });

    if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });

    // Isolasi tenant: pastikan device milik tenant yang sama
    if (userRole !== 'superadmin' && (device as any).tenantId !== tenantId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!device.sshCredential) {
        return NextResponse.json({ error: 'No SSH credentials configured for this device', events: [] }, { status: 200 });
    }

    try {
        // Dynamically load the correct poller
        let poller: any;
        const vendor = device.vendor.toLowerCase();

        if (vendor === 'mikrotik') {
            const { MikrotikPoller } = require('@/lib/pollers/vendors/mikrotik');
            poller = new MikrotikPoller(device);
        } else if (vendor === 'cisco') {
            const { CiscoPoller } = require('@/lib/pollers/vendors/cisco');
            poller = new CiscoPoller(device);
        } else if (vendor === 'danos') {
            const { DanosPoller } = require('@/lib/pollers/vendors/danos');
            poller = new DanosPoller(device);
        } else if (vendor === 'vyos') {
            const { VyosPoller } = require('@/lib/pollers/vendors/vyos');
            poller = new VyosPoller(device);
        } else if (vendor === 'juniper') {
            const { JuniperPoller } = require('@/lib/pollers/vendors/juniper');
            poller = new JuniperPoller(device);
        } else if (vendor === 'huawei') {
            const { HuaweiPoller } = require('@/lib/pollers/vendors/huawei');
            poller = new HuaweiPoller(device);
        } else {
            return NextResponse.json({ error: `Unsupported vendor: ${device.vendor}`, events: [] });
        }

        const liveOutput = await poller.fetchLiveSessions();

        return NextResponse.json({
            deviceName: device.hostname,
            deviceIp: device.ipAddress,
            vendor: device.vendor,
            output: liveOutput,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message, events: [] }, { status: 500 });
    }
}
