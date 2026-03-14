import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

// Temporary debug endpoint - shows all Redis keys and a sample of device data
// Visit: /api/debug-redis to inspect
export async function GET() {
    try {
        const allKeys = await redis.keys('BgpSession:*');

        const samples: any[] = [];
        if (allKeys.length > 0) {
            // Fetch first 5 entries as sample
            const sampleKeys = allKeys.slice(0, 5);
            for (const k of sampleKeys) {
                const raw = await redis.hget(k, 'data');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    samples.push({
                        key: k,
                        deviceName: parsed.deviceName,
                        deviceIp: parsed.deviceIp,
                        peerIp: parsed.peerIp,
                        bgpState: parsed.bgpState,
                        serverName: parsed.serverName,
                    });
                }
            }
        }

        return NextResponse.json({
            redisStatus: redis.status,
            totalKeys: allKeys.length,
            sampleKeys: allKeys.slice(0, 10),
            sampleData: samples,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message, redisStatus: redis.status }, { status: 500 });
    }
}
