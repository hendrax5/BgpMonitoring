export async function getHistoricalEvents(searchParams: {
    startDate?: string;
    endDate?: string;
    device?: string;
    search?: string;
    tenantId?: string;
    page: number;
    limit: number;
}) {
    const { prisma } = await import('@/lib/prisma');

    let whereClause: any = {};
    if (searchParams.tenantId) {
        whereClause.tenantId = searchParams.tenantId;
    }

    if (searchParams.startDate && searchParams.endDate) {
        whereClause.eventTimestamp = {
            gte: new Date(searchParams.startDate),
            lte: new Date(searchParams.endDate)
        };
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

    const totalCount = await prisma.historicalEvent.count({ where: whereClause });

    const events = await prisma.historicalEvent.findMany({
        where: whereClause,
        orderBy: { eventTimestamp: 'desc' },
        skip: (searchParams.page - 1) * searchParams.limit,
        take: searchParams.limit
    });

    return { events, totalCount };
}

export async function getTopFlappingPeers(startDate?: string, endDate?: string, tenantId?: string) {
    const { prisma } = await import('@/lib/prisma');

    let whereClause: any = { eventType: 'DOWN' };
    if (tenantId) whereClause.tenantId = tenantId;

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
