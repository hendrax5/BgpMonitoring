import { addUser, updateUser, deleteUser } from '@/app/actions/users';
import SubmitButton from '@/app/components/SubmitButton';
import { can } from '@/lib/rbac';

export default async function UsersTab({ session, users, editUserObj }: { session: any; users: any[]; editUserObj: any }) {
    return (
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
    );
}
