import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const { routerId } = await req.json();

    if (!routerId) {
        return NextResponse.json({ error: 'routerId required' }, { status: 400 });
    }

    const device = await prisma.routerDevice.findUnique({
        where: { id: routerId },
        include: { sshCredential: true },
    });

    if (!device) {
        return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    const results = {
        snmp: { ok: false, message: 'Not tested' },
        cli: { ok: false, message: 'Not tested' },
    };

    // --- Test SNMP ---
    if (device.snmpCommunity) {
        try {
            const snmp = require('net-snmp');
            const session = snmp.createSession(device.ipAddress, device.snmpCommunity, {
                version: device.snmpVersion === 'v3' ? snmp.Version3 : snmp.Version2c,
                timeout: 3000,
                retries: 1,
                port: device.snmpPort,
            });

            await new Promise<void>((resolve) => {
                // OID: sysDescr.0 — simple reachability test
                session.get(['1.3.6.1.2.1.1.1.0'], (error: any, varbinds: any) => {
                    if (error) {
                        results.snmp = { ok: false, message: error.message };
                    } else {
                        const val = varbinds[0]?.value?.toString() || 'OK';
                        results.snmp = { ok: true, message: val.substring(0, 80) };
                    }
                    session.close();
                    resolve();
                });
            });
        } catch (e: any) {
            results.snmp = { ok: false, message: `SNMP error: ${e.message}` };
        }
    } else {
        results.snmp = { ok: false, message: 'No SNMP community configured' };
    }

    // --- Test CLI (SSH/Telnet) ---
    if (device.sshCredential) {
        try {
            const { createCliPoller } = require('@/lib/pollers/cli');
            const cli = createCliPoller(device.ipAddress, device.sshCredential, device.pollMethod);
            
            // exec('') or exec('\r\n') just to trigger the auth handshake
            // but actually createCliPoller's exec connects first
            await cli.exec(' '); 
            results.cli = { ok: true, message: 'CLI connection successful' };
        } catch (e: any) {
            results.cli = { ok: false, message: `CLI error: ${e.message}` };
        }
    } else {
        results.cli = { ok: false, message: 'No CLI credentials configured' };
    }

    return NextResponse.json(results);
}
