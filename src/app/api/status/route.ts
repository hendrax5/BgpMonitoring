import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    // tenantId and role injected by middleware from JWT claims
    const tenantId = req.headers.get('x-tenant-id');
    const userRole = req.headers.get('x-user-role');

    // Not authenticated — middleware should have redirected, but guard here too
    if (!tenantId) {
        return NextResponse.json({ notAuthenticated: true, downCount: 0, downSessions: [] });
    }

    // Superadmin sees all tenants; others only their own
    const pattern = userRole === 'superadmin' ? 'BgpSession:*' : `BgpSession:${tenantId}:*`;

    let downCount = 0;
    const downSessions: any[] = [];

    const allKeys = await redis.keys(pattern);
    if (allKeys.length > 0) {
        const pipeline = redis.pipeline();
        allKeys.forEach(k => pipeline.hget(k, 'data'));
        const results = await pipeline.exec();

        results?.forEach(([err, res]) => {
            if (res) {
                const s = JSON.parse(res as string);
                if (s.bgpState !== 'Established') {
                    downCount++;
                    if (downSessions.length < 10) {
                        downSessions.push({
                            peerIp: s.peerIp,
                            deviceName: s.deviceName,
                            bgpState: s.bgpState,
                            serverName: s.serverName
                        });
                    }
                }
            }
        });
    }

    return NextResponse.json({ downCount, downSessions });
}
