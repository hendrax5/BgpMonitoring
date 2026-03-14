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

/**
 * Fetches recent BGP-related event logs from all configured LibreNMS servers.
 * Uses the /eventlog endpoint filtered by "BGP" in the message.
 * Returns last `limit` events sorted newest-first (merged from all servers).
 */
export async function fetchLibreNmsBgpEvents(options?: { limit?: number; search?: string; asn?: string }): Promise<LibreNmsBgpEvent[]> {
    const limit = options?.limit ?? 20;
    const search = options?.search?.toLowerCase();
    const asn = options?.asn;

    const servers = await prisma.librenmsServer.findMany();
    if (servers.length === 0) return [];

    const allEvents: LibreNmsBgpEvent[] = [];

    await Promise.allSettled(servers.map(async (srv) => {
        try {
            // LibreNMS eventlog API: GET /api/v0/logs/eventlog?limit=200
            // We then filter client-side for BGP mentions since the API
            // doesn't support free-text filtering natively.
            const url = srv.apiUrl.endsWith('/')
                ? `${srv.apiUrl}logs/eventlog?limit=200`
                : `${srv.apiUrl}/logs/eventlog?limit=200`;

            const res = await fetch(url, {
                headers: { 'X-Auth-Token': srv.apiToken },
                next: { revalidate: 30 }, // cache 30s
            });

            if (!res.ok) return;
            const data = await res.json();
            const events: any[] = data.logs || [];

            // Filter for BGP-related events (case-insensitive)
            let bgpEvents = events.filter((e: any) =>
                /bgp/i.test(e.message || '') || /bgp/i.test(e.type || '')
            );

            // Apply search/asn filters if provided
            if (search) {
                bgpEvents = bgpEvents.filter((e: any) =>
                    (e.message || '').toLowerCase().includes(search) ||
                    (e.hostname || '').toLowerCase().includes(search)
                );
            }
            if (asn) {
                bgpEvents = bgpEvents.filter((e: any) =>
                    (e.message || '').includes(asn) ||
                    (e.hostname || '').includes(asn)
                );
            }

            allEvents.push(...bgpEvents.map((e: any) => ({
                datetime: e.datetime || '',
                device_id: parseInt(e.device_id || '0'),
                hostname: e.hostname || `srv:${srv.name}`,
                type: e.type || 'bgp',
                message: e.message || '',
                severity: e.severity || 'info',
                username: e.username || '',
            })));
        } catch {
            // Server unreachable — skip silently
        }
    }));

    // Filter: only show events from the last 2 days
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const recentEvents = allEvents.filter(e => new Date(e.datetime) >= twoDaysAgo);

    // Sort newest first, take top N
    recentEvents.sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
    return recentEvents.slice(0, limit);
}
