'use client';

import React, { useState, useEffect } from 'react';
import DeviceTable from './v2/DeviceTable';
import DeviceSidePanel from './v2/DeviceSidePanel';
import ConfigDiffViewer from './v2/ConfigDiffViewer';
import RollbackModal from './v2/RollbackModal';

// Simple Toast Notification Component
const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const colors = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        info: 'bg-blue-600'
    };

    return (
        <div className={`fixed bottom-6 right-6 ${colors[type]} text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in z-[300]`}>
            {type === 'success' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
            {type === 'error' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
            {type === 'info' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            <div className="font-medium text-sm">{message}</div>
        </div>
    );
};

export default function ConfigDevices({ userRole }: { userRole: string }) {
    const [devices, setDevices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Superadmin Tenant Filter
    const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
    const [selectedTenant, setSelectedTenant] = useState<string>('all');

    const [selectedDevice, setSelectedDevice] = useState<any | null>(null);
    const [deviceBackups, setDeviceBackups] = useState<any[]>([]);
    const [loadingBackups, setLoadingBackups] = useState(false);
    const [isBackupping, setIsBackupping] = useState(false);

    // Modals & Views State
    const [diffVersion, setDiffVersion] = useState<{ left: any, right: any } | null>(null);
    const [rollbackTarget, setRollbackTarget] = useState<any | null>(null);
    const [viewedConfig, setViewedConfig] = useState<string | null>(null);

    // Toast State
    const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

    const fetchDevices = () => {
        const url = userRole === 'superadmin' ? `/api/config-management/devices?tenantId=${selectedTenant}` : '/api/config-management/devices';
        fetch(url)
            .then(r => r.json())
            .then(d => {
                if (d.devices) setDevices(d.devices);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => { fetchDevices(); }, [selectedTenant, userRole]);

    useEffect(() => {
        if (userRole === 'superadmin') {
            fetch('/api/tenants').then(r => r.json()).then(d => {
                if (d.tenants) setTenants(d.tenants);
            });
        }
    }, [userRole]);

    const handleSelectDevice = async (device: any) => {
        setSelectedDevice(device);
        setLoadingBackups(true);
        setDeviceBackups([]);
        try {
            const res = await fetch(`/api/config-management/backups?deviceId=${device.id}`);
            const d = await res.json();
            if (d.backups) setDeviceBackups(d.backups);
        } catch (e) {
            console.error(e);
        }
        setLoadingBackups(false);
    };

    const handleBackupNow = async () => {
        if (!selectedDevice) return;
        setIsBackupping(true);
        setToast({ message: `Triggering backup job for ${selectedDevice.hostname}...`, type: 'info' });
        try {
            const res = await fetch('/api/config-management/backup-now', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId: selectedDevice.id })
            });
            const data = await res.json();
            if (data.success) {
                setToast({ message: `Successfully requested backup.`, type: 'success' });
                // Re-fetch backups
                handleSelectDevice(selectedDevice);
            } else {
                setToast({ message: `Failed: ${data.error}`, type: 'error' });
            }
        } catch (e) {
            setToast({ message: 'Network error occurred.', type: 'error' });
        }
        setIsBackupping(false);
    };

    const executeRollback = async () => {
        if (!rollbackTarget) return;
        try {
            const res = await fetch('/api/config-management/restore', {
                method: 'POST', 
                body: JSON.stringify({ backupId: rollbackTarget.id }), 
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.error) setToast({ message: 'Rollback failed: ' + data.error, type: 'error' });
            else setToast({ message: 'Rollback executed successfully!', type: 'success' });
        } catch (e) {
            setToast({ message: 'Failed to execute rollback flow.', type: 'error' });
        }
        setRollbackTarget(null);
    };

    if (loading) {
        return <div className="flex justify-center items-center py-20">
            <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        </div>;
    }

    return (
        <div className="relative min-h-[600px] bg-transparent text-white py-2 rounded-2xl overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Main Area: Fast UI Layout */}
            {userRole === 'superadmin' && tenants.length > 0 && (
                <div className="mb-4 flex items-center justify-end gap-3 px-1 animate-fade-in">
                    <label className="text-xs font-bold text-zinc-400">Filter by Tenant:</label>
                    <select 
                        value={selectedTenant}
                        onChange={e => setSelectedTenant(e.target.value)}
                        className="bg-[#0a1019] border border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    >
                        <option value="all">🌐 All Organizations</option>
                        {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
            )}
            <div className={`transition-all duration-300 ${selectedDevice ? 'mr-0 md:mr-[450px]' : ''}`}>
                <DeviceTable 
                    devices={devices} 
                    selectedDeviceId={selectedDevice?.id || null} 
                    onSelectDevice={handleSelectDevice} 
                />
            </div>

            {/* View Config Overlay */}
            {viewedConfig && (
                <div className="fixed inset-0 bg-black/95 z-[150] flex flex-col animate-fade-in backdrop-blur-md">
                    <div className="p-4 border-b border-zinc-800 bg-zinc-900 flex justify-between items-center">
                        <h3 className="font-mono text-zinc-100 font-bold">Raw Configuration</h3>
                        <div className="flex gap-2">
                            <button onClick={() => { 
                                if (navigator.clipboard && window.isSecureContext) {
                                    navigator.clipboard.writeText(viewedConfig);
                                } else {
                                    const textArea = document.createElement("textarea");
                                    textArea.value = viewedConfig;
                                    textArea.style.position = "fixed";
                                    textArea.style.left = "-999999px";
                                    textArea.style.top = "-999999px";
                                    document.body.appendChild(textArea);
                                    textArea.focus();
                                    textArea.select();
                                    try {
                                        document.execCommand('copy');
                                    } catch (err) {
                                        console.error('Fallback: Oops, unable to copy', err);
                                    }
                                    document.body.removeChild(textArea);
                                }
                                setToast({ message: 'Copied to clipboard', type: 'success' });
                            }} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded text-sm transition-colors">Copy</button>
                            <button onClick={() => setViewedConfig(null)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm transition-colors">Close</button>
                        </div>
                    </div>
                    <pre className="p-6 text-sm text-green-400 font-mono overflow-auto flex-1 whitespace-pre-wrap">{viewedConfig}</pre>
                </div>
            )}

            {/* Side Panel */}
            {selectedDevice && (
                <DeviceSidePanel 
                    device={selectedDevice}
                    backups={deviceBackups}
                    loadingBackups={loadingBackups}
                    onClose={() => { setSelectedDevice(null); fetchDevices(); }}
                    onViewConfig={(b) => setViewedConfig(b.configText)}
                    onCompare={(oldB, newB) => setDiffVersion({ left: oldB, right: newB })}
                    onRollback={(b) => setRollbackTarget(b)}
                    onBackupNow={handleBackupNow}
                    isBackupping={isBackupping}
                    userRole={userRole}
                />
            )}

            {/* Diff Viewer Modal */}
            {diffVersion && (
                <ConfigDiffViewer 
                    device={selectedDevice}
                    leftBackup={diffVersion.left}
                    rightBackup={diffVersion.right}
                    onClose={() => setDiffVersion(null)}
                />
            )}

            {/* Rollback Modal */}
            {rollbackTarget && (
                <RollbackModal 
                    device={selectedDevice}
                    targetBackup={rollbackTarget}
                    onConfirm={executeRollback}
                    onCancel={() => setRollbackTarget(null)}
                />
            )}
        </div>
    );
}
