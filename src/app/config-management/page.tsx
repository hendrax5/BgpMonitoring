'use client';

import React, { useState, useEffect } from 'react';
import ConfigDevices from './components/ConfigDevices';
import ConfigDashboard from './components/ConfigDashboard';
import ConfigPolicies from './components/ConfigPolicies';

export default function ConfigManagementPage() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [userRole, setUserRole] = useState('viewer');

    useEffect(() => {
        // Fetch session role to determine if they can see policies
        fetch('/api/auth/session')
            .then(r => r.json())
            .then(d => {
                if (d.role) setUserRole(d.role);
            })
            .catch(console.error);
    }, []);

    const tabs = [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'devices', label: 'Device Backups' }
    ];

    if (userRole === 'superadmin') {
        tabs.push({ id: 'policies', label: 'Compliance Policies' });
    }

    return (
        <div className="min-h-screen bg-[#060a11] text-zinc-300 relative overflow-hidden">
            {/* Soft background ambient gradient */}
            <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-br from-blue-900/10 via-indigo-900/5 to-transparent pointer-events-none" />
            <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative p-6 md:p-8 max-w-[1600px] mx-auto z-10">
                <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="animate-fade-in-up">
                        <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                            <span className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </span>
                            Configuration Hub
                        </h1>
                        <p className="text-zinc-400 mt-3 font-medium tracking-wide text-sm max-w-lg leading-relaxed">
                            Automated synchronisation, policy enforcement, and disaster recovery.
                        </p>
                    </div>

                    {/* Segmented Horizontal Tabs */}
                    <div className="flex bg-[#0f172a]/80 backdrop-blur-xl rounded-2xl p-1.5 border border-zinc-800 shadow-xl w-full md:w-auto overflow-x-auto scrollbar-hide shrink-0 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
                        {tabs.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setActiveTab(t.id)}
                                className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 ease-out whitespace-nowrap flex-1 md:flex-none ${
                                    activeTab === t.id 
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 ring-1 ring-blue-400/30' 
                                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="transition-all duration-300 transform-gpu animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                    {activeTab === 'dashboard' && <ConfigDashboard />}
                    {activeTab === 'devices' && <ConfigDevices userRole={userRole} />}
                    {activeTab === 'policies' && userRole === 'superadmin' && <ConfigPolicies />}
                </div>
            </div>
        </div>
    );
}
