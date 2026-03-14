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
        ssh: { ok: false, message: 'Not tested' },
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

    // --- Test SSH ---
    if (device.sshCredential) {
        try {
            const { Client } = require('ssh2');
            const conn = new Client();

            await new Promise<void>((resolve) => {
                const timeout = setTimeout(() => {
                    conn.end();
                    results.ssh = { ok: false, message: 'SSH connection timed out (5s)' };
                    resolve();
                }, 5000);

                conn.on('ready', () => {
                    clearTimeout(timeout);
                    results.ssh = { ok: true, message: 'SSH connection successful' };
                    conn.end();
                    resolve();
                }).on('error', (err: any) => {
                    clearTimeout(timeout);
                    results.ssh = { ok: false, message: err.message };
                    resolve();
                }).connect({
                    host: device.ipAddress,
                    port: device.sshCredential!.sshPort,
                    username: device.sshCredential!.sshUser,
                    password: device.sshCredential!.sshPass,
                    readyTimeout: 5000,
                });
            });
        } catch (e: any) {
            results.ssh = { ok: false, message: `SSH error: ${e.message}` };
        }
    } else {
        results.ssh = { ok: false, message: 'No SSH credentials configured' };
    }

    return NextResponse.json(results);
}
