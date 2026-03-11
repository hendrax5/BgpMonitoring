import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    const downCount = await prisma.bgpCurrentState.count({
        where: { bgpState: { not: 'Established' } }
    });

    const downSessions = await prisma.bgpCurrentState.findMany({
        where: { bgpState: { not: 'Established' } },
        select: { peerIp: true, deviceName: true, bgpState: true, serverName: true },
        take: 10
    });

    return NextResponse.json({ downCount, downSessions });
}
