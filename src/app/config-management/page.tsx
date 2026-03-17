'use client';

import React, { useState, useEffect } from 'react';
import ConfigDevices from './components/ConfigDevices';
import ConfigDashboard from './components/ConfigDashboard';
import ConfigPolicies from './components/ConfigPolicies';

export default function ConfigManagementPage() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [userRole, setUserRole] = useState('viewer');
    const [isMenuOpen, setIsMenuOpen] = useState(false);

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
        { id: 'dashboard', label: '📊 Dashboard' },
        { id: 'devices', label: '🖧 Devices Backups' }
    ];

    if (userRole === 'superadmin') {
        tabs.push({ id: 'policies', label: '🛡️ Compliance Policies' });
    }

    const currentTabLabel = tabs.find(t => t.id === activeTab)?.label || 'Dashboard';

    return (
        <div className="p-6 bg-gray-50 min-h-screen text-gray-800">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Configuration Management</h1>
                    <p className="text-gray-500 mt-1">Manage, backup, and restore router configurations automatically.</p>
                </div>
            </div>

            {/* Middle Tab Dropdown Navigation (User Request) */}
            <div className="flex justify-center mb-8 relative">
                <div className="w-full max-w-sm">
                    <button 
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="w-full flex justify-between items-center bg-white border border-gray-300 shadow-sm text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                    >
                        <span className="font-medium text-lg">{currentTabLabel}</span>
                        <svg className={`w-5 h-5 text-gray-500 transform transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    
                    {isMenuOpen && (
                        <div className="absolute top-14 left-1/2 transform -translate-x-1/2 w-full max-w-sm bg-white border border-gray-200 shadow-lg rounded-lg mt-1 z-50 overflow-hidden">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setActiveTab(tab.id);
                                        setIsMenuOpen(false);
                                    }}
                                    className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b last:border-b-0
                                        ${activeTab === tab.id ? 'bg-blue-100 text-blue-800 font-semibold' : 'text-gray-700 font-medium'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Render Active View */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                {activeTab === 'dashboard' && <ConfigDashboard />}
                {activeTab === 'devices' && <ConfigDevices userRole={userRole} />}
                {activeTab === 'policies' && userRole === 'superadmin' && <ConfigPolicies />}
            </div>
        </div>
    );
}
