import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { DeleteTenantForm } from '@/app/admin/components/DeleteTenantForm';
import SubmitButton from '@/app/components/SubmitButton';
import UserProfileDropdown from '@/app/components/UserProfileDropdown';

async function createTenant(formData: FormData) {
    'use server';
    const session = await requireSession();
    if (session.role !== 'superadmin') return;

    const name = (formData.get('name') as string)?.trim();
    const adminUsername = (formData.get('adminUsername') as string)?.trim();
    const adminPassword = (formData.get('adminPassword') as string)?.trim();
    const plan = (formData.get('plan') as string) || 'standard';

    if (!name || !adminUsername || !adminPassword) return;

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const existing = await (prisma as any).tenant.findUnique({ where: { slug } });
    if (existing) return; // slug already taken

    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    await (prisma as any).tenant.create({
        data: {
            name,
            slug,
            plan,
            users: {
                create: {
                    username: adminUsername,
                    password: hashedPassword,
                    role: 'orgadmin',
                }
            }
        }
    });
    redirect('/admin');
}

async function deleteTenant(formData: FormData) {
    'use server';
    const session = await requireSession();
    if (session.role !== 'superadmin') return;

    const tenantId = formData.get('tenantId') as string;
    if (!tenantId) return;

    // Delete all Redis sessions for this tenant
    const keys = await redis.keys(`BgpSession:${tenantId}:*`).catch(() => [] as string[]);
    if (keys.length > 0) await redis.del(...keys);

    // Delete tenant (cascades: users, devices, sessions, events)
    await (prisma as any).tenant.delete({ where: { id: tenantId } });
    redirect('/admin');
}

export default async function AdminPage() {
    const session = await requireSession();
    if (session.role !== 'superadmin') redirect('/');

    const tenants = await (prisma as any).tenant.findMany({
        include: { _count: { select: { users: true, devices: true } } },
        orderBy: { createdAt: 'asc' }
    });

    const allKeys: string[] = await redis.keys('BgpSession:*').catch(() => []);
    const tenantSessionCounts: Record<string, { total: number; down: number }> = {};
    if (allKeys.length > 0) {
        const pipeline = redis.pipeline();
        allKeys.forEach((k: string) => pipeline.hget(k, 'data'));
        const results = await pipeline.exec().catch(() => null);
        results?.forEach(([err, val]: any, idx: number) => {
            if (!val) return;
            const s = JSON.parse(val as string);
            const tenantId = allKeys[idx].split(':')[1];
            if (!tenantId) return;
            if (!tenantSessionCounts[tenantId]) tenantSessionCounts[tenantId] = { total: 0, down: 0 };
            tenantSessionCounts[tenantId].total++;
            if (s.bgpState !== 'Established') tenantSessionCounts[tenantId].down++;
        });
    }

    return (
        <div className="min-h-screen">
            <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 border-b glass"
                style={{ borderColor: 'var(--color-border)' }}>
                <div>
                    <div className="flex items-center gap-2 text-xs mb-0.5" style={{ color: '#fbbf24' }}>
                        <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                        <span className="font-bold uppercase tracking-wider">Superadmin</span>
                    </div>
                    <h2 className="text-white font-bold text-base">Platform Overview</h2>
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/" className="btn-ghost text-xs">← Dashboard</Link>
                    <UserProfileDropdown username={session?.username} role={session?.role} />
                </div>
            </header>

            <main className="p-6 space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                        { label: 'Total Tenants', value: tenants.length, icon: 'corporate_fare', accent: '#22d3ee' },
                        { label: 'Total Users', value: tenants.reduce((acc: number, t: any) => acc + t._count.users, 0), icon: 'group', accent: '#818cf8' },
                        { label: 'Total Devices', value: tenants.reduce((acc: number, t: any) => acc + t._count.devices, 0), icon: 'dns', accent: '#34d399' },
                    ].map((s, i) => (
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

                {/* Create Tenant */}
                <div className="card p-6">
                    <h3 className="font-bold text-white mb-1">Tambah Tenant Baru</h3>
                    <p className="text-xs mb-5" style={{ color: '#64748b' }}>
                        Buat tenant baru beserta akun orgadmin-nya.
                    </p>
                    <form action={createTenant} className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: '#64748b' }}>
                                Organization Name
                            </label>
                            <input type="text" name="name" required placeholder="PT Mitra Network" className="form-input w-full" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: '#64748b' }}>
                                Plan
                            </label>
                            <select name="plan" className="form-input w-full">
                                <option value="standard">Standard</option>
                                <option value="professional">Professional</option>
                                <option value="enterprise">Enterprise</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: '#64748b' }}>
                                Admin Username
                            </label>
                            <input type="text" name="adminUsername" required placeholder="admin" className="form-input w-full" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: '#64748b' }}>
                                Admin Password
                            </label>
                            <input type="password" name="adminPassword" required minLength={8} placeholder="Min 8 chars" className="form-input w-full" />
                        </div>
                        <div className="col-span-2 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                            <SubmitButton pendingText="Creating..."
                                className="btn-primary"
                                style={{ background: 'linear-gradient(135deg, #34d399, #059669)', color: '#04140c', padding: '0.6rem 1.4rem' }}>
                                <span className="material-symbols-outlined text-sm align-middle mr-1">add_circle</span>
                                Create Tenant
                            </SubmitButton>
                        </div>
                    </form>
                </div>

                {/* Tenant list */}
                <div className="card overflow-hidden">
                    <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                        <h3 className="font-bold text-white">Tenants ({tenants.length})</h3>
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
                                    <th>Action</th>
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
                                                    style={{ backgroundColor: 'rgba(34,211,238,0.12)', color: '#22d3ee' }}>
                                                    {t.plan}
                                                </span>
                                            </td>
                                            <td><span style={{ color: '#94a3b8' }}>{t._count.users}</span></td>
                                            <td><span style={{ color: '#94a3b8' }}>{t._count.devices}</span></td>
                                            <td><span className="font-bold text-white">{counts.total}</span></td>
                                            <td>
                                                {counts.down > 0 ? (
                                                    <span className="font-bold" style={{ color: '#fb7185' }}>{counts.down}</span>
                                                ) : (
                                                    <span style={{ color: '#34d399' }}>0</span>
                                                )}
                                            </td>
                                            <td>
                                                <span className="text-xs" style={{ color: '#475569' }}>
                                                    {new Date(t.createdAt).toLocaleDateString('id-ID')}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <Link href={`/admin/tenants/${t.id}`}
                                                        className="text-xs px-2.5 py-1 rounded-lg font-medium"
                                                        style={{ color: '#22d3ee', border: '1px solid rgba(34,211,238,0.3)' }}>
                                                        Kelola
                                                    </Link>
                                                    {t.slug !== 'platform-admin' && (
                                                        <DeleteTenantForm
                                                            tenantId={t.id}
                                                            tenantName={t.name}
                                                            deleteTenant={deleteTenant}
                                                        />
                                                    )}
                                                </div>
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
