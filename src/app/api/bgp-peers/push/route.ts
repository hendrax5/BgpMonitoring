import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'ssh2';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { generateBgpConfig, type BgpPeerConfig } from '@/lib/bgp-config-generator';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MANAGE_ROLES = ['superadmin', 'orgadmin', 'networkengineer'];

/** Wrap the generated config lines with vendor-specific config-mode entry/commit. */
function wrapForApply(vendor: string, lines: string[]): string[] {
    switch (vendor) {
        case 'cisco':
        case 'arista':
            return ['configure terminal', ...lines, 'end', 'write memory'];
        case 'huawei':
            return ['system-view', ...lines, 'return', 'save'];
        case 'juniper':
            return ['configure', ...lines, 'commit and-quit'];
        case 'vyos':
        case 'danos':
            return ['configure', ...lines, 'commit', 'save', 'exit'];
        case 'mikrotik':
            return lines; // RouterOS commands run directly
        default:
            return ['configure terminal', ...lines, 'end'];
    }
}

function toConfig(peer: any): BgpPeerConfig {
    return {
        peerIp: peer.peerIp,
        peerName: peer.peerName,
        remoteAsn: peer.remoteAsn.toString(),
        localAsn: peer.localAsn != null ? peer.localAsn.toString() : null,
        addressFamily: peer.addressFamily,
        prefixLimit: peer.prefixLimit,
        prefixList: peer.prefixList,
        routePolicyIn: peer.routePolicyIn,
        routePolicyOut: peer.routePolicyOut,
        password: peer.password,
        description: peer.description,
        adminStatus: peer.adminStatus,
    };
}

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!MANAGE_ROLES.includes(session.role)) return NextResponse.json({ error: 'Permission denied' }, { status: 403 });

    const { id, dryRun = false } = await req.json();
    if (!id) return NextResponse.json({ error: 'Peer id is required' }, { status: 400 });

    const where: any = session.role === 'superadmin' ? { id } : { id, tenantId: session.tenantId };
    const peer = await (prisma as any).bgpPeer.findFirst({
        where,
        include: { routerDevice: { include: { sshCredential: true } } },
    });

    if (!peer) return NextResponse.json({ error: 'BGP peer not found' }, { status: 404 });

    const device = peer.routerDevice;
    const vendor = (device?.vendor || 'cisco').toLowerCase();

    // Generate config (always available — this is the preview)
    const { lines, text } = generateBgpConfig(vendor, toConfig(peer));

    if (dryRun) {
        return NextResponse.json({
            config: text,
            vendor,
            device: device ? { hostname: device.hostname, ipAddress: device.ipAddress, vendor: device.vendor } : null,
            applyCommands: wrapForApply(vendor, lines),
        });
    }

    // ── Actual push over SSH ──
    if (!device) {
        return NextResponse.json({ error: 'No device attached to this peer. Edit the peer and select an "Attached Device".', noDevice: true }, { status: 400 });
    }
    const cred = device.sshCredential;
    if (!cred) {
        return NextResponse.json({ error: `No SSH credentials configured for ${device.hostname}. Add them in Settings → Device Credentials.`, noCredentials: true }, { status: 400 });
    }

    const applyCommands = wrapForApply(vendor, lines);

    const result = await new Promise<{ ok: boolean; output: string; error?: string }>((resolve) => {
        const conn = new Client();
        let output = '';
        const timeout = setTimeout(() => {
            try { conn.end(); } catch {}
            resolve({ ok: false, output, error: 'SSH session timed out after 25s' });
        }, 25000);

        conn.on('ready', () => {
            conn.shell((err: any, stream: any) => {
                if (err) {
                    clearTimeout(timeout);
                    try { conn.end(); } catch {}
                    resolve({ ok: false, output, error: err.message });
                    return;
                }
                stream.on('data', (d: Buffer) => { output += d.toString(); });
                stream.stderr.on('data', (d: Buffer) => { output += d.toString(); });
                stream.on('close', () => {
                    clearTimeout(timeout);
                    try { conn.end(); } catch {}
                    resolve({ ok: true, output });
                });
                // Send each command; small delay handled by device echo. Close shell at end.
                for (const cmd of applyCommands) stream.write(cmd + '\n');
                setTimeout(() => { try { stream.end('exit\n'); } catch {} }, 4000);
            });
        }).on('error', (e: any) => {
            clearTimeout(timeout);
            resolve({ ok: false, output, error: `SSH Error: ${e.message}` });
        }).connect({
            host: device.ipAddress,
            port: cred.sshPort,
            username: cred.sshUser,
            password: cred.sshPass,
            readyTimeout: 12000,
            hostVerifier: () => true,
        });
    });

    // Record push outcome
    try {
        await (prisma as any).bgpPeer.update({
            where: { id: peer.id },
            data: {
                lastPushedAt: new Date(),
                lastPushStatus: result.ok ? 'success' : 'failed',
                lastPushLog: (result.error ? `ERROR: ${result.error}\n\n` : '') + (result.output || '').slice(0, 8000),
            },
        });
    } catch {}

    if (!result.ok) {
        return NextResponse.json({ error: result.error || 'Push failed', output: result.output, config: text }, { status: 502 });
    }
    return NextResponse.json({ success: true, output: result.output, config: text, vendor });
}
