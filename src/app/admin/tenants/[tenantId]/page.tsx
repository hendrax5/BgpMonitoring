import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';

// ─── Server Actions ─────────────────────────────────────────────────────────

async function addTenantDevice(formData: FormData) {
    'use server';
    const session = await requireSession();
    if (session.role !== 'superadmin') return;

    const tenantId = formData.get('tenantId') as string;
    const hostname = formData.get('hostname') as string;
    const ipAddress = formData.get('ipAddress') as string;
    const vendor = formData.get('vendor') as string;
    const sshUser = formData.get('sshUser') as string;
    const sshPass = formData.get('sshPass') as string;
    const sshPort = parseInt(formData.get('sshPort') as string) || 22;
    const snmpCommunity = formData.get('snmpCommunity') as string;

    if (!tenantId || !hostname || !ipAddress) return;

    // Create SSH credential first if provided
    let sshCredentialId: number | null = null;
    if (sshUser && sshPass) {
        const cred = await (prisma as any).deviceCredential.create({
            data: { tenantId, deviceIp: ipAddress, sshUser, sshPass, sshPort, vendor }
        });
        sshCredentialId = cred.id;
    }

    await (prisma as any).routerDevice.create({
        data: {
            tenantId,
            hostname,
            ipAddress,
            vendor,
            snmpCommunity: snmpCommunity || null,
            sshCredentialId,
        }
    });
    revalidatePath(`/admin/tenants/${tenantId}`);
}

async function deleteTenantDevice(formData: FormData) {
    'use server';
    const session = await requireSession();
    if (session.role !== 'superadmin') return;

    const deviceId = parseInt(formData.get('deviceId') as string);
    const tenantId = formData.get('tenantId') as string;
    if (!deviceId || !tenantId) return;

    await (prisma as any).routerDevice.deleteMany({ where: { id: deviceId, tenantId } });
    revalidatePath(`/admin/tenants/${tenantId}`);
}

async function addTenantUser(formData: FormData) {
    'use server';
    const session = await requireSession();
    if (session.role !== 'superadmin') return;

    const tenantId = formData.get('tenantId') as string;
    const username = (formData.get('username') as string)?.trim();
    const password = formData.get('password') as string;
    const role = (formData.get('role') as string) || 'viewer';

    if (!tenantId || !username || !password) return;

    const bcrypt = await import('bcryptjs');
    const hashed = await bcrypt.hash(password, 12);

    await (prisma as any).appUser.create({
        data: { tenantId, username, password: hashed, role }
    });
    revalidatePath(`/admin/tenants/${tenantId}`);
}

async function deleteTenantUser(formData: FormData) {
    'use server';
    const session = await requireSession();
    if (session.role !== 'superadmin') return;

    const userId = parseInt(formData.get('userId') as string);
    const tenantId = formData.get('tenantId') as string;
    if (!userId || !tenantId) return;

    await (prisma as any).appUser.deleteMany({ where: { id: userId, tenantId } });
    revalidatePath(`/admin/tenants/${tenantId}`);
}

async function saveTenantBranding(formData: FormData) {
    'use server';
    const session = await requireSession();
    if (session.role !== 'superadmin') return;

    const tenantId = formData.get('tenantId') as string;
    const entries = ['monitoring_name', 'company_name', 'plan'];
    for (const key of entries) {
        const value = formData.get(key) as string | null;
        if (value === null || value === undefined) continue;
        if (key === 'plan') {
            await (prisma as any).tenant.update({ where: { id: tenantId }, data: { plan: value } });
        } else {
            await (prisma as any).appSettings.upsert({
                where: { tenantId_key: { tenantId, key } },
                create: { tenantId, key, value },
                update: { value },
            });
        }
    }
    revalidatePath(`/admin/tenants/${tenantId}`);
    revalidatePath('/admin');
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function TenantManagePage({ params }: { params: Promise<{ tenantId: string }> }) {
    const session = await requireSession();
    if (session.role !== 'superadmin') redirect('/');

    const { tenantId } = await params;

    const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) redirect('/admin');

    const devices = await (prisma as any).routerDevice.findMany({
        where: { tenantId },
        include: { sshCredential: true },
        orderBy: { createdAt: 'desc' }
    });

    const users = await (prisma as any).appUser.findMany({
        where: { tenantId, NOT: { role: 'superadmin' } },
        orderBy: { createdAt: 'desc' }
    });

    const brandingRows = await (prisma as any).appSettings.findMany({
        where: { tenantId, key: { in: ['monitoring_name', 'company_name'] } }
    });
    const branding: Record<string, string> = Object.fromEntries(brandingRows.map((r: any) => [r.key, r.value]));

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 border-b"
                style={{ backgroundColor: '#0d1520', borderColor: 'rgba(255,255,255,0.07)' }}>
                <div>
                    <div className="flex items-center gap-2 text-xs mb-0.5">
                        <Link href="/admin" style={{ color: '#f59e0b' }} className="font-bold uppercase tracking-wider hover:text-white">Admin</Link>
                        <span style={{ color: '#475569' }}>/</span>
                        <span className="text-white">Kelola Tenant</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-white font-bold text-base">{tenant.name}</h2>
                        <span className="text-xs px-2 py-0.5 rounded font-bold"
                            style={{ backgroundColor: 'rgba(19,164,236,0.12)', color: '#13a4ec' }}>
                            {tenant.plan}
                        </span>
                        <span className="text-xs" style={{ color: '#475569' }}>{tenant.slug}</span>
                    </div>
                </div>
                <Link href="/admin" className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ color: '#64748b', border: '1px solid rgba(255,255,255,0.07)' }}>
                    ← Back to Admin
                </Link>
            </header>

            <main className="p-6 max-w-6xl mx-auto space-y-8">

                {/* ── Devices ────────────────────────────────────────────── */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="material-symbols-outlined" style={{ color: '#13a4ec' }}>router</span>
                        <h3 className="text-base font-bold text-white">Devices ({devices.length})</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Add Device Form */}
                        <div className="card p-5">
                            <h4 className="font-bold text-white mb-4">Tambah Device</h4>
                            <form action={addTenantDevice} className="space-y-3">
                                <input type="hidden" name="tenantId" value={tenantId} />
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>Hostname / Alias</label>
                                    <input type="text" name="hostname" placeholder="Core-Jakarta" className="form-input w-full" required />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>IP Address</label>
                                    <input type="text" name="ipAddress" placeholder="192.168.1.1" className="form-input w-full" required />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>Vendor</label>
                                    <select name="vendor" className="form-input w-full">
                                        <option value="mikrotik">MikroTik</option>
                                        <option value="cisco">Cisco</option>
                                        <option value="juniper">Juniper</option>
                                        <option value="danos">DanOS</option>
                                        <option value="vyos">VyOS</option>
                                        <option value="huawei">Huawei</option>
                                    </select>
                                </div>
                                <div className="border-t pt-3" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                                    <p className="text-xs font-bold mb-2" style={{ color: '#64748b' }}>SSH Credentials (optional)</p>
                                    <input type="text" name="sshUser" placeholder="admin" className="form-input w-full mb-2" />
                                    <input type="password" name="sshPass" placeholder="password" className="form-input w-full mb-2" />
                                    <input type="number" name="sshPort" placeholder="22" defaultValue="22" className="form-input w-full mb-2" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>SNMP Community (optional)</label>
                                    <input type="text" name="snmpCommunity" placeholder="public" className="form-input w-full" />
                                </div>
                                <button type="submit" className="w-full py-2 rounded-lg text-sm font-bold text-white"
                                    style={{ background: 'linear-gradient(135deg, #13a4ec, #0d47a1)' }}>
                                    Add Device
                                </button>
                            </form>
                        </div>

                        {/* Device List */}
                        <div className="md:col-span-2 card overflow-hidden">
                            <table className="w-full data-table">
                                <thead>
                                    <tr>
                                        <th>Device</th>
                                        <th>Vendor</th>
                                        <th>SSH</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {devices.length === 0 && (
                                        <tr><td colSpan={4} className="text-center py-6" style={{ color: '#475569' }}>
                                            Belum ada device
                                        </td></tr>
                                    )}
                                    {devices.map((d: any) => (
                                        <tr key={d.id}>
                                            <td>
                                                <div className="font-bold text-white">{d.hostname}</div>
                                                <code className="text-xs" style={{ color: '#94a3b8' }}>{d.ipAddress}</code>
                                            </td>
                                            <td><span className="text-white capitalize">{d.vendor}</span></td>
                                            <td>
                                                {d.sshCredential
                                                    ? <span className="text-xs" style={{ color: '#10b981' }}>✓ {d.sshCredential.sshUser}</span>
                                                    : <span className="text-xs" style={{ color: '#475569' }}>—</span>
                                                }
                                            </td>
                                            <td>
                                                <form action={deleteTenantDevice}>
                                                    <input type="hidden" name="deviceId" value={d.id} />
                                                    <input type="hidden" name="tenantId" value={tenantId} />
                                                    <button type="submit" className="text-xs px-2.5 py-1 rounded-lg"
                                                        style={{ color: '#f43f5e', border: '1px solid rgba(244,63,94,0.3)' }}>
                                                        Hapus
                                                    </button>
                                                </form>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {/* ── Users ──────────────────────────────────────────────── */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="material-symbols-outlined" style={{ color: '#13a4ec' }}>group</span>
                        <h3 className="text-base font-bold text-white">Users ({users.length})</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Add User Form */}
                        <div className="card p-5">
                            <h4 className="font-bold text-white mb-4">Tambah User</h4>
                            <form action={addTenantUser} className="space-y-3">
                                <input type="hidden" name="tenantId" value={tenantId} />
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>Username</label>
                                    <input type="text" name="username" placeholder="jdoe" className="form-input w-full" required />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>Password</label>
                                    <input type="password" name="password" placeholder="min 8 chars" className="form-input w-full" required minLength={8} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>Role</label>
                                    <select name="role" className="form-input w-full">
                                        <option value="orgadmin">OrgAdmin — manage devices & users</option>
                                        <option value="networkengineer">Network Engineer</option>
                                        <option value="viewer">Viewer — read only</option>
                                    </select>
                                </div>
                                <button type="submit" className="w-full py-2 rounded-lg text-sm font-bold text-white"
                                    style={{ background: 'linear-gradient(135deg, #13a4ec, #0d47a1)' }}>
                                    Add User
                                </button>
                            </form>
                        </div>

                        {/* User List */}
                        <div className="md:col-span-2 card overflow-hidden">
                            <table className="w-full data-table">
                                <thead>
                                    <tr>
                                        <th>Username</th>
                                        <th>Role</th>
                                        <th>Registered</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.length === 0 && (
                                        <tr><td colSpan={4} className="text-center py-6" style={{ color: '#475569' }}>
                                            Belum ada user
                                        </td></tr>
                                    )}
                                    {users.map((u: any) => (
                                        <tr key={u.id}>
                                            <td>
                                                <div className="flex items-center gap-2 font-bold text-white">
                                                    <span className="material-symbols-outlined text-sm" style={{ color: '#94a3b8' }}>person</span>
                                                    {u.username}
                                                </div>
                                            </td>
                                            <td>
                                                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{
                                                    backgroundColor: u.role === 'orgadmin' ? 'rgba(19,164,236,0.15)'
                                                        : u.role === 'networkengineer' ? 'rgba(16,185,129,0.15)'
                                                            : 'rgba(255,255,255,0.06)',
                                                    color: u.role === 'orgadmin' ? '#13a4ec'
                                                        : u.role === 'networkengineer' ? '#10b981' : '#64748b',
                                                }}>
                                                    {u.role === 'networkengineer' ? 'Net.Engineer' : u.role}
                                                </span>
                                            </td>
                                            <td><span className="text-xs" style={{ color: '#475569' }}>{new Date(u.createdAt).toLocaleDateString('id-ID')}</span></td>
                                            <td>
                                                <form action={deleteTenantUser}>
                                                    <input type="hidden" name="userId" value={u.id} />
                                                    <input type="hidden" name="tenantId" value={tenantId} />
                                                    <button type="submit" className="text-xs px-2.5 py-1 rounded-lg"
                                                        style={{ color: '#f43f5e', border: '1px solid rgba(244,63,94,0.3)' }}>
                                                        Hapus
                                                    </button>
                                                </form>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {/* ── Branding & Plan ─────────────────────────────────────── */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="material-symbols-outlined" style={{ color: '#13a4ec' }}>palette</span>
                        <h3 className="text-base font-bold text-white">Branding & Plan</h3>
                    </div>
                    <div className="card p-6 max-w-xl">
                        <form action={saveTenantBranding} className="space-y-4">
                            <input type="hidden" name="tenantId" value={tenantId} />
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: '#64748b' }}>
                                    Plan Langganan
                                </label>
                                <select name="plan" className="form-input w-full" defaultValue={tenant.plan}>
                                    <option value="free">Free</option>
                                    <option value="standard">Standard</option>
                                    <option value="professional">Professional</option>
                                    <option value="enterprise">Enterprise</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: '#64748b' }}>
                                    Nama Monitoring (Sidebar)
                                </label>
                                <input type="text" name="monitoring_name"
                                    defaultValue={branding['monitoring_name'] || ''}
                                    placeholder="e.g. BGP Monitoring" className="form-input w-full" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: '#64748b' }}>
                                    Nama Organisasi (Sidebar)
                                </label>
                                <input type="text" name="company_name"
                                    defaultValue={branding['company_name'] || ''}
                                    placeholder="e.g. PT Mitra Net" className="form-input w-full" />
                            </div>
                            <div className="pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                                <button type="submit" className="px-6 py-2.5 rounded-xl font-bold text-white"
                                    style={{ background: 'linear-gradient(135deg, #13a4ec, #0d47a1)' }}>
                                    Simpan Perubahan
                                </button>
                            </div>
                        </form>
                    </div>
                </section>

            </main>
        </div>
    );
}
