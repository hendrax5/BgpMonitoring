'use server';

import { prisma } from '@/lib/prisma';

export interface LibreNmsBgpEvent {
    datetime: string;
    device_id: number;
    hostname: string;
    type: string;
    message: string;
    severity: string;
    username: string;
}

export async function fetchLibreNmsBgpEvents(options?: { limit?: number; search?: string; asn?: string }): Promise<LibreNmsBgpEvent[]> {
    const limit = options?.limit ?? 20;

    let whereClause = {};
    if (options?.search || options?.asn) {
        whereClause = {
            OR: [
                { deviceName: { contains: options.search || options.asn } },
                { peerIp: { contains: options.search || options.asn } },
                { organizationName: { contains: options.search || options.asn } }
            ]
        };
    }

    const events = await prisma.historicalEvent.findMany({
        where: whereClause,
        orderBy: { eventTimestamp: 'desc' },
        take: limit
    });

    return events.map(e => ({
        datetime: e.eventTimestamp.toISOString(),
        device_id: e.eventId, // Mocking device_id with eventId for unique React keys
        hostname: e.deviceName || e.serverName,
        type: 'bgp',
        message: `Peer ${e.peerIp} is ${e.eventType} (AS${e.asn.toString()} - ${e.organizationName})`,
        severity: e.eventType === 'DOWN' ? 'critical' : 'ok',
        username: 'System'
    }));
}
