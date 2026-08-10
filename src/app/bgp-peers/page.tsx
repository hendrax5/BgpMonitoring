import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import UserProfileDropdown from '@/app/components/UserProfileDropdown';
import BgpPeerManager, { type BgpPeer } from './BgpPeerManager';

export const dynamic = 'force-dynamic';

const MANAGE_ROLES = ['superadmin', 'orgadmin', 'networkengineer'];

export default async function BgpPeersPage() {
    const session = await requireSession();
    const canManage = MANAGE_ROLES.includes(session.role);

    const [rawPeers, rawDevices] = await Promise.all([
        (prisma as any).bgpPeer.findMany({
            where: { tenantId: session.tenantId },
            orderBy: { updatedAt: 'desc' },
        }),
        (prisma as any).routerDevice.findMany({
            where: { tenantId: session.tenantId },
            select: { id: true, hostname: true, ipAddress: true },
            orderBy: { hostname: 'asc' },
        }),
    ]);

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
        updatedAt: p.updatedAt.toISOString(),
    }));

    const total = peers.length;
    const enabled = peers.filter(p => p.adminStatus === 'enabled').length;
    const disabled = peers.filter(p => p.adminStatus !== 'enabled').length;
    const uniqueAsn = new Set(peers.map(p => p.remoteAsn)).size;

    const stats = [
        { label: 'Configured Peers', value: total, icon: 'lan', accent: '#22d3ee' },
        { label: 'Enabled', value: enabled, icon: 'check_circle', accent: '#34d399' },
        { label: 'Disabled / Shutdown', value: disabled, icon: 'block', accent: '#fb7185' },
        { label: 'Unique Remote AS', value: uniqueAsn, icon: 'hub', accent: '#6366f1' },
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
                {/* Stat cards */}
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

                <BgpPeerManager peers={peers} devices={rawDevices} canManage={canManage} />
            </main>
        </div>
    );
}
