import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { addRouterDevice, updateRouterDevice, deleteRouterDevice, getTelegramSettings, saveTelegramSettings } from '@/app/actions/settings';
import { addUser, updateUser, deleteUser } from '@/app/actions/users';
import SyncButton from '@/app/settings/components/SyncButton';
import RouterTestButton from '@/app/settings/components/RouterTestButton';
import ImportDevicesButton from '@/app/settings/components/ImportDevicesButton';
import { revalidatePath } from 'next/cache';

async function saveBranding(formData: FormData) {
    'use server';
    const session = await requireSession();
    const entries = ['monitoring_name', 'company_name'];
    for (const key of entries) {
        const value = formData.get(key) as string | null;
        if (value !== null) {
            await (prisma as any).appSettings.upsert({
                where: { tenantId_key: { tenantId: session.tenantId, key } },
                create: { tenantId: session.tenantId, key, value },
                update: { value },
            });
        }
    }
    revalidatePath('/settings');
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; edit?: string; editUser?: string }> }) {
    const session = await requireSession();
    const { error, edit, editUser } = await searchParams;
    const editId = edit ? parseInt(edit) : null;
    const devices = await (prisma as any).routerDevice.findMany({
        where: { tenantId: session.tenantId },
        orderBy: { createdAt: 'desc' },
        include: { sshCredential: true }
    });
    const editDevice = editId ? devices.find((d: any) => d.id === editId) : null;

    const editUserId = editUser ? parseInt(editUser) : null;
    const users = await (prisma as any).appUser.findMany({
        where: {
            tenantId: session.tenantId,
            NOT: { role: 'superadmin' }, // Platform account — tidak ditampilkan di tenant settings
        },
        orderBy: { createdAt: 'desc' }
    });
    const editUserObj = editUserId ? users.find((u: any) => u.id === editUserId) : null;

    const telegram = await getTelegramSettings();

    // Per-tenant branding settings
    const brandingRows = await (prisma as any).appSettings.findMany({
        where: { tenantId: session.tenantId, key: { in: ['monitoring_name', 'company_name'] } }
    });
    const branding: Record<string, string> = Object.fromEntries(brandingRows.map((r: any) => [r.key, r.value]));

    return (

        <div className="min-h-screen">
            {/* Top Header */}
            <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 border-b"
                style={{ backgroundColor: '#0d1520', borderColor: 'rgba(255,255,255,0.07)' }}>
                <div>
                    <h2 className="text-white font-bold text-base">Configuration Settings</h2>
                    <p className="text-xs" style={{ color: '#64748b' }}>Manage Monitored Routers and Application Users.</p>
                </div>
                <div className="flex items-center gap-4">
                    <SyncButton />

                    <a href="/" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                        style={{ color: '#64748b', border: '1px solid rgba(255,255,255,0.07)' }}>
                        ← Dashboard
                    </a>
                </div>
            </header>

            <main className="p-6 max-w-6xl space-y-6 animate-fade-in mx-auto">

                {error && (
                    <div className="card px-4 py-3 flex items-center gap-3" style={{ borderColor: 'rgba(244,63,94,0.3)', backgroundColor: 'rgba(244,63,94,0.08)' }}>
                        <span className="material-symbols-outlined text-lg" style={{ color: '#f43f5e' }}>error</span>
                        <span className="text-sm" style={{ color: '#f43f5e' }}>{error}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Device Add/Edit Form: only for device.manage roles */}
                    {can(session.role, 'device.manage') ? (
                        <div className="md:col-span-1">
                            <div className="card p-5 sticky top-20">
                                <h3 className="font-bold text-white mb-1">
                                    {editDevice ? 'Edit Router' : 'Add Monitored Router'}
                                </h3>
                                <p className="text-xs mb-5" style={{ color: '#64748b' }}>
                                    {editDevice ? `Editing: ${editDevice.hostname}` : 'Add a device to be polled directly via SNMP/SSH.'}
                                </p>

                                <form action={async (formData: FormData) => {
                                    'use server';
                                    const id = formData.get('id');
                                    if (id) await updateRouterDevice(formData);
                                    else await addRouterDevice(formData);
                                }} className="space-y-4">

                                    {editDevice && <input type="hidden" name="id" value={editDevice.id} />}

                                    <div>
                                        <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>Hostname / Alias</label>
                                        <input type="text" name="hostname" placeholder="e.g. Core-Jakarta"
                                            defaultValue={editDevice?.hostname || ''}
                                            className="form-input" required />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>IP Address</label>
                                        <input type="text" name="ipAddress" placeholder="e.g. 10.10.10.1"
                                            defaultValue={editDevice?.ipAddress || ''}
                                            className="form-input" required />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>Vendor</label>
                                            <select name="vendor" className="form-input" defaultValue={editDevice?.vendor || 'mikrotik'}>
                                                <option value="mikrotik">MikroTik RouterOS</option>
                                                <option value="cisco">Cisco IOS/XR</option>
                                                <option value="juniper">Juniper JunOS</option>
                                                <option value="huawei">Huawei VRP</option>
                                                <option value="danos">DanOS</option>
                                                <option value="vyos">VyOS</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>Polling Method</label>
                                            <select name="pollMethod" className="form-input" defaultValue={editDevice?.pollMethod || 'snmp_ssh_mix'}>
                                                <option value="snmp_ssh_mix">SNMP + SSH Mix</option>
                                                <option value="snmp_only">SNMP Only</option>
                                                <option value="ssh_only">SSH Only</option>
                                            </select>
                                        </div>
                                    </div>

                                    <hr style={{ borderColor: 'rgba(255,255,255,0.07)' }} className="my-2" />

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>SNMP Version</label>
                                            <select name="snmpVersion" className="form-input" defaultValue={editDevice?.snmpVersion || 'v2c'}>
                                                <option value="v2c">v2c</option>
                                                <option value="v3">v3</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>SNMP Port</label>
                                            <input type="number" name="snmpPort" placeholder="161"
                                                defaultValue={editDevice?.snmpPort || 161}
                                                className="form-input" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>SNMP Community / Context</label>
                                        <input type="password" name="snmpCommunity" placeholder="••••••••"
                                            defaultValue={editDevice?.snmpCommunity || ''}
                                            className="form-input" />
                                    </div>

                                    <hr style={{ borderColor: 'rgba(255,255,255,0.07)' }} className="my-2" />

                                    {/* SSH Credentials — inline */}
                                    <div className="space-y-1 mb-1">
                                        <p className="text-xs font-semibold" style={{ color: '#13a4ec' }}>SSH Credentials</p>
                                        <p className="text-[10px]" style={{ color: '#475569' }}>Kosongkan jika tidak pakai SSH</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>SSH Username</label>
                                            <input type="text" name="sshUser" placeholder="admin"
                                                defaultValue={editDevice?.sshCredential?.sshUser || ''}
                                                className="form-input" autoComplete="off" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>SSH Port</label>
                                            <input type="number" name="sshPort" placeholder="22"
                                                defaultValue={editDevice?.sshCredential?.sshPort || 22}
                                                className="form-input" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>SSH Password</label>
                                        <input type="password" name="sshPass"
                                            placeholder={editDevice?.sshCredential ? '•••••••• (tersimpan, kosongkan jika tidak diubah)' : '••••••••'}
                                            className="form-input" autoComplete="new-password" />
                                    </div>


                                    <div className="flex gap-2 pt-2">
                                        <button type="submit" className="flex-1 py-2.5 text-sm font-bold rounded-lg text-white"
                                            style={{ backgroundColor: '#13a4ec' }}>
                                            {editDevice ? 'Update Router' : 'Save Router'}
                                        </button>
                                        {editDevice && (
                                            <a href="/settings" className="flex items-center justify-center px-4 py-2.5 text-sm rounded-lg"
                                                style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                                                Cancel
                                            </a>
                                        )}
                                    </div>
                                </form>
                            </div>
                        </div>
                    ) : (
                        <div className="md:col-span-1">
                            <div className="card p-5" style={{ border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.04)' }}>
                                <span className="material-symbols-outlined text-2xl block mb-2" style={{ color: '#f59e0b' }}>lock</span>
                                <h3 className="font-bold text-white mb-1">Device Management</h3>
                                <p className="text-xs" style={{ color: '#64748b' }}>Hanya OrgAdmin dan SuperAdmin yang bisa menambah, mengedit, atau menghapus perangkat.</p>
                                <p className="text-xs mt-2 px-2 py-1 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.04)', color: '#94a3b8' }}>
                                    Role Anda: <strong style={{ color: '#f59e0b' }}>{session.role}</strong>
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Configured Devices List */}
                    <div className="md:col-span-2 card overflow-hidden self-start">
                        <div className="px-5 py-4 border-b flex justify-between items-center" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                            <div>
                                <h2 className="font-bold text-white">Monitored Routers</h2>
                                <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>Worker polls these devices directly.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href="/api/devices/export"
                                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                                    style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.12)' }}
                                >
                                    <span className="material-symbols-outlined text-sm">download</span>
                                    Export CSV
                                </a>
                                <ImportDevicesButton />
                            </div>
                        </div>

                        {devices.length === 0 ? (
                            <div className="p-12 text-center">
                                <span className="material-symbols-outlined text-4xl block mb-3" style={{ color: '#334155' }}>router</span>
                                <p className="font-medium text-white mb-1">No routers configured</p>
                                <p className="text-sm" style={{ color: '#475569' }}>Add your first target router on the left.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full data-table">
                                    <thead>
                                        <tr>
                                            <th>Hostname & IP</th>
                                            <th>Vendor / Method</th>
                                            <th>SNMP</th>
                                            <th>SSH</th>
                                            <th>Test</th>
                                            <th style={{ textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {devices.map((device: any) => (
                                            <tr key={device.id}>
                                                <td>
                                                    <div className="font-bold text-white">{device.hostname}</div>
                                                    <code className="text-xs font-mono" style={{ color: '#94a3b8' }}>{device.ipAddress}</code>
                                                </td>
                                                <td>
                                                    <div className="text-sm text-white capitalize">{device.vendor}</div>
                                                    <div className="text-[10px] px-1.5 py-0.5 rounded mt-0.5 inline-block"
                                                        style={{ backgroundColor: 'rgba(19,164,236,0.1)', color: '#13a4ec' }}>
                                                        {device.pollMethod.replace(/_/g, ' ')}
                                                    </div>
                                                </td>
                                                <td>
                                                    {device.snmpCommunity ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#10b981' }}></span>
                                                            <span className="text-xs" style={{ color: '#94a3b8' }}>{device.snmpVersion} · port {device.snmpPort}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#475569' }}></span>
                                                            <span className="text-xs" style={{ color: '#475569' }}>Not set</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    {device.sshCredential ? (
                                                        <div className="text-xs flex flex-col">
                                                            <span className="text-white">{device.sshCredential.sshUser}</span>
                                                            <span style={{ color: '#64748b' }}>port {device.sshCredential.sshPort}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.04)', color: '#475569' }}>No SSH</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <RouterTestButton routerId={device.id} />
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        {can(session.role, 'device.manage') && (
                                                            <>
                                                                <a href={`/settings?edit=${device.id}`}
                                                                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                                                                    style={{ color: '#13a4ec', backgroundColor: 'rgba(19,164,236,0.08)' }}
                                                                    title="Edit">
                                                                    <span className="material-symbols-outlined text-sm">edit</span>
                                                                </a>
                                                                <form action={async () => {
                                                                    'use server';
                                                                    await deleteRouterDevice(device.id);
                                                                }}>
                                                                    <button type="submit"
                                                                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                                                                        style={{ color: '#f43f5e', backgroundColor: 'rgba(244,63,94,0.08)' }}
                                                                        title="Delete">
                                                                        <span className="material-symbols-outlined text-sm">delete</span>
                                                                    </button>
                                                                </form>
                                                            </>
                                                        )}
                                                        {!can(session.role, 'device.manage') && (
                                                            <span className="text-[10px] px-2 py-1 rounded" style={{ color: '#475569', backgroundColor: 'rgba(255,255,255,0.04)' }}>Read only</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                <hr style={{ borderColor: 'rgba(255,255,255,0.07)' }} />

                {/* User Management: only for user.manageTenant roles */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1">
                        <div className="card p-5">
                            <h3 className="font-bold text-white mb-1">
                                {can(session.role, 'user.manageTenant')
                                    ? (editUserObj ? 'Edit User' : 'Add App User')
                                    : 'Users'}
                            </h3>
                            <p className="text-xs mb-5" style={{ color: '#64748b' }}>
                                {can(session.role, 'user.manageTenant')
                                    ? (editUserObj ? `Editing: ${editUserObj.username}` : 'Create an account to access this dashboard.')
                                    : 'Daftar pengguna terdaftar di tenant ini.'}
                            </p>

                            {can(session.role, 'user.manageTenant') && (
                                <form action={async (formData: FormData) => {
                                    'use server';
                                    const id = formData.get('id');
                                    if (id) await updateUser(formData);
                                    else await addUser(formData);
                                }} className="space-y-4">

                                    {editUserObj && <input type="hidden" name="id" value={editUserObj.id} />}

                                    <div>
                                        <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>Username</label>
                                        <input type="text" name="username" placeholder="e.g. jdoe"
                                            defaultValue={editUserObj?.username || ''}
                                            className="form-input" required />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>
                                            Password {editUserObj && <span className="text-[10px] text-[#f59e0b]">(Leave blank to keep current)</span>}
                                        </label>
                                        <input type="password" name="password" placeholder="••••••••"
                                            className="form-input" required={!editUserObj} />
                                    </div>

                                    {/* Role Dropdown */}
                                    {!editUserObj && (
                                        <div>
                                            <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>Role</label>
                                            <select name="role" className="form-input" defaultValue="viewer">
                                                <option value="orgadmin">OrgAdmin — manage devices &amp; users</option>
                                                <option value="networkengineer">Network Engineer — view &amp; config alerts</option>
                                                <option value="viewer">Viewer — read only</option>
                                            </select>
                                            <p className="text-[11px] mt-1" style={{ color: '#475569' }}>Superadmin tidak bisa diassign via form ini.</p>
                                        </div>
                                    )}

                                    <div className="pt-2 flex gap-2">
                                        <button type="submit" className="flex-1 py-2 rounded-lg text-sm font-bold transition-colors"
                                            style={{ backgroundColor: '#13a4ec', color: 'white' }}>
                                            {editUserObj ? 'Update User' : 'Save User'}
                                        </button>
                                        {editUserObj && (
                                            <a href="/settings" className="flex-1 py-2 text-center rounded-lg text-sm font-bold transition-colors"
                                                style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'white' }}>
                                                Cancel
                                            </a>
                                        )}
                                    </div>
                                </form>
                            )}
                            {!can(session.role, 'user.manageTenant') && (
                                <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                                    <span className="material-symbols-outlined text-sm mr-1" style={{ color: '#f59e0b', verticalAlign: 'middle' }}>lock</span>
                                    <span className="text-xs" style={{ color: '#94a3b8' }}>Hanya OrgAdmin yang bisa mengelola user.</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <div className="card overflow-hidden">
                            <table className="w-full data-table">
                                <thead>
                                    <tr>
                                        <th>Username</th>
                                        <th>Role</th>
                                        <th>Registered</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((u: any) => (
                                        <tr key={u.id}>
                                            <td>
                                                <div className="font-bold text-white flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-[1rem]" style={{ color: '#94a3b8' }}>person</span>
                                                    {u.username}
                                                </div>
                                            </td>
                                            <td>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
                                                    backgroundColor: u.role === 'superadmin' ? 'rgba(245,158,11,0.15)'
                                                        : u.role === 'orgadmin' ? 'rgba(19,164,236,0.15)'
                                                            : u.role === 'networkengineer' ? 'rgba(16,185,129,0.15)'
                                                                : 'rgba(255,255,255,0.06)',
                                                    color: u.role === 'superadmin' ? '#f59e0b'
                                                        : u.role === 'orgadmin' ? '#13a4ec'
                                                            : u.role === 'networkengineer' ? '#10b981'
                                                                : '#64748b',
                                                }}>
                                                    {u.role === 'networkengineer' ? 'Net. Engineer' : u.role}
                                                </span>
                                            </td>

                                            <td>
                                                <div className="text-xs" style={{ color: '#64748b' }}>{u.createdAt.toLocaleDateString()}</div>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div className="flex items-center justify-end gap-1">
                                                    <a href={`/settings?editUser=${u.id}`}
                                                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                                                        style={{ color: '#13a4ec', backgroundColor: 'rgba(19,164,236,0.08)' }}
                                                        title="Edit">
                                                        <span className="material-symbols-outlined text-sm">edit</span>
                                                    </a>
                                                    <form action={async () => {
                                                        'use server';
                                                        await deleteUser(u.id);
                                                    }}>
                                                        <button type="submit"
                                                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                                                            style={{ color: '#f43f5e', backgroundColor: 'rgba(244,63,94,0.08)' }}
                                                            title="Delete">
                                                            <span className="material-symbols-outlined text-sm">delete</span>
                                                        </button>
                                                    </form>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <hr style={{ borderColor: 'rgba(255,255,255,0.07)' }} />

                {/* Telegram Bot Configuration */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1">
                        <div className="card p-5">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="material-symbols-outlined text-lg" style={{ color: '#13a4ec' }}>send</span>
                                <h3 className="font-bold text-white">Telegram Alerts</h3>
                            </div>
                            <p className="text-xs mb-5" style={{ color: '#64748b' }}>
                                Konfigurasi bot Telegram untuk notifikasi BGP DOWN/UP.
                                {telegram.botToken && (
                                    <span className="block mt-1 text-[#10b981] font-medium">✓ Bot terkonfigurasi</span>
                                )}
                            </p>

                            <form action={async (formData: FormData) => {
                                'use server';
                                await saveTelegramSettings(formData);
                            }} className="space-y-4">

                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>Bot Token</label>
                                    <input
                                        type="password"
                                        name="telegram_bot_token"
                                        placeholder={telegram.botToken ? '••••••••••• (sudah tersimpan)' : '123456:ABC-DEF...'}
                                        className="form-input"
                                    />
                                    <p className="text-[10px] mt-1" style={{ color: '#475569' }}>
                                        Dapatkan dari <a href="https://t.me/BotFather" target="_blank" className="text-[#13a4ec] hover:underline">@BotFather</a>
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>Chat ID / Group ID</label>
                                    <input
                                        type="text"
                                        name="telegram_chat_id"
                                        placeholder={telegram.chatId || '-100123456789'}
                                        defaultValue={telegram.chatId}
                                        className="form-input"
                                    />
                                    <p className="text-[10px] mt-1" style={{ color: '#475569' }}>
                                        Cari via <a href="https://t.me/userinfobot" target="_blank" className="text-[#13a4ec] hover:underline">@userinfobot</a> atau dari getUpdates API
                                    </p>
                                </div>

                                <button type="submit" className="w-full py-2.5 text-sm font-bold rounded-lg text-white"
                                    style={{ backgroundColor: '#13a4ec' }}>
                                    Simpan Konfigurasi
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <div className="card p-5">
                            <h3 className="font-bold text-white mb-3">Cara Mendapatkan Chat ID</h3>
                            <ol className="space-y-3 text-sm" style={{ color: '#94a3b8' }}>
                                <li className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                        style={{ backgroundColor: 'rgba(19,164,236,0.15)', color: '#13a4ec' }}>1</span>
                                    <span>Chat ke <span className="text-white font-mono">@BotFather</span>, buat bot baru, dapatkan <span className="text-white">token</span>.</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                        style={{ backgroundColor: 'rgba(19,164,236,0.15)', color: '#13a4ec' }}>2</span>
                                    <span>Tambah bot ke grup/channel. Untuk grup, jadikan admin.</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                        style={{ backgroundColor: 'rgba(19,164,236,0.15)', color: '#13a4ec' }}>3</span>
                                    <span>Buka URL ini di browser (isi TOKEN dengan token bot kamu):</span>
                                </li>
                            </ol>
                            <code className="block mt-3 p-3 rounded-lg text-xs break-all" style={{ backgroundColor: 'rgba(255,255,255,0.04)', color: '#94a3b8' }}>
                                https://api.telegram.org/bot<span className="text-[#13a4ec]">TOKEN</span>/getUpdates
                            </code>
                            <p className="text-xs mt-3" style={{ color: '#475569' }}>
                                Cari field <span className="text-white font-mono">&quot;chat&quot;: {'{'}"id": <span className="text-[#10b981]">-100xxxxxxx</span>{'}'}</span> — angka itulah Chat ID-nya.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-8">
                    <h3 className="text-base font-bold text-white mb-1">Branding & Tampilan</h3>
                    <p className="text-xs mb-4" style={{ color: '#64748b' }}>Kustomisasi nama monitoring dan brand yang tampil di sidebar untuk organisasi Anda.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1 card p-5">
                            <h4 className="font-bold text-white mb-1">Nama Sidebar</h4>
                            <p className="text-xs mb-4" style={{ color: '#64748b' }}>Isi untuk mengganti nama default di sidebar kiri.</p>
                            <form action={saveBranding} className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>Nama Monitoring</label>
                                    <input type="text" name="monitoring_name"
                                        defaultValue={branding['monitoring_name'] || ''}
                                        placeholder="e.g. BGP Monitoring"
                                        className="form-input w-full" />
                                    <p className="text-[11px] mt-1" style={{ color: '#475569' }}>Tampil di sidebar sebagai subtitle logo</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>Nama Organisasi (Sidebar)</label>
                                    <input type="text" name="company_name"
                                        defaultValue={branding['company_name'] || ''}
                                        placeholder="e.g. PT Mitra Net"
                                        className="form-input w-full" />
                                    <p className="text-[11px] mt-1" style={{ color: '#475569' }}>Tampil di sidebar sebagai nama utama logo</p>
                                </div>
                                <button type="submit"
                                    className="w-full py-2 text-sm font-bold rounded-lg text-white"
                                    style={{ backgroundColor: '#13a4ec' }}>
                                    Simpan Branding
                                </button>
                            </form>
                        </div>
                        <div className="md:col-span-2 card p-5">
                            <h4 className="font-bold text-white mb-3">Preview Sidebar</h4>
                            <div className="flex items-center gap-3 p-4 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#13a4ec' }}>
                                    <span className="material-symbols-outlined text-white text-lg">hub</span>
                                </div>
                                <div>
                                    <p className="font-bold text-sm text-white">{branding['company_name'] || 'Nama Organisasi'}</p>
                                    <p className="text-xs" style={{ color: '#13a4ec' }}>{branding['monitoring_name'] || 'BGP Monitoring'}</p>
                                </div>
                            </div>
                            <p className="text-[11px] mt-3" style={{ color: '#475569' }}>
                                Perubahan akan tampil setelah menyimpan dan refresh halaman.
                            </p>
                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
}
