import React from 'react';
import { format } from 'date-fns';

interface Device {
    id: number;
    hostname: string;
    ipAddress: string;
    vendor: string;
    lastBackupDate: string | null;
    isCompliant: boolean | null;
}

interface Props {
    devices: Device[];
    selectedDeviceId: number | null;
    onSelectDevice: (device: Device) => void;
}

export default function DeviceTable({ devices, selectedDeviceId, onSelectDevice }: Props) {
    return (
        <div className="bg-[#0f172a]/60 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-800/80 animate-fade-in w-full overflow-hidden ring-1 ring-white/5">
            <div className="p-6 border-b border-zinc-800/60 flex justify-between items-center">
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
                    <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>
                    Network Devices
                </h2>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-[#060a11]/80 text-xs font-black text-zinc-400 uppercase tracking-wider border-b border-zinc-800/60">
                        <tr>
                            <th className="py-4 pl-6 font-medium">Hostname</th>
                            <th className="py-4 font-medium">IP Address</th>
                            <th className="py-4 font-medium">Vendor</th>
                            <th className="py-4 font-medium">Compliance</th>
                            <th className="py-4 font-medium">Last Scheduled Backup</th>
                            <th className="py-4 pr-6 font-medium text-right">Action</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-zinc-800/40">
                        {devices.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="py-12 text-center text-zinc-500 font-medium tracking-wide">No devices found in this tenant.</td>
                            </tr>
                        ) : (
                            devices.map((d) => {
                                const isSelected = selectedDeviceId === d.id;
                                return (
                                    <tr 
                                        key={d.id} 
                                        onClick={() => onSelectDevice(d)}
                                        className={`transition-colors cursor-pointer group ${isSelected ? 'bg-indigo-500/10' : 'hover:bg-white/5'}`}
                                    >
                                        <td className="py-4 pl-6 relative">
                                            {/* Glow indicator for selected */}
                                            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-r-full transition-all ${isSelected ? 'bg-indigo-500' : 'bg-transparent'}`} />
                                            <div className="font-semibold text-white flex items-center gap-2">
                                                {d.hostname}
                                            </div>
                                        </td>
                                        <td className="py-4 text-indigo-300 font-mono text-xs max-w-[120px] truncate">{d.ipAddress}</td>
                                        <td className="py-4">
                                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-zinc-800 text-zinc-300 ring-1 ring-zinc-700 capitalize">
                                                {d.vendor}
                                            </span>
                                        </td>
                                        <td className="py-4">
                                            {d.isCompliant === true ? (
                                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 whitespace-nowrap">Compliant</span>
                                            ) : d.isCompliant === false ? (
                                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 ring-1 ring-red-500/20 whitespace-nowrap">Violations Found</span>
                                            ) : (
                                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700 whitespace-nowrap">Pending Scan</span>
                                            )}
                                        </td>
                                        <td className="py-4 text-zinc-400 font-mono text-xs">
                                            {d.lastBackupDate ? format(new Date(d.lastBackupDate), 'yyyy-MM-dd HH:mm') : <span className="text-zinc-500 italic">Never</span>}
                                        </td>
                                        <td className="py-4 pr-6 text-right">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onSelectDevice(d); }}
                                                className={`text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-sm ${isSelected ? 'bg-indigo-600 text-white shadow-indigo-600/30' : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700/50'}`}
                                            >
                                                Manage
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
