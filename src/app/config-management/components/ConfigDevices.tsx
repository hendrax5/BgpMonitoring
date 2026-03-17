'use client';

import React, { useState, useEffect } from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import { format } from 'date-fns';

export default function ConfigDevices({ userRole }: { userRole: string }) {
    const [devices, setDevices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Sub-view Router States
    const [viewMode, setViewMode] = useState<'table' | 'node'>('table');
    const [selectedDevice, setSelectedDevice] = useState<any | null>(null);
    const [activeNodeTab, setActiveNodeTab] = useState<'config' | 'versions'>('config');

    const [deviceBackups, setDeviceBackups] = useState<any[]>([]);
    const [loadingBackups, setLoadingBackups] = useState(false);

    // Diff Viewer State
    const [leftBackupId, setLeftBackupId] = useState<number | null>(null);
    const [rightBackupId, setRightBackupId] = useState<number | null>(null);

    useEffect(() => {
        fetch('/api/config-management/devices')
            .then(r => r.json())
            .then(d => {
                if (d.devices) setDevices(d.devices);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [viewMode]);

    const openNodeView = async (device: any) => {
        setSelectedDevice(device);
        setViewMode('node');
        setActiveNodeTab('config');
        setLoadingBackups(true);
        setDeviceBackups([]);
        setLeftBackupId(null);
        setRightBackupId(null);

        try {
            const res = await fetch(`/api/config-management/backups?deviceId=${device.id}`);
            const d = await res.json();
            if (d.backups) {
                setDeviceBackups(d.backups);
                if (d.backups.length >= 1) setRightBackupId(d.backups[0].id);
                if (d.backups.length >= 2) setLeftBackupId(d.backups[1].id);
            }
        } catch (e) {
            console.error(e);
        }
        setLoadingBackups(false);
    };

    const handleRestore = async (backupId: number) => {
        if (!confirm('PENGINGAT KRITIS: Tindakan ini akan meng-inject raw text lama kembali ke router secara realtime! Lanjutkan?')) return;
        
        try {
            alert('Initiating SSH Restore job... please wait.');
            const res = await fetch('/api/config-management/restore', {
                method: 'POST', body: JSON.stringify({ backupId }), headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.error) alert('Restore failed: ' + data.error);
            else alert('Restore Success.');
        } catch (e) {
            alert('Failed to execute API');
        }
    };

    if (loading) return <div className="text-center py-10">Loading Devices Table...</div>;

    // ----- VIEW: NODE DETAIL (Oxidized Style) -----
    if (viewMode === 'node' && selectedDevice) {
        const latestConfig = deviceBackups.length > 0 ? deviceBackups[0].configText : 'No configuration backups found.';
        const leftConfig = deviceBackups.find(b => b.id === leftBackupId)?.configText || '';
        const rightConfig = deviceBackups.find(b => b.id === rightBackupId)?.configText || '';

        return (
            <div className="flex flex-col h-full animate-fade-in">
                {/* Oxidized-like Header / Breadcrumb */}
                <div className="flex items-center gap-4 mb-6 pb-4 border-b">
                    <button 
                        onClick={() => setViewMode('table')}
                        className="text-gray-500 hover:text-gray-900 border border-gray-300 rounded px-3 py-1 bg-white hover:bg-gray-50 flex items-center gap-1 shadow-sm transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        Nodes
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            {selectedDevice.hostname}
                            <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded border">
                                {selectedDevice.ipAddress} - {selectedDevice.vendor.toUpperCase()}
                            </span>
                        </h2>
                    </div>
                </div>

                {/* Oxidized Tabs */}
                <div className="flex border-b border-gray-200 mb-6 bg-gray-50 rounded-t-lg px-2 pt-2">
                    <button 
                        onClick={() => setActiveNodeTab('config')}
                        className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeNodeTab === 'config' ? 'border-blue-600 text-blue-700 bg-white shadow-sm' : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Configuration
                    </button>
                    <button 
                        onClick={() => setActiveNodeTab('versions')}
                        className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeNodeTab === 'versions' ? 'border-orange-600 text-orange-700 bg-white shadow-sm' : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Versions & Diff
                        {deviceBackups.length > 0 && <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs">{deviceBackups.length}</span>}
                    </button>
                </div>

                {/* Tab: Configuration (Raw View) */}
                {activeNodeTab === 'config' && (
                    <div className="flex-1 bg-gray-900 rounded-lg p-5 overflow-auto shadow-inner border border-gray-800 relative group">
                        <button 
                            onClick={() => { navigator.clipboard.writeText(latestConfig); alert('Copied to clipboard!') }}
                            className="absolute top-4 right-4 bg-gray-700 hover:bg-gray-600 text-white p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Copy Raw Configuration"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        </button>
                        <pre className="text-gray-300 font-mono text-sm leading-relaxed whitespace-pre" style={{ tabSize: 4 }}>
                            {loadingBackups ? 'Fetching configuration...' : latestConfig}
                        </pre>
                    </div>
                )}

                {/* Tab: Versions & Diff Viewer */}
                {activeNodeTab === 'versions' && (
                    <div className="flex flex-col xl:flex-row gap-6 h-full min-h-[600px]">
                        {/* Versions List List (Left) */}
                        <div className="w-full xl:w-1/4 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col h-full overflow-hidden">
                            <div className="bg-gray-50 border-b p-3 font-semibold text-gray-700 flex justify-between items-center">
                                <span>Version History</span>
                            </div>
                            <div className="overflow-y-auto flex-1 p-2 space-y-2">
                                {loadingBackups ? <p className="text-center text-gray-500 py-4">Fetching history...</p> : 
                                deviceBackups.length === 0 ? <p className="text-center text-gray-500 py-4">No backups found.</p> :
                                deviceBackups.map((b, idx) => (
                                    <div key={b.id} className="border border-gray-200 rounded-md p-3 hover:bg-blue-50 transition-colors relative">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="font-medium text-sm text-gray-900">{format(new Date(b.createdAt), 'yyyy-MM-dd HH:mm:ss')}</div>
                                            {idx === 0 && <span className="bg-green-100 text-green-800 text-[10px] px-1.5 py-0.5 rounded font-bold">LATEST</span>}
                                        </div>
                                        
                                        <div className="text-xs text-gray-500 mb-3 font-mono truncate" title={b.configHash}>
                                            {b.configHash.substring(0, 12)}...
                                        </div>

                                        {/* Status Kepatuhan */}
                                        {!b.isCompliant && (
                                            <div className="mb-3 text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100" title={b.complianceLog}>
                                                <span className="font-bold">Violations Detected</span>
                                            </div>
                                        )}

                                        <div className="flex justify-between items-center gap-2 mt-2">
                                            <div className="flex bg-gray-100 rounded p-1 w-full gap-1">
                                                <button 
                                                    onClick={() => setLeftBackupId(b.id)} 
                                                    className={`flex-1 text-xs py-1 rounded ${leftBackupId === b.id ? 'bg-orange-500 text-white' : 'hover:bg-gray-200 text-gray-700'}`}
                                                >Left Diff</button>
                                                <button 
                                                    onClick={() => setRightBackupId(b.id)} 
                                                    className={`flex-1 text-xs py-1 rounded ${rightBackupId === b.id ? 'bg-indigo-500 text-white' : 'hover:bg-gray-200 text-gray-700'}`}
                                                >Right Diff</button>
                                            </div>
                                        </div>
                                        
                                        {/* Restore Button for Admin */}
                                        {(userRole === 'superadmin' || userRole === 'orgadmin') && (
                                            <div className="mt-2 text-right">
                                                <button 
                                                    onClick={() => handleRestore(b.id)}
                                                    className="w-full text-xs font-bold py-1.5 rounded bg-red-50 hover:bg-red-600 text-red-700 border border-red-200 hover:text-white transition-all shadow-sm"
                                                    title="Push this configuration back to the device"
                                                >
                                                    RESTORE CONFIG
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Diff Viewer (Right) */}
                        <div className="w-full xl:w-3/4 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
                            <div className="bg-gray-50 border-b p-3 font-semibold text-gray-700 flex flex-col sm:flex-row justify-between text-sm">
                                <div className="text-orange-600">Left: {leftBackupId ? format(new Date(deviceBackups.find(b=>b.id===leftBackupId)?.createdAt), 'yyyy-MM-dd HH:mm:ss') : 'Not selected'}</div>
                                <div className="text-indigo-600">Right: {rightBackupId ? format(new Date(deviceBackups.find(b=>b.id===rightBackupId)?.createdAt), 'yyyy-MM-dd HH:mm:ss') : 'Not selected'}</div>
                            </div>
                            <div className="flex-1 overflow-auto bg-[#fafafa]">
                                {leftBackupId || rightBackupId ? (
                                    <ReactDiffViewer 
                                        oldValue={leftConfig || ''} 
                                        newValue={rightConfig || ''} 
                                        splitView={true} 
                                        compareMethod={DiffMethod.WORDS}
                                        hideLineNumbers={false}
                                        useDarkTheme={false}
                                        styles={{
                                            variables: { light: { diffViewerBackground: '#ffffff' } },
                                            line: { fontSize: '12px', lineHeight: '1.4' }
                                        }}
                                    />
                                ) : (
                                    <div className="flex h-full items-center justify-center text-gray-400 p-10 text-center">
                                        Select historic versions from the left panel to examine configuration changes.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ----- VIEW: DEFAULT NODES TABLE -----
    return (
        <div className="animate-fade-in">
            <h2 className="text-2xl font-semibold mb-6 text-gray-800">Nodes Configuration</h2>
            <div className="overflow-hidden shadow-sm ring-1 ring-black ring-opacity-5 rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-[#1e293b] text-white">
                        <tr>
                            <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold sm:pl-6">Node</th>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold">Address</th>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold">Vendor</th>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold">Last Update Date</th>
                            <th className="px-3 py-3.5 text-left text-sm font-semibold">Audit Status</th>
                            <th className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Inspect</span></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                        {devices.map((d, i) => (
                            <tr key={d.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-bold text-blue-600 sm:pl-6 hover:underline cursor-pointer" onClick={() => openNodeView(d)}>
                                    {d.hostname}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-600 font-mono">{d.ipAddress}</td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-600 capitalize">{d.vendor}</td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-600">
                                    {d.lastBackupDate ? format(new Date(d.lastBackupDate), 'yyyy-MM-dd HH:mm:ss') : <span className="text-orange-500 italic">Never</span>}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm">
                                    {d.isCompliant === true ? (
                                        <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-medium border border-green-200">Compliant</span>
                                    ) : d.isCompliant === false ? (
                                        <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-medium border border-red-200 shadow-sm">Violated</span>
                                    ) : (
                                        <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-xs font-medium">No Data</span>
                                    )}
                                </td>
                                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                    <button 
                                        onClick={() => openNodeView(d)} 
                                        className="bg-gray-100 p-2 rounded hover:bg-gray-200 text-gray-600 transition-colors"
                                        title="View Node Configurations"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
