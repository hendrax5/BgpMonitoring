import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import UserProfileDropdown from '@/app/components/UserProfileDropdown';
import NetworkMap from './NetworkMap';
import TopologyFilter from './TopologyFilter';
import { Suspense } from 'react';

export default async function TopologyPage({ searchParams }: { searchParams: Promise<{ routerId?: string }> }) {
    const session = await requireSession();
    const isSuperAdmin = session.role === 'superadmin';
    const { routerId } = await searchParams;

    // Fetch all routers for the dropdown
    const devicesWhere = isSuperAdmin ? {} : { tenantId: session.tenantId };
    const allRouters = await (prisma as any).routerDevice.findMany({
        where: devicesWhere,
        select: { id: true, hostname: true, ipAddress: true }
    });

    // Determine the target router
    let targetRouter = allRouters.find((r: any) => r.id.toString() === routerId);
    if (!targetRouter && allRouters.length > 0) {
        targetRouter = allRouters[0];
    }

    let sessionsRaw: any[] = [];
    if (targetRouter) {
        // Fetch only sessions for this specific router to save RAM/CPU
        // Since original logic dumped ALL sessions, filtering here prevents giant Redis pipelines
        const redisPattern = isSuperAdmin ? `BgpSession:*:${targetRouter.ipAddress}:*` : `BgpSession:${session.tenantId}:${targetRouter.ipAddress}:*`;
        const keys = await redis.keys(redisPattern).catch(() => [] as string[]);
        
        // Alternatively, if key format doesn't have IP indexed perfectly, we fetch all and filter JS.
        // Actually, the key format is usually `BgpSession:tenantId:deviceId` or similar. Let's just fetch all and filter
        const broadPattern = isSuperAdmin ? 'BgpSession:*' : `BgpSession:${session.tenantId}:*`;
        const allKeys = await redis.keys(broadPattern).catch(() => [] as string[]);
        if (allKeys.length > 0) {
            try {
                const pipeline = redis.pipeline();
                allKeys.forEach((k: string) => pipeline.hget(k, 'data'));
                const results = await pipeline.exec();
                const allSessions = results?.map(([err, res]) => res ? JSON.parse(res as string) : null).filter(Boolean) || [];
                // Filter specifically for the target router
                sessionsRaw = allSessions.filter(s => s.deviceName === targetRouter.hostname);
            } catch { }
        }
    }

    // Map ASN to Organization Name
    const asnDictionaryRecords = await prisma.asnDictionary.findMany();
    const asnMap = new Map<string, string>();
    asnDictionaryRecords.forEach((record: any) => asnMap.set(record.asn.toString(), record.organizationName));

    const nodes: any[] = [];
    const edges: any[] = [];

    if (targetRouter) {
        const routerNodeId = `router-${targetRouter.hostname}`;
        // Place the target router exactly in the center
        nodes.push({
            id: routerNodeId,
            type: 'default',
            data: { label: `Router: ${targetRouter.hostname}` },
            position: { x: 400, y: 300 },
            className: 'bg-blue-900 border border-blue-500 text-white font-bold rounded-lg shadow-[0_0_20px_rgba(59,130,246,0.6)] px-4 py-2'
        });
        
        let angleStep = (Math.PI * 2) / (sessionsRaw.length || 1);
        const RADIUS = 280; // Distance of peers from the center router
        
        sessionsRaw.forEach((s, idx) => {
            const peerNodeId = `peer-${s.peerIp}`;
            const orgName = asnMap.get(s.remoteAsn.toString()) || 'AS' + s.remoteAsn;
            const isUp = s.bgpState === 'Established';

            if (!nodes.find(n => n.id === peerNodeId)) {
                nodes.push({
                    id: peerNodeId,
                    data: { label: `${s.peerIp}\n${orgName}` },
                    position: { 
                        x: 400 + Math.cos(angleStep * idx) * RADIUS, 
                        y: 300 + Math.sin(angleStep * idx) * RADIUS 
                    },
                    className: `border-2 text-white font-medium text-[10px] px-2 py-1 rounded-xl bg-[#0a1019] ${isUp ? 'border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.3)]' : 'border-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.3)]'}`
                });
            }

            edges.push({
                id: `edge-${routerNodeId}-${peerNodeId}`,
                source: routerNodeId,
                target: peerNodeId,
                animated: !isUp, // If down, animate the cut line
                style: { 
                    stroke: isUp ? '#10b981' : '#f43f5e', 
                    strokeWidth: 2,
                    opacity: isUp ? 0.7 : 1,
                    strokeDasharray: isUp ? 'none' : '5,5'
                }
            });
        });
    }

    return (
        <div className="min-h-screen bg-[#060a11]">
            <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 border-b border-white/5 bg-[#0d1520]">
                <div className="flex items-center gap-6">
                  <div>
                    <h2 className="text-white font-bold text-base">Network Topology</h2>
                    <p className="text-xs text-zinc-400">1-Hop Visualizer per Router Target</p>
                  </div>
                  <div className="h-8 w-px bg-white/10 hidden md:block"></div>
                  <TopologyFilter routers={allRouters} />
                </div>
                <UserProfileDropdown username={session?.username} role={session?.role} />
            </header>
            <main className="h-[calc(100vh-65px)] w-full relative">
                {targetRouter ? (
                    <Suspense fallback={<div className="p-10 text-white animate-pulse">Scanning topological map...</div>}>
                        <NetworkMap initialNodes={nodes} initialEdges={edges} />
                    </Suspense>
                ) : (
                    <div className="flex w-full h-full items-center justify-center text-zinc-500">
                        No routers available to visualize. Add a router first.
                    </div>
                )}
            </main>
        </div>
    );
}
