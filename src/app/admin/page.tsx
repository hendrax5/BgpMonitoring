import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function AdminPage() {
    const session = await requireSession();
    if (session.role !== 'superadmin') redirect('/');

    // --- All tenants
    const tenants = await (prisma as any).tenant.findMany({
        include: {
            _count: { select: { users: true, devices: true } }
        },
        orderBy: { createdAt: 'asc' }
    });

    // --- Live sessions per tenant from Redis
    const allKeys: string[] = await redis.keys('BgpSession:*');
    const tenantSessionCounts: Record<string, { total: number; down: number }> = {};
    if (allKeys.length > 0) {
        const pipeline = redis.pipeline();
        allKeys.forEach((k: string) => pipeline.hget(k, 'data'));
        const results = await pipeline.exec();
        results?.forEach(([err, val]: any, idx: number) => {
            if (!val) return;
            const s = JSON.parse(val as string);
            // Key format: BgpSession:{tenantId}:{hostname}:{deviceId}:{peerIp}
            const parts = allKeys[idx].split(':');
            const tenantId = parts[1];
            if (!tenantId) return;
            if (!tenantSessionCounts[tenantId]) tenantSessionCounts[tenantId] = { total: 0, down: 0 };
            tenantSessionCounts[tenantId].total++;
            if (s.bgpState !== 'Established') tenantSessionCounts[tenantId].down++;
        });
    }

    return (
        <div className="min-h-screen">
            <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 border-b"
                style={{ backgroundColor: '#0d1520', borderColor: 'rgba(255,255,255,0.07)' }}>
                <div>
                    <div className="flex items-center gap-2 text-xs mb-0.5" style={{ color: '#f59e0b' }}>
                        <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                        <span className="font-bold uppercase tracking-wider">Superadmin</span>
                    </div>
                    <h2 className="text-white font-bold text-base">Platform Overview</h2>
                </div>
                <Link href="/" className="text-xs px-3 py-1.5 rounded-lg" style={{ color: '#64748b', border: '1px solid rgba(255,255,255,0.07)' }}>
                    ← Dashboard
                </Link>
            </header>

            <main className="p-6 space-y-6">
                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="card p-5">
                        <p className="text-xs mb-1" style={{ color: '#64748b' }}>Total Tenants</p>
                        <p className="text-3xl font-bold text-white">{tenants.length}</p>
                    </div>
                    <div className="card p-5">
                        <p className="text-xs mb-1" style={{ color: '#64748b' }}>Total Users</p>
                        <p className="text-3xl font-bold text-white">
                            {tenants.reduce((acc: number, t: any) => acc + t._count.users, 0)}
                        </p>
                    </div>
                    <div className="card p-5">
                        <p className="text-xs mb-1" style={{ color: '#64748b' }}>Total Devices</p>
                        <p className="text-3xl font-bold text-white">
                            {tenants.reduce((acc: number, t: any) => acc + t._count.devices, 0)}
                        </p>
                    </div>
                </div>

                {/* Tenant table */}
                <div className="card overflow-hidden">
                    <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                        <h3 className="font-bold text-white">Tenants</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full data-table">
                            <thead>
                                <tr>
                                    <th>Organization</th>
                                    <th>Plan</th>
                                    <th>Users</th>
                                    <th>Devices</th>
                                    <th>BGP Sessions</th>
                                    <th>DOWN</th>
                                    <th>Joined</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tenants.map((t: any) => {
                                    const counts = tenantSessionCounts[t.id] || { total: 0, down: 0 };
                                    return (
                                        <tr key={t.id}>
                                            <td>
                                                <div>
                                                    <span className="font-bold text-white">{t.name}</span>
                                                    <span className="text-xs ml-2" style={{ color: '#475569' }}>{t.slug}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="text-xs font-bold px-2 py-0.5 rounded"
                                                    style={{ backgroundColor: 'rgba(19,164,236,0.12)', color: '#13a4ec' }}>
                                                    {t.plan}
                                                </span>
                                            </td>
                                            <td><span style={{ color: '#94a3b8' }}>{t._count.users}</span></td>
                                            <td><span style={{ color: '#94a3b8' }}>{t._count.devices}</span></td>
                                            <td><span className="font-bold text-white">{counts.total}</span></td>
                                            <td>
                                                {counts.down > 0 ? (
                                                    <span className="font-bold" style={{ color: '#f43f5e' }}>{counts.down}</span>
                                                ) : (
                                                    <span style={{ color: '#10b981' }}>0</span>
                                                )}
                                            </td>
                                            <td>
                                                <span className="text-xs" style={{ color: '#475569' }}>
                                                    {new Date(t.createdAt).toLocaleDateString('id-ID')}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
