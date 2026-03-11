export async function getHistoricalEvents(searchParams: {
    startDate?: string;
    endDate?: string;
    asn?: string;
    device?: string;
    search?: string;
}) {
    const { prisma } = await import('@/lib/prisma');

    let whereClause: any = {};

    if (searchParams.startDate && searchParams.endDate) {
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
