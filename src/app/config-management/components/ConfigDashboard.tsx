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

    if (loading) return (
        <div className="flex justify-center items-center py-24">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
    );

    const totalDevices = devices.length;
    const compliant = devices.filter(d => d.isCompliant === true).length;
    const nonCompliant = devices.filter(d => d.isCompliant === false).length;
    const noBackup = devices.filter(d => d.lastBackupDate === null).length;

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <h2 className="text-2xl font-bold text-white tracking-tight">Overview</h2>
                <button
                    onClick={triggerBackupNow}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-95 border border-blue-500/50"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    Trigger Backup Now
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Total Devices */}
                <div className="relative group bg-[#0f172a]/60 backdrop-blur-md border border-zinc-800/80 p-6 rounded-2xl shadow-xl transition-all hover:bg-[#0f172a] overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full pointer-events-none group-hover:bg-blue-500/10 transition-all duration-500" />
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>
                        Total
                    </h3>
                    <p className="text-4xl font-black text-white mt-4">{totalDevices}</p>
                </div>

                {/* Compliant */}
                <div className="relative group bg-[#0f172a]/60 backdrop-blur-md border border-emerald-900/30 p-6 rounded-2xl shadow-xl transition-all hover:bg-[#0f172a] overflow-hidden ring-1 ring-emerald-500/0 hover:ring-emerald-500/20">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full pointer-events-none group-hover:bg-emerald-500/10 transition-all duration-500" />
                    <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Compliant
                    </h3>
                    <p className="text-4xl font-black text-white mt-4">{compliant}</p>
                </div>

                {/* Non-Compliant */}
                <div className="relative group bg-[#0f172a]/60 backdrop-blur-md border border-red-900/30 p-6 rounded-2xl shadow-xl transition-all hover:bg-[#0f172a] overflow-hidden ring-1 ring-red-500/0 hover:ring-red-500/20">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-3xl rounded-full pointer-events-none group-hover:bg-red-500/10 transition-all duration-500" />
                    <h3 className="text-sm font-bold text-red-500 uppercase tracking-wider flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        Failed
                    </h3>
                    <p className="text-4xl font-black text-white mt-4">{nonCompliant}</p>
                </div>

                {/* Missing Backup */}
                <div className="relative group bg-[#0f172a]/60 backdrop-blur-md border border-orange-900/30 p-6 rounded-2xl shadow-xl transition-all hover:bg-[#0f172a] overflow-hidden ring-1 ring-orange-500/0 hover:ring-orange-500/20">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-3xl rounded-full pointer-events-none group-hover:bg-orange-500/10 transition-all duration-500" />
                    <h3 className="text-sm font-bold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        No Backup
                    </h3>
                    <p className="text-4xl font-black text-white mt-4">{noBackup}</p>
                </div>
            </div>

            <div className="bg-[#0f172a]/40 border border-zinc-800/60 p-5 rounded-xl">
                <div className="flex gap-4 items-start">
                    <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <p className="text-sm text-zinc-400 leading-relaxed font-medium">
                        Automatic scheduled backup runs every midnight (00:00). 
                        Changes are only committed to the database if the retrieved configuration text differs from the most recent backup signature.
                    </p>
                </div>
            </div>
        </div>
    );
}
