import { addVendorProfile, updateVendorProfile, deleteVendorProfile } from '@/app/actions/settings';
import SubmitButton from '@/app/components/SubmitButton';
import { can } from '@/lib/rbac';

export default async function VendorsTab({ session, vendorProfiles, editVendorObj }: { session: any; vendorProfiles: any[]; editVendorObj: any }) {
    return (
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
    );
}
