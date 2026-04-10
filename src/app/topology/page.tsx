import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import UserProfileDropdown from '@/app/components/UserProfileDropdown';
import NetworkMap from './NetworkMap';
import { Suspense } from 'react';

export default async function TopologyPage() {
    const session = await requireSession();
    const isSuperAdmin = session.role === 'superadmin';

    // Fetch active routers
    const devicesWhere = isSuperAdmin ? {} : { tenantId: session.tenantId };
    const routers = await (prisma as any).routerDevice.findMany({
        where: devicesWhere,
        select: { id: true, hostname: true, ipAddress: true }
    });

    // Fetch BGP sessions from Redis
    const redisPattern = isSuperAdmin ? 'BgpSession:*' : `BgpSession:${session.tenantId}:*`;
    const keys = await redis.keys(redisPattern).catch(() => [] as string[]);
    let sessionsRaw: any[] = [];
    if (keys.length > 0) {
        try {
            const pipeline = redis.pipeline();
            keys.forEach((k: string) => pipeline.hget(k, 'data'));
            const results = await pipeline.exec();
            sessionsRaw = results?.map(([err, res]) => res ? JSON.parse(res as string) : null).filter(Boolean) || [];
        } catch { }
    }

    // Map ASN to Organization Name
    const asnDictionaryRecords = await prisma.asnDictionary.findMany();
    const asnMap = new Map<string, string>();
    asnDictionaryRecords.forEach((record: any) => asnMap.set(record.asn.toString(), record.organizationName));

    // Construct Nodes and Edges
    const nodes: any[] = [];
    const edges: any[] = [];
    let xOffset = 0;

    // Add Router Nodes (Center)
    routers.forEach((r: any, index: number) => {
        const routerNodeId = `router-${r.hostname}`;
        nodes.push({
            id: routerNodeId,
            type: 'default',
            data: { label: `Router: ${r.hostname}` },
            position: { x: 400 * index + 250, y: 300 },
            className: 'bg-blue-900 border border-blue-500 text-white font-bold rounded shadow-[0_0_15px_rgba(59,130,246,0.5)]'
        });

        const routerSessions = sessionsRaw.filter(s => s.deviceName === r.hostname);
        
        let angleStep = (Math.PI * 2) / (routerSessions.length || 1);
        
        routerSessions.forEach((s, idx) => {
            const peerNodeId = `peer-${s.peerIp}`;
            const orgName = asnMap.get(s.remoteAsn.toString()) || 'AS' + s.remoteAsn;
            const isUp = s.bgpState === 'Established';

            // Check if node exists (to avoid duplicate peers)
            if (!nodes.find(n => n.id === peerNodeId)) {
                nodes.push({
                    id: peerNodeId,
                    data: { label: `${s.peerIp}\n${orgName}` },
                    position: { 
                        x: (400 * index + 250) + Math.cos(angleStep * idx) * 200, 
                        y: 300 + Math.sin(angleStep * idx) * 200 
                    },
                    className: `border-2 text-white font-medium text-xs px-2 py-1 rounded-xl bg-black ${isUp ? 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]'}`
                });
            }

            edges.push({
                id: `edge-${routerNodeId}-${peerNodeId}`,
                source: routerNodeId,
                target: peerNodeId,
                animated: isUp,
                style: { 
                    stroke: isUp ? '#10b981' : '#f43f5e', 
                    strokeWidth: 2,
                    opacity: isUp ? 0.7 : 1
                }
            });
        });
    });

    return (
        <div className="min-h-screen bg-[#060a11]">
            <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 border-b border-white/5 bg-[#0d1520]">
                <div>
                  <h2 className="text-white font-bold text-base">Network Topology</h2>
                  <p className="text-xs text-zinc-400">Cyberpunk visualizer of your BGP landscape</p>
                </div>
                <UserProfileDropdown username={session?.username} role={session?.role} />
            </header>
            <main className="h-[calc(100vh-65px)] w-full relative">
                <Suspense fallback={<div className="p-10 text-white animate-pulse">Loading map...</div>}>
                    <NetworkMap initialNodes={nodes} initialEdges={edges} />
                </Suspense>
            </main>
        </div>
    );
}
