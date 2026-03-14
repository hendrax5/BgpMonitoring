import { prisma } from '@/lib/prisma';
import { addRouterDevice, updateRouterDevice, deleteRouterDevice, getTelegramSettings, saveTelegramSettings } from '@/app/actions/settings';
import { addUser, updateUser, deleteUser } from '@/app/actions/users';
import SyncButton from '@/app/settings/components/SyncButton';

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; edit?: string; editUser?: string }> }) {
    const { error, edit, editUser } = await searchParams;
    const editId = edit ? parseInt(edit) : null;
    const devices = await prisma.routerDevice.findMany({ 
        orderBy: { createdAt: 'desc' },
        include: { sshCredential: true } // Include to show linked credentials
    });
    const editDevice = editId ? devices.find((d: any) => d.id === editId) : null;

    const credentials = await prisma.deviceCredential.findMany({ orderBy: { deviceIp: 'asc' } });

    const editUserId = editUser ? parseInt(editUser) : null;
    const users = await prisma.appUser.findMany({ orderBy: { createdAt: 'desc' } });
    const editUserObj = editUserId ? users.find(u => u.id === editUserId) : null;

    const telegram = await getTelegramSettings();

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

                                <div>
                                    <label className="block text-xs font-medium mb-1 flex justify-between" style={{ color: '#64748b' }}>
                                        <span>Link SSH Credential</span>
                                        <a href="/settings/devices" className="text-[#13a4ec] hover:underline" target="_blank">Manage</a>
                                    </label>
                                    <select name="sshCredentialId" className="form-input" defaultValue={editDevice?.sshCredentialId?.toString() || ''}>
                                        <option value="">— None (SNMP Only) —</option>
                                        {credentials.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.sshUser}@{c.deviceIp} ({c.vendor}) {c.notes ? `- ${c.notes}` : ''}
                                            </option>
                                        ))}
                                    </select>
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

                    {/* Configured Devices List */}
                    <div className="md:col-span-2 card overflow-hidden self-start">
                        <div className="px-5 py-4 border-b flex justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                            <div>
                                <h2 className="font-bold text-white">Monitored Routers</h2>
                                <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>Worker polls these devices directly.</p>
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
                                            <th>Method & Vendor</th>
                                            <th>SNMP Cred</th>
                                            <th>SSH Link</th>
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
                                                    <div className="text-xs" style={{ color: '#64748b' }}>{device.pollMethod.replace(/_/g, ' ')}</div>
                                                </td>
                                                <td>
                                                    <div className="flex items-center gap-1">
                                                        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: device.snmpCommunity ? '#10b981' : '#475569' }}></span>
                                                        <span className="text-[10px]" style={{ color: '#64748b' }}>{device.snmpVersion}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    {device.sshCredential ? (
                                                        <div className="text-xs flex flex-col">
                                                            <span className="text-white">{device.sshCredential.sshUser}</span>
                                                            <span style={{ color: '#64748b' }}>{device.sshCredential.deviceIp}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs" style={{ color: '#475569' }}>None</span>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <div className="flex items-center justify-end gap-1">
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

                {/* User Management */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1">
                        <div className="card p-5">
                            <h3 className="font-bold text-white mb-1">
                                {editUserObj ? 'Edit User' : 'Add App User'}
                            </h3>
                            <p className="text-xs mb-5" style={{ color: '#64748b' }}>
                                {editUserObj ? `Editing: ${editUserObj.username}` : 'Create an account to access this dashboard.'}
                            </p>

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
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <div className="card overflow-hidden">
                            <table className="w-full data-table">
                                <thead>
                                    <tr>
                                        <th>Username</th>
                                        <th>Registered</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((u) => (
                                        <tr key={u.id}>
                                            <td>
                                                <div className="font-bold text-white flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-[1rem]" style={{ color: '#94a3b8' }}>person</span>
                                                    {u.username}
                                                </div>
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

            </main>
        </div>
    );
}
