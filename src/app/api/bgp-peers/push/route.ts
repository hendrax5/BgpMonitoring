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
            return lines;
        default:
            return ['configure terminal', ...lines, 'end'];
    }
}

/** Command that dumps the current BGP config from the router (for diff). */
function currentConfigCommand(vendor: string): string {
    switch (vendor) {
        case 'cisco':
        case 'arista': return 'show running-config | section router bgp';
        case 'huawei': return 'display current-configuration configuration bgp';
        case 'juniper': return 'show configuration protocols bgp | display set';
        case 'mikrotik': return '/routing/bgp/connection/print detail';
        case 'vyos':
        case 'danos': return 'show configuration commands | match bgp';
        default: return 'show running-config | section router bgp';
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

function connectAndExec(host: string, cred: any, command: string): Promise<{ ok: boolean; output: string; error?: string }> {
    return new Promise((resolve) => {
        const conn = new Client();
        let output = '';
        const timeout = setTimeout(() => { try { conn.end(); } catch {} resolve({ ok: false, output, error: 'SSH timeout after 20s' }); }, 20000);
        conn.on('ready', () => {
            conn.exec(command, (err: any, stream: any) => {
                if (err) { clearTimeout(timeout); try { conn.end(); } catch {} return resolve({ ok: false, output, error: err.message }); }
                stream.on('data', (d: Buffer) => { output += d.toString(); });
                stream.stderr.on('data', (d: Buffer) => { output += d.toString(); });
                stream.on('close', () => { clearTimeout(timeout); try { conn.end(); } catch {} resolve({ ok: true, output }); });
            });
        }).on('error', (e: any) => { clearTimeout(timeout); resolve({ ok: false, output, error: `SSH Error: ${e.message}` }); })
          .connect({ host, port: cred.sshPort, username: cred.sshUser, password: cred.sshPass, readyTimeout: 12000, hostVerifier: () => true });
    });
}

function connectAndShell(host: string, cred: any, commands: string[]): Promise<{ ok: boolean; output: string; error?: string }> {
    return new Promise((resolve) => {
        const conn = new Client();
        let output = '';
        const timeout = setTimeout(() => { try { conn.end(); } catch {} resolve({ ok: false, output, error: 'SSH session timed out after 25s' }); }, 25000);
        conn.on('ready', () => {
            conn.shell((err: any, stream: any) => {
                if (err) { clearTimeout(timeout); try { conn.end(); } catch {} return resolve({ ok: false, output, error: err.message }); }
                stream.on('data', (d: Buffer) => { output += d.toString(); });
                stream.stderr.on('data', (d: Buffer) => { output += d.toString(); });
                stream.on('close', () => { clearTimeout(timeout); try { conn.end(); } catch {} resolve({ ok: true, output }); });
                for (const cmd of commands) stream.write(cmd + '\n');
                setTimeout(() => { try { stream.end('exit\n'); } catch {} }, 3500);
            });
        }).on('error', (e: any) => { clearTimeout(timeout); resolve({ ok: false, output, error: `SSH Error: ${e.message}` }); })
          .connect({ host, port: cred.sshPort, username: cred.sshUser, password: cred.sshPass, readyTimeout: 12000, hostVerifier: () => true });
    });
}

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!MANAGE_ROLES.includes(session.role)) return NextResponse.json({ error: 'Permission denied' }, { status: 403 });

    const body = await req.json();
    const id = body.id;
    // Back-compat: dryRun:true == preview. Otherwise use `mode`.
    const mode: 'preview' | 'diff' | 'apply' = body.dryRun ? 'preview' : (body.mode || 'preview');
    if (!id) return NextResponse.json({ error: 'Peer id is required' }, { status: 400 });

    const where: any = session.role === 'superadmin' ? { id } : { id, tenantId: session.tenantId };
    const peer = await (prisma as any).bgpPeer.findFirst({ where, include: { routerDevice: { include: { sshCredential: true } } } });
    if (!peer) return NextResponse.json({ error: 'BGP peer not found' }, { status: 404 });

    const device = peer.routerDevice;
    const vendor = (device?.vendor || 'cisco').toLowerCase();
    const { lines, text } = generateBgpConfig(vendor, toConfig(peer));

    const deviceInfo = device ? { hostname: device.hostname, ipAddress: device.ipAddress, vendor: device.vendor } : null;

    if (mode === 'preview') {
        return NextResponse.json({ config: text, vendor, device: deviceInfo, applyCommands: wrapForApply(vendor, lines) });
    }

    // diff + apply both require a reachable device
    if (!device) return NextResponse.json({ error: 'No device attached to this peer.', noDevice: true, config: text }, { status: 400 });
    const cred = device.sshCredential;
    if (!cred) return NextResponse.json({ error: `No SSH credentials for ${device.hostname}.`, noCredentials: true, config: text }, { status: 400 });

    if (mode === 'diff') {
        const res = await connectAndExec(device.ipAddress, cred, currentConfigCommand(vendor));
        if (!res.ok) return NextResponse.json({ error: res.error || 'Failed to fetch current config', config: text, currentConfig: '', vendor, device: deviceInfo }, { status: 502 });
        return NextResponse.json({ config: text, currentConfig: res.output.trim(), vendor, device: deviceInfo });
    }

    // mode === 'apply'
    const result = await connectAndShell(device.ipAddress, cred, wrapForApply(vendor, lines));
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

    if (!result.ok) return NextResponse.json({ error: result.error || 'Push failed', output: result.output, config: text }, { status: 502 });
    return NextResponse.json({ success: true, output: result.output, config: text, vendor });
}
