import { addRouterDevice, updateRouterDevice, deleteRouterDevice } from '@/app/actions/settings';
import RouterTestButton from '@/app/settings/components/RouterTestButton';
import ImportDevicesButton from '@/app/settings/components/ImportDevicesButton';
import SubmitButton from '@/app/components/SubmitButton';
import { can } from '@/lib/rbac';

export default async function DevicesTab({ session, devices, editDevice, vendorProfiles }: { session: any, devices: any[], editDevice: any, vendorProfiles: any[] }) {
    return (
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
                                                    <span className="text-xs text-zinc-400">CLI User: {device.sshCredential.sshUser}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                                                    <span className="text-xs text-zinc-600">No CLI Creds</span>
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
    );
}
