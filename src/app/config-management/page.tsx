'use client';

import React, { useState, useEffect } from 'react';
import ConfigDevices from './components/ConfigDevices';
import ConfigDashboard from './components/ConfigDashboard';
import ConfigPolicies from './components/ConfigPolicies';

export default function ConfigManagementPage() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [userRole, setUserRole] = useState('viewer');

    useEffect(() => {
        fetch('/api/auth/session')
            .then(r => r.json())
            .then(d => { if (d.role) setUserRole(d.role); })
            .catch(console.error);
    }, []);

    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: 'space_dashboard' },
        { id: 'devices', label: 'Device Backups', icon: 'dns' },
    ];
    if (userRole === 'superadmin') tabs.push({ id: 'policies', label: 'Compliance Policies', icon: 'gavel' });

    return (
        <div className="min-h-screen">
            <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 border-b glass"
                style={{ borderColor: 'var(--color-border)' }}>
                <div>
                    <div className="flex items-center gap-2 text-xs mb-0.5" style={{ color: '#475569' }}>
                        <span>Automation</span><span>/</span><span className="text-white">Config Management</span>
                    </div>
                    <h2 className="text-white font-bold text-base">Configuration Hub</h2>
                </div>
                <span className="text-[11px] font-bold px-3 py-1.5 rounded-lg" data-testid="config-role-badge"
                    style={{ backgroundColor: 'rgba(34,211,238,0.1)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.25)' }}>
                    {userRole === 'superadmin' ? 'Superadmin' : userRole}
                </span>
            </header>

            <main className="p-6 space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 animate-rise">
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Automated Config Governance</h1>
                        <p className="mt-1.5 text-sm max-w-xl" style={{ color: '#64748b' }}>
                            Scheduled backups, compliance enforcement and one-click disaster recovery across every device.
                        </p>
                    </div>
                    <div className="seg-tabs overflow-x-auto scrollbar-hide" role="tablist">
                        {tabs.map(t => (
                            <button
                                key={t.id}
                                role="tab"
                                data-testid={`config-tab-${t.id}`}
                                onClick={() => setActiveTab(t.id)}
                                className={`seg-tab flex items-center gap-1.5${activeTab === t.id ? (t.id === 'policies' ? ' active active-indigo' : ' active') : ''}`}
                            >
                                <span className="material-symbols-outlined text-base">{t.icon}</span>
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="animate-rise d2">
                    {activeTab === 'dashboard' && <ConfigDashboard />}
                    {activeTab === 'devices' && <ConfigDevices userRole={userRole} />}
                    {activeTab === 'policies' && userRole === 'superadmin' && <ConfigPolicies />}
                </div>
            </main>
        </div>
    );
}
