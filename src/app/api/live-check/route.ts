import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'ssh2';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type CheckType = 'bgp-status' | 'received-routes' | 'advertised-routes' | 'ping' | 'logs';

function getCommand(vendor: string, checkType: CheckType, peerIp: string): string {
    const cmds: Record<string, Record<CheckType, string>> = {
        cisco: {
            'bgp-status':        `show bgp neighbors ${peerIp}`,
            'received-routes':   `show bgp neighbors ${peerIp} received-routes`,
            'advertised-routes': `show bgp neighbors ${peerIp} advertised-routes`,
            'ping':              `ping ${peerIp} repeat 5 timeout 3`,
            'logs':              `show logging | include ${peerIp}`,
        },
        juniper: {
            'bgp-status':        `show bgp neighbor ${peerIp}`,
            'received-routes':   `show route receive-protocol bgp ${peerIp}`,
            'advertised-routes': `show route advertising-protocol bgp ${peerIp}`,
            'ping':              `ping ${peerIp} count 5 rapid`,
            'logs':              `show log messages | match ${peerIp}`,
        },
        huawei: {
            'bgp-status':        `display bgp peer ${peerIp} verbose`,
            'received-routes':   `display bgp routing-table peer ${peerIp} received-routes`,
            'advertised-routes': `display bgp routing-table peer ${peerIp} advertised-routes`,
            'ping':              `ping -c 5 -t 3 ${peerIp}`,
            'logs':              `display logbuffer | include ${peerIp}`,
        },
        mikrotik: {
            'bgp-status':        `/routing/bgp/session/print where remote.address="${peerIp}"`,
            'received-routes':   `/ip/route/print where bgp=yes gateway="${peerIp}"`,
            'advertised-routes': `/routing/bgp/advertisements/print peer="${peerIp}"`,
            'ping':              `/ping ${peerIp} count=5`,
            'logs':              `/log print where message~"${peerIp}"`,
        },
        arista: {
            'bgp-status':        `show bgp neighbors ${peerIp}`,
            'received-routes':   `show bgp neighbors ${peerIp} received-routes`,
            'advertised-routes': `show bgp neighbors ${peerIp} advertised-routes`,
            'ping':              `ping ${peerIp} repeat 5`,
            'logs':              `show logging | include ${peerIp}`,
        },
    };
    return cmds[vendor]?.[checkType] ?? `show bgp neighbors ${peerIp}`;
}

export async function POST(req: NextRequest) {
    const { deviceIp, peerIp, checkType = 'bgp-status' } = await req.json();

    if (!deviceIp || !peerIp) {
        return NextResponse.json({ error: 'deviceIp and peerIp are required' }, { status: 400 });
    }

    const cred = await prisma.deviceCredential.findUnique({ where: { deviceIp } });

    if (!cred) {
        return NextResponse.json({
            error: `No SSH credentials configured for ${deviceIp}. Please add them in Settings → Device SSH Credentials.`,
            noCredentials: true
        }, { status: 400 });
    }

    return new Promise<NextResponse>((resolve) => {
        const conn = new Client();
        let output = '';
        const command = getCommand(cred.vendor, checkType as CheckType, peerIp);

        const timeout = setTimeout(() => {
            conn.end();
            resolve(NextResponse.json({ error: 'SSH connection timed out after 20s' }, { status: 504 }));
        }, 20000);

        conn.on('ready', () => {
            conn.exec(command, (err, stream) => {
                if (err) {
                    clearTimeout(timeout);
                    conn.end();
                    resolve(NextResponse.json({ error: err.message }, { status: 500 }));
                    return;
                }
                stream.on('data', (data: Buffer) => { output += data.toString(); });
                stream.stderr.on('data', (data: Buffer) => { output += data.toString(); });
                stream.on('close', () => {
                    clearTimeout(timeout);
                    conn.end();
                    resolve(NextResponse.json({ output: output.trim(), command, vendor: cred.vendor }));
                });
            });
        }).on('error', (err) => {
            clearTimeout(timeout);
            resolve(NextResponse.json({ error: `SSH Error: ${err.message}` }, { status: 500 }));
        }).connect({
            host: deviceIp,
            port: cred.sshPort,
            username: cred.sshUser,
            password: cred.sshPass,
            readyTimeout: 10000,
        });
    });
}
