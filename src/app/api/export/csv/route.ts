import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { redis } from '@/lib/redis';
import { prisma } from '@/lib/prisma';
import Papa from 'papaparse';

export async function GET(request: NextRequest) {
    const session = await requireSession();
    const isSuperAdmin = session.role === 'superadmin';

    const { searchParams } = request.nextUrl;
    const deviceFilter  = searchParams.get('device');   // e.g. "router-jkt-01"
    const statusFilter  = searchParams.get('status');   // "Established" | "down" | null
    const searchFilter  = searchParams.get('search');   // free-text search

    // Read all BGP sessions from Redis (same as dashboard)
    const redisPattern = isSuperAdmin ? 'BgpSession:*' : `BgpSession:${session.tenantId}:*`;
    const allKeys = await redis.keys(redisPattern).catch(() => [] as string[]);

    let sessions: any[] = [];
    if (allKeys.length > 0) {
        const pipeline = redis.pipeline();
        allKeys.forEach(k => pipeline.hget(k, 'data'));
        const results = await pipeline.exec();
        sessions = results
            ?.map(([, res]) => res ? JSON.parse(res as string) : null)
            .filter(Boolean) || [];
    }

    // Apply device filter
    if (deviceFilter && deviceFilter !== 'all') {
        sessions = sessions.filter(s => s.deviceName === deviceFilter);
    }

    // Apply status filter — accept "down", "Established", or legacy "up"
    if (statusFilter === 'down') {
        sessions = sessions.filter(s => s.bgpState !== 'Established');
    } else if (statusFilter === 'Established' || statusFilter === 'up') {
        sessions = sessions.filter(s => s.bgpState === 'Established');
    }

    // Apply free-text search (same logic as dashboard)
    if (searchFilter) {
        const q = searchFilter.toLowerCase();
        sessions = sessions.filter(s =>
            s.peerIp.toLowerCase().includes(q) ||
            s.remoteAsn.toString().includes(q) ||
            (s.peerDescription || '').toLowerCase().includes(q) ||
            s.deviceName.toLowerCase().includes(q)
        );
    }

    // Enrich with ASN organization names
    const uniqueAsns = Array.from(new Set(sessions.map(s => BigInt(s.remoteAsn))));
    const asnRecords = uniqueAsns.length > 0
        ? await prisma.asnDictionary.findMany({ where: { asn: { in: uniqueAsns } } })
        : [];
    const asnMap = new Map(asnRecords.map((r: any) => [r.asn.toString(), r.organizationName]));

    // Sort: DOWN first, then by stateChangedAt
    sessions.sort((a, b) => {
        const aUp = a.bgpState === 'Established';
        const bUp = b.bgpState === 'Established';
        if (aUp !== bUp) return aUp ? 1 : -1;
        return new Date(a.stateChangedAt).getTime() - new Date(b.stateChangedAt).getTime();
    });

    // Build CSV rows
    const now = Date.now();
    const csvData = sessions.map(s => {
        const isUp = s.bgpState === 'Established';
        const stateChangedMs = new Date(s.stateChangedAt).getTime();
        const uptimeSec = Math.floor((now - stateChangedMs) / 1000);
        const days  = Math.floor(uptimeSec / 86400);
        const hours = Math.floor((uptimeSec % 86400) / 3600);
        const mins  = Math.floor((uptimeSec % 3600) / 60);
        const uptimeStr = days > 0 ? `${days}d ${hours}h ${mins}m`
                        : hours > 0 ? `${hours}h ${mins}m`
                        : `${mins}m`;

        return {
            'Peer IP':          s.peerIp,
            'Description':      s.peerDescription || '',
            'Device':           s.deviceName,
            'Remote ASN':       s.remoteAsn,
            'Organization':     asnMap.get(s.remoteAsn.toString()) || 'Unknown AS',
            'Status':           s.bgpState,
            'Uptime':           isUp ? uptimeStr : '-',
            'Since':            new Date(s.stateChangedAt).toISOString(),
            'Pfx Received':     s.acceptedPrefixes ?? 0,
            'Pfx Sent':         s.advertisedPrefixes ?? 0,
            'Last Updated':     new Date(s.lastUpdated).toISOString(),
        };
    });

    const csvString = Papa.unparse(csvData);
    // Include device name in filename if filtered, so it's clear what was exported
    const deviceSuffix = deviceFilter && deviceFilter !== 'all' ? `_${deviceFilter}` : '';
    const filename = `bgp_peers${deviceSuffix}_${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csvString, {
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${filename}"`
        }
    });
}
