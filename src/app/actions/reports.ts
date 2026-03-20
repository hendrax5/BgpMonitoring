export async function getHistoricalEvents(searchParams: {
    startDate?: string;
    endDate?: string;
    asn?: string;
    device?: string;
    search?: string;
    severity?: string;
    range?: string;
}) {
    const { prisma } = await import('@/lib/prisma');

    let whereClause: any = {};

    // Quick range presets override custom dates
    if (searchParams.range) {
        const rangeMap: Record<string, number> = { '1h': 1, '6h': 6, '24h': 24, '7d': 168 };
        const hours = rangeMap[searchParams.range];
        if (hours) {
            whereClause.eventTimestamp = { gte: new Date(Date.now() - hours * 3600000) };
        }
    } else if (searchParams.startDate && searchParams.endDate) {
        whereClause.eventTimestamp = {
            gte: new Date(searchParams.startDate),
            lte: new Date(searchParams.endDate)
        };
    }

    if (searchParams.asn) {
        whereClause.asn = BigInt(searchParams.asn);
    }

    if (searchParams.device) {
        whereClause.deviceName = { contains: searchParams.device };
    }

    // Severity filter
    if (searchParams.severity === 'critical') {
        whereClause.eventType = 'DOWN';
    } else if (searchParams.severity === 'recovery') {
        whereClause.eventType = 'UP';
    }
    // 'flap' = peers that appear multiple times → no single eventType, handled client-side for now

    if (searchParams.search) {
        const s = searchParams.search;
        whereClause.OR = [
            { peerIp: { contains: s } },
            { deviceName: { contains: s } },
            { organizationName: { contains: s } },
        ];
    }

    const events = await prisma.historicalEvent.findMany({
        where: whereClause,
        orderBy: { eventTimestamp: 'desc' }
    });

    return events;
}

export async function getTopFlappingPeers(startDate?: string, endDate?: string) {
    const { prisma } = await import('@/lib/prisma');

    let whereClause: any = { eventType: 'DOWN' };

    if (startDate && endDate) {
        whereClause.eventTimestamp = {
            gte: new Date(startDate),
            lte: new Date(endDate)
        };
    }

    const flapQuery = await prisma.historicalEvent.groupBy({
        by: ['peerIp', 'organizationName', 'asn'],
        where: whereClause,
        _count: { eventId: true },
        orderBy: { _count: { eventId: 'desc' } },
        take: 5
    });

    return flapQuery;
}

export interface IncidentStats {
    downCount: number;
    topImpactAsn: string;
    topImpactOrg: string;
    topImpactCount: number;
    lastEventIp: string;
    lastEventTime: string | null;
    eventDensity: { hour: string; count: number; hasDown: boolean }[];
}

export async function getIncidentStats(): Promise<IncidentStats> {
    const { redis } = await import('@/lib/redis');
    const { prisma } = await import('@/lib/prisma');

    // --- Live DOWN peers from Redis ---
    const allKeys = await redis.keys('BgpSession:*');
    const downPeers: { ip: string; asn: string; org: string }[] = [];

    if (allKeys.length > 0) {
        const pipeline = redis.pipeline();
        allKeys.forEach(k => pipeline.hget(k, 'data'));
        const results = await pipeline.exec();
        results?.forEach(([, res]) => {
            if (res) {
                const s = JSON.parse(res as string);
                if (s.bgpState !== 'Established') {
                    downPeers.push({
                        ip: s.peerIp || s.peer_ip || '',
                        asn: s.remoteAs?.toString() || s.remote_as?.toString() || '',
                        org: s.organizationName || '',
                    });
                }
            }
        });
    }

    // --- Top impact ASN (most DOWN peers) ---
    const asnCounts: Record<string, { org: string; count: number }> = {};
    for (const p of downPeers) {
        if (!p.asn) continue;
        if (!asnCounts[p.asn]) asnCounts[p.asn] = { org: p.org, count: 0 };
        asnCounts[p.asn].count++;
    }
    const topEntry = Object.entries(asnCounts).sort((a, b) => b[1].count - a[1].count)[0];

    // --- Last event ---
    const lastEv = await prisma.historicalEvent.findFirst({
        orderBy: { eventTimestamp: 'desc' },
        where: { eventType: 'DOWN' },
    });

    // --- Event density: last 12h, per hour ---
    const now = new Date();
    const density: { hour: string; count: number; hasDown: boolean }[] = [];
    for (let i = 11; i >= 0; i--) {
        const from = new Date(now.getTime() - (i + 1) * 3600000);
        const to = new Date(now.getTime() - i * 3600000);
        const [total, downs] = await Promise.all([
            prisma.historicalEvent.count({ where: { eventTimestamp: { gte: from, lt: to } } }),
            prisma.historicalEvent.count({ where: { eventTimestamp: { gte: from, lt: to }, eventType: 'DOWN' } }),
        ]);
        density.push({
            hour: from.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            count: total,
            hasDown: downs > 0,
        });
    }

    return {
        downCount: downPeers.length,
        topImpactAsn: topEntry ? topEntry[0] : '',
        topImpactOrg: topEntry ? topEntry[1].org : '',
        topImpactCount: topEntry ? topEntry[1].count : 0,
        lastEventIp: lastEv?.peerIp || '',
        lastEventTime: lastEv?.eventTimestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) || null,
        eventDensity: density,
    };
}
