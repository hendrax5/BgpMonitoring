'use client';

import React, { useState, useEffect } from 'react';

interface Device {
    id: number;
    hostname: string;
    ipAddress: string;
    vendor: string;
    lastBackupDate: string | null;
    isCompliant: boolean | null;
    latestBackupId: number | null;
}

export default function ConfigDashboard() {
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/config-management/devices')
            .then(r => r.json())
            .then(d => {
                if (d.devices) setDevices(d.devices);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const triggerBackupNow = async () => {
        try {
            alert('Triggering background backup logic...');
            await fetch('/api/config-management/backup-now', { method: 'POST' });
        } catch (e) {
            console.error(e);
        }
    };

    if (loading) return <div className="text-center py-10">Loading Dashboard...</div>;

    const totalDevices = devices.length;
    const compliant = devices.filter(d => d.isCompliant === true).length;
    const nonCompliant = devices.filter(d => d.isCompliant === false).length;
    const noBackup = devices.filter(d => d.lastBackupDate === null).length;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold mb-4 text-gray-800">Overview</h2>
                <button
                    onClick={triggerBackupNow}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    Trigger Backup Now
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl shadow-sm">
                    <h3 className="text-sm font-medium text-slate-500 uppercase">Total Devices</h3>
                    <p className="text-3xl font-bold text-slate-800 mt-2">{totalDevices}</p>
                </div>
                <div className="bg-green-50 border border-green-200 p-5 rounded-xl shadow-sm">
                    <h3 className="text-sm font-medium text-green-600 uppercase">Compliant Configs</h3>
                    <p className="text-3xl font-bold text-green-700 mt-2">{compliant}</p>
                </div>
                <div className="bg-red-50 border border-red-200 p-5 rounded-xl shadow-sm">
                    <h3 className="text-sm font-medium text-red-600 uppercase">Non-Compliant</h3>
                    <p className="text-3xl font-bold text-red-700 mt-2">{nonCompliant}</p>
                </div>
                <div className="bg-orange-50 border border-orange-200 p-5 rounded-xl shadow-sm">
                    <h3 className="text-sm font-medium text-orange-600 uppercase">Missing Backup</h3>
                    <p className="text-3xl font-bold text-orange-700 mt-2">{noBackup}</p>
                </div>
            </div>

            <p className="text-sm text-gray-500">
                Automatic scheduled backup runs every midnight (00:00). 
                Changes are only saved if the configuration text differs from the last backup.
            </p>
        </div>
    );
}
