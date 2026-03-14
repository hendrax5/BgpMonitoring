import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET() {
    let downCount = 0;
    const downSessions: any[] = [];
    
    const allKeys = await redis.keys('BgpSession:*');
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
