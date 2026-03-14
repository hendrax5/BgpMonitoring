import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';

async function assignDevice(formData: FormData) {
    'use server';
    const session = await requireSession();
    if (session.role !== 'superadmin') redirect('/');
    const deviceId = parseInt(formData.get('deviceId') as string);
    const newTenantId = formData.get('tenantId') as string;
    await (prisma as any).routerDevice.update({
        where: { id: deviceId },
        data: { tenantId: newTenantId }
    });
    redirect('/admin/devices');
}

export default async function AdminDevicesPage() {
    const session = await requireSession();
    if (session.role !== 'superadmin') redirect('/');

    const [devices, tenants] = await Promise.all([
        (prisma as any).routerDevice.findMany({
            include: { tenant: { select: { id: true, name: true, slug: true } } },
            orderBy: [{ tenantId: 'asc' }, { hostname: 'asc' }]
        }),
        (prisma as any).tenant.findMany({ orderBy: { name: 'asc' } })
    ]);

    return (
        <div className="min-h-screen">
            <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 border-b"
                style={{ backgroundColor: '#0d1520', borderColor: 'rgba(255,255,255,0.07)' }}>
                <div>
                    <div className="flex items-center gap-2 text-xs mb-0.5">
                        <Link href="/admin" className="hover:text-white transition-colors" style={{ color: '#f59e0b' }}>
                            <span className="font-bold uppercase tracking-wider">Admin</span>
                        </Link>
                        <span style={{ color: '#475569' }}>/</span>
                        <span className="text-white">Device Assignment</span>
                    </div>
                    <h2 className="text-white font-bold text-base">Manage Device Tenants</h2>
                </div>
                <Link href="/admin" className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ color: '#64748b', border: '1px solid rgba(255,255,255,0.07)' }}>
                    ← Back to Admin
                </Link>
            </header>

            <main className="p-6">
                <div className="card overflow-hidden">
                    <div className="px-5 py-4 border-b flex items-center justify-between"
                        style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                        <div>
                            <h3 className="font-bold text-white">All Devices</h3>
                            <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                                {devices.length} total · Reassign to change ownership
                            </p>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full data-table">
                            <thead>
                                <tr>
                                    <th>Device</th>
                                    <th>IP Address</th>
                                    <th>Vendor</th>
                                    <th>Current Tenant</th>
                                    <th style={{ textAlign: 'right' }}>Reassign To</th>
                                </tr>
                            </thead>
                            <tbody>
                                {devices.map((d: any) => (
                                    <tr key={d.id}>
                                        <td>
                                            <span className="font-bold text-white font-mono">{d.hostname}</span>
                                        </td>
                                        <td>
                                            <span className="text-xs font-mono" style={{ color: '#94a3b8' }}>{d.ipAddress}</span>
                                        </td>
                                        <td>
                                            <span className="text-xs px-2 py-0.5 rounded font-medium capitalize"
                                                style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                                                {d.vendor}
                                            </span>
                                        </td>
                                        <td>
                                            <div>
                                                <span className="font-medium text-white text-sm">{d.tenant?.name}</span>
                                                <span className="text-xs ml-1.5" style={{ color: '#475569' }}>{d.tenant?.slug}</span>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <form action={assignDevice} className="inline-flex items-center gap-2">
                                                <input type="hidden" name="deviceId" value={d.id} />
                                                <select name="tenantId" defaultValue={d.tenantId}
                                                    className="text-xs form-select py-1.5"
                                                    style={{ minWidth: '140px' }}>
                                                    {tenants.map((t: any) => (
                                                        <option key={t.id} value={t.id}>{t.name}</option>
                                                    ))}
                                                </select>
                                                <button type="submit"
                                                    className="text-xs font-bold px-3 py-1.5 rounded-lg text-white"
                                                    style={{ backgroundColor: '#13a4ec' }}>
                                                    Assign
                                                </button>
                                            </form>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {devices.length === 0 && (
                            <div className="p-12 text-center">
                                <span className="material-symbols-outlined text-4xl block mb-3" style={{ color: '#334155' }}>router</span>
                                <p className="text-white font-medium">No devices found</p>
                                <p className="text-sm mt-1" style={{ color: '#475569' }}>Devices are added by tenants from their Settings page.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
