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
        <div className="bg-zinc-900 rounded-2xl p-4 shadow-lg border border-zinc-800 animate-fade-in w-full overflow-x-auto">
            <h2 className="text-lg font-semibold mb-4 text-zinc-100 flex items-center gap-2">
                <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>
                Network Devices
            </h2>

            <table className="w-full text-sm text-left">
                <thead className="text-zinc-400 border-b border-zinc-800">
                    <tr>
                        <th className="pb-3 pl-2 font-medium">Name</th>
                        <th className="pb-3 font-medium">IP Address</th>
                        <th className="pb-3 font-medium">Vendor</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium">Last Backup</th>
                        <th className="pb-3 pr-2 font-medium text-right">Action</th>
                    </tr>
                </thead>

                <tbody>
                    {devices.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="py-8 text-center text-zinc-500">No devices found.</td>
                        </tr>
                    ) : (
                        devices.map((d) => {
                            const isSelected = selectedDeviceId === d.id;
                            return (
                                <tr 
                                    key={d.id} 
                                    onClick={() => onSelectDevice(d)}
                                    className={`border-b border-zinc-800/50 hover:bg-zinc-800/80 cursor-pointer transition-colors ${isSelected ? 'bg-zinc-800 border-l-2 border-l-blue-500' : 'border-l-2 border-l-transparent'}`}
                                >
                                    <td className="py-3 pl-2 font-medium text-blue-400">{d.hostname}</td>
                                    <td className="py-3 text-zinc-300 font-mono text-xs">{d.ipAddress}</td>
                                    <td className="py-3 text-zinc-400 capitalize">{d.vendor}</td>
                                    <td className="py-3">
                                        {d.isCompliant === true ? (
                                            <span className="text-green-400 flex items-center gap-1 text-xs"><span className="w-2 h-2 rounded-full bg-green-500"></span> Healthy</span>
                                        ) : d.isCompliant === false ? (
                                            <span className="text-red-400 flex items-center gap-1 text-xs"><span className="w-2 h-2 rounded-full bg-red-500"></span> Violations</span>
                                        ) : (
                                            <span className="text-zinc-500 flex items-center gap-1 text-xs"><span className="w-2 h-2 rounded-full bg-zinc-600"></span> Unaudited</span>
                                        )}
                                    </td>
                                    <td className="py-3 text-zinc-400 text-xs">
                                        {d.lastBackupDate ? format(new Date(d.lastBackupDate), 'yyyy-MM-dd HH:mm') : <span className="text-zinc-500 italic">Never</span>}
                                    </td>
                                    <td className="py-3 pr-2 text-right">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onSelectDevice(d); }}
                                            className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded transition-colors"
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
    );
}
