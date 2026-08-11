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
    const [scanning, setScanning] = useState(false);
    const [scanResult, setScanResult] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);

    const loadDevices = () => {
        return fetch('/api/config-management/devices')
            .then(r => r.json())
            .then(d => { if (d.devices) setDevices(d.devices); setLoading(false); })
            .catch(() => setLoading(false));
    };

    const loadHistory = () => {
        return fetch('/api/config-management/history')
            .then(r => r.json())
            .then(d => { if (d.runs) setHistory(d.runs); })
            .catch(() => { });
    };

    useEffect(() => { loadDevices(); loadHistory(); }, []);

    const triggerBackupNow = async () => {
        try {
            await fetch('/api/config-management/backup-now', { method: 'POST' });
        } catch (e) {
            console.error(e);
        }
    };

    const runScan = async () => {
        setScanning(true);
        setScanResult(null);
        try {
            const res = await fetch('/api/config-management/scan', { method: 'POST' });
            const data = await res.json();
            setScanResult(res.ok ? data : { error: data.error || 'Scan failed' });
            await loadDevices();
            await loadHistory();
        } catch (e: any) {
            setScanResult({ error: e.message });
        }
        setScanning(false);
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
                <div className="flex items-center gap-3">
                    <button onClick={runScan} disabled={scanning} className="btn-ghost" data-testid="run-scan-btn"
                        style={{ borderColor: 'rgba(129,140,248,0.4)', color: '#a5b4fc' }}>
                        <span className={`material-symbols-outlined text-base${scanning ? ' animate-spin' : ''}`}>{scanning ? 'progress_activity' : 'policy'}</span>
                        {scanning ? 'Scanning…' : 'Run Compliance Scan'}
                    </button>
                    <button onClick={triggerBackupNow} className="btn-primary" data-testid="trigger-backup-btn">
                        <span className="material-symbols-outlined text-base">backup</span>
                        Trigger Backup Now
                    </button>
                </div>
            </div>

            {scanResult && (
                <div className="card p-5 animate-rise" data-testid="scan-result"
                    style={{ border: `1px solid ${scanResult.error ? 'rgba(251,113,133,0.3)' : scanResult.nonCompliant > 0 ? 'rgba(251,191,36,0.3)' : 'rgba(52,211,153,0.3)'}` }}>
                    {scanResult.error ? (
                        <p className="text-sm font-medium" style={{ color: '#fb7185' }}>{scanResult.error}</p>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined" style={{ color: scanResult.nonCompliant > 0 ? '#fbbf24' : '#34d399' }}>
                                    {scanResult.nonCompliant > 0 ? 'gpp_maybe' : 'verified_user'}
                                </span>
                                <h3 className="font-bold text-white text-sm">
                                    Scan complete — {scanResult.scanned} device(s) evaluated against {scanResult.policiesEvaluated} active polic{scanResult.policiesEvaluated === 1 ? 'y' : 'ies'}
                                </h3>
                            </div>
                            <div className="flex flex-wrap gap-3 mb-3 text-xs">
                                <span className="badge-established">{scanResult.compliant} Compliant</span>
                                {scanResult.nonCompliant > 0 && <span className="badge-down">{scanResult.nonCompliant} Violations</span>}
                                {scanResult.noBackup > 0 && <span className="badge-warning">{scanResult.noBackup} No Backup</span>}
                            </div>
                            {scanResult.violations?.length > 0 && (
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {scanResult.violations.map((v: any, i: number) => (
                                        <div key={i} className="text-xs p-2.5 rounded-lg" style={{ backgroundColor: 'rgba(251,113,133,0.06)', border: '1px solid rgba(251,113,133,0.15)' }}>
                                            <p className="font-bold text-white mb-1">{v.hostname}</p>
                                            {v.messages.map((m: string, j: number) => (
                                                <p key={j} className="font-mono" style={{ color: '#fca5a5' }}>{m}</p>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {scanResult.policiesEvaluated === 0 && (
                                <p className="text-xs" style={{ color: '#64748b' }}>No active policies. Enable policies (or Quick Templates) to enforce compliance.</p>
                            )}
                        </>
                    )}
                </div>
            )}

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

            {/* Compliance History / Trend */}
            {history.length > 0 && (
                <div className="card p-5" data-testid="compliance-history">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="material-symbols-outlined" style={{ color: '#818cf8' }}>trending_up</span>
                        <h3 className="text-sm font-bold text-white">Compliance History</h3>
                        <span className="text-xs" style={{ color: '#64748b' }}>— last {history.length} scan{history.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-end gap-2 h-32 overflow-x-auto pb-1">
                        {history.map((r: any) => {
                            const total = Math.max(r.deviceCount, 1);
                            const compPct = (r.compliant / total) * 100;
                            const violPct = (r.nonCompliant / total) * 100;
                            const nbPct = (r.noBackup / total) * 100;
                            return (
                                <div key={r.id} className="flex flex-col items-center gap-1.5 flex-shrink-0" style={{ width: '2.5rem' }}
                                    title={`${new Date(r.at).toLocaleString()} — ${r.compliant} ok / ${r.nonCompliant} viol / ${r.noBackup} no-backup`}>
                                    <div className="w-6 rounded-md overflow-hidden flex flex-col-reverse" style={{ height: '5.5rem', backgroundColor: 'rgba(255,255,255,0.04)' }}>
                                        <div style={{ height: `${compPct}%`, backgroundColor: '#34d399' }} />
                                        <div style={{ height: `${violPct}%`, backgroundColor: '#fb7185' }} />
                                        <div style={{ height: `${nbPct}%`, backgroundColor: '#fbbf24' }} />
                                    </div>
                                    <span className="text-[9px] font-mono" style={{ color: '#475569' }}>{new Date(r.at).toISOString().slice(11, 16)}</span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-[11px]" style={{ color: '#64748b' }}>
                        <span className="flex items-center gap-1.5"><span className="dot" style={{ backgroundColor: '#34d399' }} />Compliant</span>
                        <span className="flex items-center gap-1.5"><span className="dot" style={{ backgroundColor: '#fb7185' }} />Violations</span>
                        <span className="flex items-center gap-1.5"><span className="dot" style={{ backgroundColor: '#fbbf24' }} />No Backup</span>
                    </div>
                </div>
            )}
        </div>
    );
}
