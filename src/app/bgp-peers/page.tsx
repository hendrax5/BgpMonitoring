import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { requireSession } from '@/lib/auth';
import UserProfileDropdown from '@/app/components/UserProfileDropdown';
import BgpPeerManager, { type BgpPeer, type LiveMatch } from './BgpPeerManager';

export const dynamic = 'force-dynamic';

const MANAGE_ROLES = ['superadmin', 'orgadmin', 'networkengineer'];

export default async function BgpPeersPage({ searchParams }: { searchParams: Promise<{ tenant?: string }> }) {
    const session = await requireSession();
    const canManage = MANAGE_ROLES.includes(session.role);
    const isSuperAdmin = session.role === 'superadmin';
    const params = await searchParams;

    const activeTenant = isSuperAdmin && params.tenant && params.tenant !== 'all' ? params.tenant : null;

    // Tenant list for the superadmin switcher
    let tenants: { id: string; name: string }[] = [];
    if (isSuperAdmin) {
        tenants = await prisma.tenant.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
    }

    // Peer query scope
    const peerWhere = isSuperAdmin
        ? (activeTenant ? { tenantId: activeTenant } : {})
        : { tenantId: session.tenantId };

    const [rawPeers, rawDevices] = await Promise.all([
        (prisma as any).bgpPeer.findMany({
            where: peerWhere,
            orderBy: { updatedAt: 'desc' },
            include: isSuperAdmin ? { tenant: { select: { name: true } } } : undefined,
        }),
        (prisma as any).routerDevice.findMany({
            where: peerWhere,
            select: { id: true, hostname: true, ipAddress: true, vendor: true },
            orderBy: { hostname: 'asc' },
        }),
    ]);

    // ── Live BGP sessions from Redis (for Live Peer Match) ──
    const redisPattern = isSuperAdmin
        ? (activeTenant ? `BgpSession:${activeTenant}:*` : 'BgpSession:*')
        : `BgpSession:${session.tenantId}:*`;
    const liveMap: Record<string, LiveMatch> = {};
    try {
        const keys = await redis.keys(redisPattern);
        if (keys.length > 0) {
            const pipeline = redis.pipeline();
            keys.forEach(k => pipeline.hget(k, 'data'));
            const results = await pipeline.exec();
            results?.forEach(([err, res]) => {
                if (!res) return;
                try {
                    const s = JSON.parse(res as string);
                    if (s?.peerIp) {
                        liveMap[s.peerIp] = {
                            bgpState: s.bgpState,
                            acceptedPrefixes: s.acceptedPrefixes ?? 0,
                            advertisedPrefixes: s.advertisedPrefixes ?? 0,
                            deviceName: s.deviceName,
                        };
                    }
                } catch { /* skip */ }
            });
        }
    } catch { /* redis unavailable */ }

    // Serialize BigInt + Date for the client component
    const peers: BgpPeer[] = rawPeers.map((p: any) => ({
        id: p.id,
        peerIp: p.peerIp,
        peerName: p.peerName,
        remoteAsn: p.remoteAsn.toString(),
        localAsn: p.localAsn != null ? p.localAsn.toString() : null,
        addressFamily: p.addressFamily,
        prefixLimit: p.prefixLimit,
        prefixList: p.prefixList,
        routePolicyIn: p.routePolicyIn,
        routePolicyOut: p.routePolicyOut,
        password: p.password,
        description: p.description,
        adminStatus: p.adminStatus,
        deviceId: p.deviceId,
        tenantName: p.tenant?.name ?? null,
        lastPushStatus: p.lastPushStatus ?? null,
        lastPushedAt: p.lastPushedAt ? p.lastPushedAt.toISOString() : null,
        updatedAt: p.updatedAt.toISOString(),
    }));

    const total = peers.length;
    const enabled = peers.filter(p => p.adminStatus === 'enabled').length;
    const liveEstablished = peers.filter(p => liveMap[p.peerIp]?.bgpState === 'Established').length;
    const uniqueAsn = new Set(peers.map(p => p.remoteAsn)).size;

    const stats = [
        { label: 'Configured Peers', value: total, icon: 'lan', accent: '#22d3ee' },
        { label: 'Enabled', value: enabled, icon: 'check_circle', accent: '#34d399' },
        { label: 'Live Established', value: liveEstablished, icon: 'sensors', accent: '#818cf8' },
        { label: 'Unique Remote AS', value: uniqueAsn, icon: 'hub', accent: '#fbbf24' },
    ];

    return (
        <div className="min-h-screen">
            <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 border-b glass"
                style={{ borderColor: 'var(--color-border)' }}>
                <div>
                    <div className="flex items-center gap-2 text-xs mb-0.5" style={{ color: '#475569' }}>
                        <span>Configuration</span><span>/</span><span className="text-white">BGP Peers</span>
                    </div>
                    <h2 className="text-white font-bold text-base">BGP Peer Management</h2>
                </div>
                <UserProfileDropdown username={session?.username} role={session?.role} />
            </header>

            <main className="p-6 space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {stats.map((s, i) => (
                        <div key={s.label} className={`stat-card p-5 animate-rise d${i + 1}`} style={{ '--accent': s.accent } as any}>
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-2 rounded-lg" style={{ backgroundColor: `${s.accent}1f`, color: s.accent }}>
                                    <span className="material-symbols-outlined text-xl">{s.icon}</span>
                                </div>
                            </div>
                            <p className="text-sm mb-1" style={{ color: '#64748b' }}>{s.label}</p>
                            <p className="text-3xl font-bold text-white">{s.value}</p>
                        </div>
                    ))}
                </div>

                <BgpPeerManager
                    peers={peers}
                    devices={rawDevices}
                    canManage={canManage}
                    liveMap={liveMap}
                    isSuperAdmin={isSuperAdmin}
                    tenants={tenants}
                    activeTenant={activeTenant}
                />
            </main>
        </div>
    );
}
