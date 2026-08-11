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
            <span className="material-symbols-outlined animate-spin text-3xl" style={{ color: '#22d3ee' }}>progress_activity</span>
        </div>
    );

    const totalDevices = devices.length;
    const compliant = devices.filter(d => d.isCompliant === true).length;
    const nonCompliant = devices.filter(d => d.isCompliant === false).length;
    const noBackup = devices.filter(d => d.lastBackupDate === null).length;

    const cards = [
        { label: 'Total Devices', value: totalDevices, icon: 'dns', accent: '#22d3ee' },
        { label: 'Compliant', value: compliant, icon: 'verified', accent: '#34d399' },
        { label: 'Failed', value: nonCompliant, icon: 'gpp_bad', accent: '#fb7185' },
        { label: 'No Backup', value: noBackup, icon: 'cloud_off', accent: '#fbbf24' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-lg font-bold text-white tracking-tight">Backup Overview</h2>
                <button onClick={triggerBackupNow} className="btn-primary" data-testid="trigger-backup-btn">
                    <span className="material-symbols-outlined text-base">backup</span>
                    Trigger Backup Now
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.map((c, i) => (
                    <div key={c.label} className={`stat-card p-5 animate-rise d${i + 1}`} style={{ '--accent': c.accent } as any}>
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-2 rounded-lg" style={{ backgroundColor: `${c.accent}1f`, color: c.accent }}>
                                <span className="material-symbols-outlined text-xl">{c.icon}</span>
                            </div>
                        </div>
                        <p className="text-sm mb-1" style={{ color: '#64748b' }}>{c.label}</p>
                        <p className="text-3xl font-bold text-white">{c.value}</p>
                    </div>
                ))}
            </div>

            <div className="card p-5">
                <div className="flex gap-4 items-start">
                    <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: 'rgba(34,211,238,0.1)', color: '#22d3ee' }}>
                        <span className="material-symbols-outlined">schedule</span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>
                        Automatic scheduled backup runs every midnight (00:00). Changes are only committed to the database
                        if the retrieved configuration text differs from the most recent backup signature.
                    </p>
                </div>
            </div>
        </div>
    );
}
