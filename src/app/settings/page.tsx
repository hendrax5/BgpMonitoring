import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { addRouterDevice, updateRouterDevice, deleteRouterDevice, getTelegramSettings, saveTelegramSettings, getBackupSettings, saveBackupSettings, addVendorProfile, updateVendorProfile, deleteVendorProfile } from '@/app/actions/settings';
import { addUser, updateUser, deleteUser, updateMyProfile } from '@/app/actions/users';
import SyncButton from '@/app/settings/components/SyncButton';
import RouterTestButton from '@/app/settings/components/RouterTestButton';
import ImportDevicesButton from '@/app/settings/components/ImportDevicesButton';
import SubmitButton from '@/app/components/SubmitButton';
import UserProfileDropdown from '@/app/components/UserProfileDropdown';
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

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; error?: string; success?: string; edit?: string; editUser?: string; editVendor?: string }> }) {
    const session = await requireSession();
    const { tab, error, success, edit, editUser, editVendor } = await searchParams;
    const activeTab = tab || 'profile';

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
            NOT: { role: 'superadmin' }, 
        },
        orderBy: { createdAt: 'desc' }
    });
    const editUserObj = editUserId ? users.find((u: any) => u.id === editUserId) : null;

    const telegram = await getTelegramSettings();
    const backupSettings = await getBackupSettings();

    const vendorProfiles = await (prisma as any).vendorProfile.findMany({
        orderBy: { vendorName: 'asc' }
    });
    const editVendorId = editVendor ? parseInt(editVendor) : null;
    const editVendorObj = editVendorId ? vendorProfiles.find((v: any) => v.id === editVendorId) : null;

    const brandingRows = await (prisma as any).appSettings.findMany({
        where: { tenantId: session.tenantId, key: { in: ['monitoring_name', 'company_name'] } }
    });
    const branding: Record<string, string> = Object.fromEntries(brandingRows.map((r: any) => [r.key, r.value]));

    const tabs = [
        { id: 'profile', label: 'My Profile', icon: 'person' },
        { id: 'devices', label: 'Monitored Routers', icon: 'router' },
        { id: 'users', label: 'User Management', icon: 'group' },
        { id: 'system', label: 'Alerts & Branding', icon: 'notifications_active' },
        { id: 'vendors', label: 'Universal Vendor Support', icon: 'extension' }
    ];

    return (
        <div className="min-h-screen bg-[#060a11] text-zinc-300">
            {/* Top Header */}
            <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 border-b border-white/5 bg-[#0d1520]">
                <div>
                    <h2 className="text-white font-bold text-base">Configuration Settings</h2>
                    <p className="text-xs text-zinc-400">Manage preferences and configurations.</p>
                </div>
                <div className="flex items-center gap-4">
                    <SyncButton />
                    <UserProfileDropdown username={session?.username} role={session?.role} />
                </div>
            </header>

            {/* Segmented Horizontal Tabs Navigation */}
            <div className="px-6 border-b border-white/5 bg-[#0a1019] sticky top-16 z-30 overflow-x-auto scrollbar-hide">
                <div className="flex gap-4">
                    {tabs.map(t => {
                        const isActive = activeTab === t.id;
                        return (
                            <a
                                key={t.id}
                                href={`/settings?tab=${t.id}`}
                                className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                                    isActive 
                                    ? 'border-blue-500 text-blue-500' 
                                    : 'border-transparent text-zinc-400 hover:text-white'
                                }`}
                            >
                                <span className="material-symbols-outlined text-[1.1rem]">{t.icon}</span>
                                {t.label}
                            </a>
                        );
                    })}
                </div>
            </div>

            <main className="p-6 max-w-6xl space-y-6 animate-fade-in mx-auto">

                {error && (
                    <div className="card px-4 py-3 flex items-center gap-3 bg-rose-500/10 border-rose-500/30 text-rose-400">
                        <span className="material-symbols-outlined text-lg">error</span>
                        <span className="text-sm">{error}</span>
                    </div>
                )}
                {success && activeTab === 'profile' && (
                    <div className="card px-4 py-3 flex items-center gap-3 bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
                        <span className="material-symbols-outlined text-lg">check_circle</span>
                        <span className="text-sm">Profile updated successfully.</span>
                    </div>
                )}

                {/* TAB: PROFILE */}
                {activeTab === 'profile' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="card p-6 border border-white/5 bg-white/5 backdrop-blur-xl rounded-2xl shadow-xl">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex flex-shrink-0 items-center justify-center text-2xl font-bold text-white uppercase shadow-lg">
                                    {session.username?.charAt(0) || 'U'}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">{session.username}</h3>
                                    <span className="px-2 py-0.5 mt-1 inline-block text-[10px] font-bold rounded-lg border bg-blue-500/10 border-blue-500/20 text-blue-400 uppercase tracking-wider">
                                        {session.role}
                                    </span>
                                </div>
                            </div>
                            <hr className="border-white/5 my-6" />
                            <h4 className="font-bold text-white mb-4">Change Password</h4>
                            <form action={async (formData: FormData) => {
                                'use server';
                                await updateMyProfile(formData);
                            }} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1">New Password</label>
                                    <input type="password" name="newPassword" placeholder="Enter a new password" required
                                        className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                                </div>
                                <SubmitButton className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-blue-900/20">
                                    Update Password
                                </SubmitButton>
                            </form>
                        </div>
                    </div>
                )}

                {/* TAB: DEVICES */}
                {activeTab === 'devices' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {can(session.role, 'device.manage') ? (
                            <div className="md:col-span-1">
                                <div className="card p-5 sticky top-20 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-xl">
                                    <h3 className="font-bold text-white mb-1">
                                        {editDevice ? 'Edit Router' : 'Add Monitored Router'}
                                    </h3>
                                    <p className="text-xs mb-5 text-zinc-400">
                                        {editDevice ? `Editing: ${editDevice.hostname}` : 'Add a device to be polled directly via SNMP/SSH.'}
                                    </p>

                                    <form action={async (formData: FormData) => {
                                        'use server';
                                        const id = formData.get('id');
                                        if (id) await updateRouterDevice(formData);
                                        else await addRouterDevice(formData);
                                    }} className="space-y-4">

                                        {editDevice && <input type="hidden" name="id" value={editDevice.id} />}
                                        <input type="hidden" name="redirectTab" value="devices" />

                                        <div>
                                            <label className="block text-xs font-medium text-zinc-400 mb-1">Hostname / Alias</label>
                                            <input type="text" name="hostname" placeholder="e.g. Core-Jakarta"
                                                defaultValue={editDevice?.hostname || ''}
                                                className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" required />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-400 mb-1">IP Address</label>
                                            <input type="text" name="ipAddress" placeholder="e.g. 10.10.10.1"
                                                defaultValue={editDevice?.ipAddress || ''}
                                                className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" required />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-zinc-400 mb-1">Vendor</label>
                                                <select name="vendor" className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" defaultValue={editDevice?.vendor || 'mikrotik'}>
                                                    <option value="mikrotik">MikroTik</option>
                                                    <option value="cisco">Cisco</option>
                                                    <option value="juniper">Juniper</option>
                                                    <option value="huawei">Huawei</option>
                                                    <option value="ruijie">Ruijie</option>
                                                    <option value="h3c">H3C</option>
                                                    <option value="zte">ZTE</option>
                                                    <option value="danos">DanOS</option>
                                                    <option value="vyos">VyOS</option>
                                                    {vendorProfiles
                                                        .filter((vp: any) => !['mikrotik', 'cisco', 'juniper', 'huawei', 'ruijie', 'h3c', 'zte', 'danos', 'vyos'].includes(vp.vendorName.toLowerCase()))
                                                        .map((vp: any) => (
                                                            <option key={vp.id} value={vp.vendorName}>{vp.vendorName.toUpperCase()}</option>
                                                        ))
                                                    }
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-zinc-400 mb-1">Polling Method</label>
                                                <select name="pollMethod" className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" defaultValue={editDevice?.pollMethod || 'snmp_ssh_mix'}>
                                                    <option value="snmp_ssh_mix">SNMP + SSH</option>
                                                    <option value="snmp_only">SNMP Only</option>
                                                    <option value="ssh_only">SSH Only</option>
                                                    <option value="telnet_only">Telnet Only</option>
                                                    <option value="snmp_telnet_mix">SNMP + Telnet</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 mt-4">
                                            <label className="flex items-center gap-2 text-xs font-medium text-zinc-300 cursor-pointer">
                                                <input type="checkbox" name="isBgpMonitoring" 
                                                    defaultChecked={editDevice ? editDevice.isBgpMonitoring : true} 
                                                    className="w-4 h-4 rounded text-blue-500 bg-gray-800 border-gray-600 focus:ring-blue-500" />
                                                Enable BGP
                                            </label>
                                            <label className="flex items-center gap-2 text-xs font-medium text-zinc-300 cursor-pointer">
                                                <input type="checkbox" name="isConfigBackup" 
                                                    defaultChecked={editDevice ? editDevice.isConfigBackup : true} 
                                                    className="w-4 h-4 rounded text-blue-500 bg-gray-800 border-gray-600 focus:ring-blue-500" />
                                                Config Backup
                                            </label>
                                        </div>

                                        <hr className="border-white/5 my-3" />

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-zinc-400 mb-1">SNMP Version</label>
                                                <select name="snmpVersion" className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" defaultValue={editDevice?.snmpVersion || 'v2c'}>
                                                    <option value="v2c">v2c</option>
                                                    <option value="v3">v3</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-zinc-400 mb-1">SNMP Port</label>
                                                <input type="number" name="snmpPort" placeholder="161"
                                                    defaultValue={editDevice?.snmpPort || 161}
                                                    className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-400 mb-1">SNMP Community</label>
                                            <input type="password" name="snmpCommunity" placeholder="••••••••"
                                                defaultValue={editDevice?.snmpCommunity || ''}
                                                className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
                                        </div>

                                        <hr className="border-white/5 my-3" />

                                        <div className="space-y-1 mb-1">
                                            <p className="text-xs font-semibold text-blue-400">SSH Credentials</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-zinc-400 mb-1">SSH Username</label>
                                                <input type="text" name="sshUser" placeholder="admin"
                                                    defaultValue={editDevice?.sshCredential?.sshUser || ''}
                                                    className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" autoComplete="off" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-zinc-400 mb-1">SSH Port</label>
                                                <input type="number" name="sshPort" placeholder="22"
                                                    defaultValue={editDevice?.sshCredential?.sshPort || 22}
                                                    className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-400 mb-1">SSH Password</label>
                                            <input type="password" name="sshPass"
                                                placeholder={editDevice?.sshCredential ? '(saved, leave blank to keep)' : '••••••••'}
                                                className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" autoComplete="new-password" />
                                        </div>

                                        <div className="flex gap-2 pt-2">
                                            <SubmitButton className="flex-1 py-2 text-sm font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-500"
                                                pendingText={editDevice ? 'Updating...' : 'Saving...'}>
                                                {editDevice ? 'Update' : 'Save'}
                                            </SubmitButton>
                                            {editDevice && (
                                                <a href="/settings?tab=devices" className="flex items-center justify-center px-4 py-2 text-sm rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
                                                    Cancel
                                                </a>
                                            )}
                                        </div>
                                    </form>
                                </div>
                            </div>
                        ) : (
                            <div className="md:col-span-1">
                                <div className="card p-5 border border-amber-500/20 bg-amber-500/5 rounded-2xl">
                                    <span className="material-symbols-outlined text-2xl block mb-2 text-amber-500">lock</span>
                                    <h3 className="font-bold text-white mb-1">Device Management</h3>
                                    <p className="text-xs text-zinc-400">Only OrgAdmin and SuperAdmin can modify devices.</p>
                                </div>
                            </div>
                        )}

                        <div className="md:col-span-2 card bg-white/5 border border-white/5 rounded-2xl overflow-hidden self-start backdrop-blur-xl">
                            <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center">
                                <div>
                                    <h2 className="font-bold text-white">Monitored Routers</h2>
                                    <p className="text-xs mt-0.5 text-zinc-400">Direct polling targets.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <a
                                        href="/api/devices/export"
                                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-sm">download</span>
                                        CSV
                                    </a>
                                    <ImportDevicesButton />
                                </div>
                            </div>

                            {devices.length === 0 ? (
                                <div className="p-12 text-center text-zinc-500">
                                    <span className="material-symbols-outlined text-4xl block mb-3">router</span>
                                    <p className="font-medium text-white mb-1">No routers configured</p>
                                    <p className="text-sm text-zinc-400">Add your first target router on the left.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                        <thead className="text-xs uppercase bg-black/20 text-zinc-400">
                                            <tr>
                                                <th className="px-4 py-3">Hostname & IP</th>
                                                <th className="px-4 py-3">Vendor / Method</th>
                                                <th className="px-4 py-3">SNMP / SSH</th>
                                                <th className="px-4 py-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {devices.map((device: any) => (
                                                <tr key={device.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="font-bold text-white">{device.hostname}</div>
                                                        <code className="text-xs font-mono text-zinc-500">{device.ipAddress}</code>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="text-sm text-white capitalize">{device.vendor}</div>
                                                        <div className="text-[10px] px-1.5 py-0.5 rounded mt-0.5 inline-block bg-blue-500/10 text-blue-400">
                                                            {device.pollMethod.replace(/_/g, ' ')}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {device.snmpCommunity ? (
                                                            <div className="flex items-center gap-1.5 mb-1">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                                <span className="text-xs text-zinc-400">SNMP v{device.snmpVersion}</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 mb-1">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                                                                <span className="text-xs text-zinc-600">No SNMP</span>
                                                            </div>
                                                        )}
                                                        {device.sshCredential ? (
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                                <span className="text-xs text-zinc-400">SSH User: {device.sshCredential.sshUser}</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                                                                <span className="text-xs text-zinc-600">No SSH</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <RouterTestButton routerId={device.id} />
                                                            {can(session.role, 'device.manage') && (
                                                                <>
                                                                    <a href={`/settings?tab=devices&edit=${device.id}`}
                                                                        className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20" title="Edit">
                                                                        <span className="material-symbols-outlined text-[1rem]">edit</span>
                                                                    </a>
                                                                    <form action={async () => {
                                                                        'use server';
                                                                        await deleteRouterDevice(device.id);
                                                                    }}>
                                                                        <button type="submit" className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20" title="Delete">
                                                                            <span className="material-symbols-outlined text-[1rem]">delete</span>
                                                                        </button>
                                                                    </form>
                                                                </>
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
                )}

                {/* TAB: USERS */}
                {activeTab === 'users' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1">
                            <div className="card p-5 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-xl">
                                <h3 className="font-bold text-white mb-1">
                                    {can(session.role, 'user.manageTenant') ? (editUserObj ? 'Edit User' : 'Add App User') : 'Users'}
                                </h3>
                                <p className="text-xs mb-5 text-zinc-400">
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
                                        <input type="hidden" name="redirectTab" value="users" />

                                        <div>
                                            <label className="block text-xs font-medium text-zinc-400 mb-1">Username</label>
                                            <input type="text" name="username" placeholder="e.g. jdoe"
                                                defaultValue={editUserObj?.username || ''}
                                                className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" required />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-400 mb-1">
                                                Password {editUserObj && <span className="text-[10px] text-amber-500">(Leave blank to keep current)</span>}
                                            </label>
                                            <input type="password" name="password" placeholder="••••••••"
                                                className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" required={!editUserObj} />
                                        </div>

                                        {!editUserObj && (
                                            <div>
                                                <label className="block text-xs font-medium text-zinc-400 mb-1">Role</label>
                                                <select name="role" className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" defaultValue="viewer">
                                                    <option value="orgadmin">OrgAdmin</option>
                                                    <option value="networkengineer">Network Engineer</option>
                                                    <option value="viewer">Viewer</option>
                                                </select>
                                                <p className="text-[10px] mt-1 text-zinc-500">Superadmins globally managed.</p>
                                            </div>
                                        )}

                                        <div className="pt-2 flex gap-2">
                                            <SubmitButton className="flex-1 py-2 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white"
                                                pendingText={editUserObj ? 'Updating...' : 'Saving...'}>
                                                {editUserObj ? 'Update' : 'Save'}
                                            </SubmitButton>
                                            {editUserObj && (
                                                <a href="/settings?tab=users" className="flex-1 py-2 text-center rounded-xl text-sm font-bold bg-white/5 hover:bg-white/10 text-white">
                                                    Cancel
                                                </a>
                                            )}
                                        </div>
                                    </form>
                                )}
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <div className="card overflow-hidden bg-white/5 border border-white/5 rounded-2xl backdrop-blur-xl">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="text-xs uppercase bg-black/20 text-zinc-400">
                                        <tr>
                                            <th className="px-4 py-3">Username</th>
                                            <th className="px-4 py-3">Role</th>
                                            <th className="px-4 py-3">Registered</th>
                                            <th className="px-4 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {users.map((u: any) => (
                                            <tr key={u.id} className="hover:bg-white/5 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-white flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-[1rem] text-zinc-400">person</span>
                                                        {u.username}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                                                        u.role === 'superadmin' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                                                        : u.role === 'orgadmin' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                                        : u.role === 'networkengineer' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                                        : 'bg-white/5 border-white/10 text-zinc-400'
                                                    }`}>
                                                        {u.role}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="text-xs text-zinc-400">{u.createdAt.toLocaleDateString()}</div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <a href={`/settings?tab=users&editUser=${u.id}`} className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20" title="Edit">
                                                            <span className="material-symbols-outlined text-[1rem]">edit</span>
                                                        </a>
                                                        <form action={async () => {
                                                            'use server';
                                                            await deleteUser(u.id);
                                                        }}>
                                                            <button type="submit" className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20" title="Delete">
                                                                <span className="material-symbols-outlined text-[1rem]">delete</span>
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
                )}

                {/* TAB: SYSTEM & BRANDING */}
                {activeTab === 'system' && (
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-1 card p-5 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-xl">
                                <h4 className="font-bold text-white mb-1">Company Branding</h4>
                                <p className="text-xs mb-4 text-zinc-400">Customizes the sidebar logo names.</p>
                                <form action={saveBranding} className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1">Company Name</label>
                                        <input type="text" name="company_name" defaultValue={branding['company_name'] || ''} placeholder="e.g. Acme Corp"
                                            className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1">Monitoring Subtitle</label>
                                        <input type="text" name="monitoring_name" defaultValue={branding['monitoring_name'] || ''} placeholder="e.g. Global BGP Monitor"
                                            className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
                                    </div>
                                    <SubmitButton className="w-full py-2 text-sm font-bold rounded-xl text-white bg-blue-600">Simpan Branding</SubmitButton>
                                </form>
                            </div>

                            <div className="md:col-span-1 card p-5 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-xl">
                                <h4 className="font-bold text-white mb-1">Backup Config</h4>
                                <p className="text-xs mb-4 text-zinc-400">Automated fetch polling interval.</p>
                                <form action={async (formData: FormData) => { 'use server'; await saveBackupSettings(formData); }} className="space-y-3">
                                    <label className="block text-xs font-medium text-zinc-400 mb-1">Interval Cron Job</label>
                                    <select name="backup_interval_cron" defaultValue={backupSettings.intervalCron} className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white">
                                        <option value="0 * * * *">Every Hour</option>
                                        <option value="0 */2 * * *">Every 2 Hours</option>
                                        <option value="0 */6 * * *">Every 6 Hours</option>
                                        <option value="0 0 * * *">Every Midnight</option>
                                    </select>
                                    <SubmitButton className="w-full py-2 text-sm font-bold rounded-xl text-white bg-blue-600">Simpan Interval</SubmitButton>
                                </form>
                            </div>

                            <div className="md:col-span-1 card p-5 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-xl">
                                <h4 className="font-bold text-white mb-1 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-blue-400 text-lg">send</span>
                                    Telegram Alerts
                                </h4>
                                <p className="text-xs mb-4 text-zinc-400">Receive BGP Down/Up events. {telegram.botToken && <span className="text-emerald-400">✓ Configured</span>}</p>
                                <form action={async (formData: FormData) => { 'use server'; await saveTelegramSettings(formData); }} className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1">Bot Token</label>
                                        <input type="password" name="telegram_bot_token" placeholder={telegram.botToken ? '(Tersimpan)' : '123456:ABC...'}
                                            className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1">Chat / Group ID</label>
                                        <input type="text" name="telegram_chat_id" placeholder={telegram.chatId || '-100XXXX'} defaultValue={telegram.chatId}
                                            className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
                                    </div>
                                    <SubmitButton className="w-full py-2 text-sm font-bold rounded-xl text-white bg-blue-600">Simpan Telegram</SubmitButton>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: VENDORS */}
                {activeTab === 'vendors' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1 card p-5 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-xl">
                            <h4 className="font-bold text-white mb-2">{editVendorObj ? 'Edit Vendor Profile' : 'Add Vendor Profile'}</h4>
                            <p className="text-xs mb-4 text-zinc-400">Define custom connection parameters for automated remote config fetch.</p>
                            <form action={async (formData: FormData) => {
                                'use server';
                                const id = formData.get('id');
                                if (id) await updateVendorProfile(formData);
                                else await addVendorProfile(formData);
                            }} className="space-y-3">
                                {editVendorObj && <input type="hidden" name="id" value={editVendorObj.id} />}
                                <input type="hidden" name="redirectTab" value="vendors" />
                                
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1">Vendor ID / Name</label>
                                    <input type="text" name="vendorName" placeholder="e.g. zte-olt" 
                                        defaultValue={editVendorObj?.vendorName || ''}
                                        className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white lowercase" required />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1">Connection Mode</label>
                                    <select name="connectionMode" className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" defaultValue={editVendorObj?.connectionMode || 'exec'}>
                                        <option value="exec">SSH Exec (Batch Mode - MikroTik/IOS)</option>
                                        <option value="shell">SSH Interactive Shell (ZTE/H3C/Huawei)</option>
                                        <option value="telnet">Telnet (Legacy devices)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1">Config Fetch Command</label>
                                    <input type="text" name="backupCommand" placeholder="e.g. show running-config" 
                                        defaultValue={editVendorObj?.backupCommand || ''}
                                        className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" required />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1">Disable Paging Command</label>
                                    <input type="text" name="disablePagingCmd" placeholder="e.g. terminal length 0" 
                                        defaultValue={editVendorObj?.disablePagingCmd || ''}
                                        className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
                                </div>
                                <div className="flex gap-2 mt-4">
                                    <SubmitButton className="flex-1 py-2 text-sm font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-500" pendingText="Saving...">
                                        {editVendorObj ? 'Update' : 'Save'}
                                    </SubmitButton>
                                    {editVendorObj && (
                                        <a href="/settings?tab=vendors" className="flex-1 py-2 text-center rounded-xl text-sm font-bold bg-white/5 hover:bg-white/10 text-zinc-400 transition-colors">
                                            Cancel
                                        </a>
                                    )}
                                </div>
                            </form>
                        </div>
                        
                        <div className="md:col-span-2 card overflow-hidden bg-white/5 border border-white/5 rounded-2xl backdrop-blur-xl">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="text-xs uppercase bg-black/20 text-zinc-400">
                                    <tr>
                                        <th className="px-4 py-3">Vendor Name</th>
                                        <th className="px-4 py-3">Connection</th>
                                        <th className="px-4 py-3">Fetch Command</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {vendorProfiles.map((v: any) => (
                                        <tr key={v.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-white lowercase">{v.vendorName}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 text-[10px] rounded-lg border block w-fit ${v.connectionMode === 'shell' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                                                    {v.connectionMode.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <code className="text-xs px-2 py-1 bg-black/30 rounded-lg text-zinc-400">{v.backupCommand}</code>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {can(session.role, 'device.manage') && (
                                                        <>
                                                            <a href={`/settings?tab=vendors&editVendor=${v.id}`} className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20" title="Edit">
                                                                <span className="material-symbols-outlined text-[1rem]">edit</span>
                                                            </a>
                                                            <form action={async () => {
                                                                'use server';
                                                                await deleteVendorProfile(v.id);
                                                            }}>
                                                                <button type="submit" className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20" title="Delete">
                                                                    <span className="material-symbols-outlined text-[1rem]">delete</span>
                                                                </button>
                                                            </form>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {vendorProfiles.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="text-center p-6 text-zinc-500 text-sm">
                                                No vendor profiles defined. Define custom interaction models here.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

