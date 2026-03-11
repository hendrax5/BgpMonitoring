import { prisma } from '@/lib/prisma';
import { addLibrenmsServer, updateLibrenmsServer, deleteLibrenmsServer } from '@/app/actions/settings';
import { addUser, updateUser, deleteUser } from '@/app/actions/users';

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; edit?: string; editUser?: string }> }) {
    const { error, edit, editUser } = await searchParams;
    const editId = edit ? parseInt(edit) : null;
    const servers = await prisma.librenmsServer.findMany({ orderBy: { createdAt: 'desc' } });
    const editServer = editId ? servers.find(s => s.id === editId) : null;

    const editUserId = editUser ? parseInt(editUser) : null;
    const users = await prisma.appUser.findMany({ orderBy: { createdAt: 'desc' } });
    const editUserObj = editUserId ? users.find(u => u.id === editUserId) : null;

    return (
        <div className="min-h-screen">
            {/* Top Header */}
            <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 border-b"
                style={{ backgroundColor: '#0d1520', borderColor: 'rgba(255,255,255,0.07)' }}>
                <div>
                    <h2 className="text-white font-bold text-base">Configuration Settings</h2>
                    <p className="text-xs" style={{ color: '#64748b' }}>Manage LibreNMS API targets and SSH credentials.</p>
                </div>
                <a href="/" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                    style={{ color: '#64748b', border: '1px solid rgba(255,255,255,0.07)' }}>
                    ← Dashboard
                </a>
            </header>

            <main className="p-6 max-w-5xl space-y-6 animate-fade-in">

                {error && (
                    <div className="card px-4 py-3 flex items-center gap-3" style={{ borderColor: 'rgba(244,63,94,0.3)', backgroundColor: 'rgba(244,63,94,0.08)' }}>
                        <span className="material-symbols-outlined text-lg" style={{ color: '#f43f5e' }}>error</span>
                        <span className="text-sm" style={{ color: '#f43f5e' }}>{error}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    <div className="md:col-span-1">
                        <div className="card p-5">
                            <h3 className="font-bold text-white mb-1">
                                {editServer ? 'Edit API Target' : 'Add API Target'}
                            </h3>
                            <p className="text-xs mb-5" style={{ color: '#64748b' }}>
                                {editServer ? `Editing: ${editServer.name}` : 'Connect a LibreNMS server to sync BGP sessions.'}
                            </p>

                            <form action={async (formData: FormData) => {
                                'use server';
                                const id = formData.get('id');
                                if (id) await updateLibrenmsServer(formData);
                                else await addLibrenmsServer(formData);
                            }} className="space-y-4">

                                {editServer && <input type="hidden" name="id" value={editServer.id} />}

                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>Target Name</label>
                                    <input type="text" name="name" placeholder="e.g. Core-Jakarta"
                                        defaultValue={editServer?.name || ''}
                                        className="form-input" required />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>LibreNMS API URL</label>
                                    <input type="text" name="apiUrl" placeholder="https://librenms.org/api/v0"
                                        defaultValue={editServer?.apiUrl || ''}
                                        className="form-input" required />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: '#64748b' }}>API Token</label>
                                    <input type="password" name="apiToken" placeholder={editServer ? '(leave blank to keep current)' : '••••••••••••'}
                                        className="form-input" required={!editServer} />
                                </div>

                                <div className="flex gap-2">
                                    <button type="submit" className="flex-1 py-2.5 text-sm font-bold rounded-lg text-white"
                                        style={{ backgroundColor: '#13a4ec' }}>
                                        {editServer ? 'Update Target' : 'Save API Target'}
                                    </button>
                                    {editServer && (
                                        <a href="/settings" className="flex items-center justify-center px-4 py-2.5 text-sm rounded-lg"
                                            style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                                            Cancel
                                        </a>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Configured Servers List */}
                    <div className="md:col-span-2 card overflow-hidden self-start">
                        <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                            <h2 className="font-bold text-white">Configured Servers</h2>
                            <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>Worker iterates all servers every minute.</p>
                        </div>

                        {servers.length === 0 ? (
                            <div className="p-12 text-center">
                                <span className="material-symbols-outlined text-4xl block mb-3" style={{ color: '#334155' }}>dns</span>
                                <p className="font-medium text-white mb-1">No servers configured</p>
                                <p className="text-sm" style={{ color: '#475569' }}>Add your first LibreNMS target on the left.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full data-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>API URL</th>
                                            <th style={{ textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {servers.map((server) => (
                                            <tr key={server.id}>
                                                <td>
                                                    <div className="font-bold text-white">{server.name}</div>
                                                    <div className="text-xs" style={{ color: '#64748b' }}>{server.createdAt.toLocaleDateString()}</div>
                                                </td>
                                                <td>
                                                    <code className="text-xs font-mono break-all" style={{ color: '#94a3b8' }}>{server.apiUrl}</code>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#10b981' }}></span>
                                                        <span className="text-[10px]" style={{ color: '#64748b' }}>Token configured</span>
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        {/* Edit */}
                                                        <a href={`/settings?edit=${server.id}`}
                                                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                                                            style={{ color: '#13a4ec', backgroundColor: 'rgba(19,164,236,0.08)' }}
                                                            title="Edit">
                                                            <span className="material-symbols-outlined text-sm">edit</span>
                                                            Edit
                                                        </a>
                                                        {/* Delete */}
                                                        <form action={async () => {
                                                            'use server';
                                                            await deleteLibrenmsServer(server.id);
                                                        }}>
                                                            <button type="submit"
                                                                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                                                                style={{ color: '#f43f5e', backgroundColor: 'rgba(244,63,94,0.08)' }}
                                                                title="Delete">
                                                                <span className="material-symbols-outlined text-sm">delete</span>
                                                                Delete
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

                {/* Device Credentials Link */}
                <div className="card p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(19,164,236,0.12)', color: '#13a4ec' }}>
                            <span className="material-symbols-outlined text-xl">device_hub</span>
                        </div>
                        <div>
                            <h3 className="font-bold text-white">Device SSH Credentials</h3>
                            <p className="text-xs" style={{ color: '#64748b' }}>Add per-device SSH credentials for Live Check feature</p>
                        </div>
                    </div>
                    <a href="/settings/devices" className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg"
                        style={{ backgroundColor: '#13a4ec', color: 'white' }}>
                        Manage →
                    </a>
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
                                                        Edit
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
                                                            Delete
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

            </main>
        </div>
    );
}
