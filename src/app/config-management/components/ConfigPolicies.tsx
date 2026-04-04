'use client';

import React, { useState, useEffect } from 'react';

export default function ConfigPolicies() {
    const [policies, setPolicies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [formError, setFormError] = useState('');

    const loadPolicies = () => {
        setLoading(true);
        fetch('/api/config-management/policies')
            .then(r => r.json())
            .then(d => {
                if (d.policies) setPolicies(d.policies);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => { loadPolicies(); }, []);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        description: '',
        vendorMatch: 'all',
        mustMatch: true,
        regexPattern: '',
        severity: 'warning',
        isActive: true
    });

    const openCreate = () => {
        setFormError('');
        setFormData({ id: '', name: '', description: '', vendorMatch: 'all', mustMatch: true, regexPattern: '', severity: 'warning', isActive: true });
        setIsFormOpen(true);
    };

    const openEdit = (p: any) => {
        setFormError('');
        setFormData({ ...p, id: p.id.toString() });
        setIsFormOpen(true);
    };

    const deletePolicy = async (id: number) => {
        if (!confirm('Are you sure you want to delete this policy?')) return;
        try {
            await fetch('/api/config-management/policies', {
                method: 'POST', body: JSON.stringify({ action: 'delete', id }), headers: { 'Content-Type': 'application/json' }
            });
            loadPolicies();
        } catch (e) {
            console.error(e);
        }
    };

    const savePolicy = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');
        try {
            const res = await fetch('/api/config-management/policies', {
                method: 'POST',
                body: JSON.stringify({ action: formData.id ? 'update' : 'create', ...formData }),
                headers: { 'Content-Type': 'application/json' }
            });
            const d = await res.json();
            if (d.error) setFormError(d.error);
            else {
                setIsFormOpen(false);
                loadPolicies();
            }
        } catch (err: any) {
            setFormError(err.message);
        }
    };

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Compliance Policies</h2>
                    <p className="text-sm font-medium text-zinc-400 mt-1">Global audit rules to enforce configurations. <span className="text-indigo-400 font-bold">Superadmin Only</span>.</p>
                </div>
                <button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-2 border border-indigo-500/50">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                    New Policy
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
                </div>
            ) : (
                <div className="bg-[#0f172a]/60 backdrop-blur-xl rounded-2xl border border-zinc-800/80 shadow-2xl overflow-x-auto ring-1 ring-white/5">
                    <table className="min-w-full divide-y divide-zinc-800/60">
                        <thead className="bg-[#060a11]/80">
                            <tr>
                                <th className="py-4 pl-6 pr-3 text-left text-xs font-black text-zinc-400 uppercase tracking-wider">Policy Name</th>
                                <th className="px-4 py-4 text-left text-xs font-black text-zinc-400 uppercase tracking-wider">Vendor</th>
                                <th className="px-4 py-4 text-left text-xs font-black text-zinc-400 uppercase tracking-wider">Condition</th>
                                <th className="px-4 py-4 text-left text-xs font-black text-zinc-400 uppercase tracking-wider">Regex Pattern</th>
                                <th className="px-4 py-4 text-left text-xs font-black text-zinc-400 uppercase tracking-wider">Severity</th>
                                <th className="relative py-4 pl-3 pr-6 whitespace-nowrap"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/40 bg-transparent">
                            {policies.map(p => (
                                <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-semibold text-white">
                                        <div className="flex items-center gap-3">
                                            <span className={`w-2.5 h-2.5 rounded-full ring-2 ${p.isActive ? 'bg-emerald-500 ring-emerald-500/30' : 'bg-zinc-600 ring-zinc-500/20'}`}></span>
                                            {p.name}
                                        </div>
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-4 text-sm">
                                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-zinc-800 text-zinc-300 ring-1 ring-zinc-700 capitalize">
                                            {p.vendorMatch}
                                        </span>
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-4 text-sm">
                                        {p.mustMatch ? 
                                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">Must Present</span> : 
                                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 ring-1 ring-red-500/20">Forbidden</span>
                                        }
                                    </td>
                                    <td className="px-4 py-4 text-sm font-mono text-indigo-300 bg-indigo-500/5 max-w-xs truncate border-x border-indigo-500/10" title={p.regexPattern}>
                                        {p.regexPattern}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-4 text-sm">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ring-1 uppercase tracking-wider ${
                                            p.severity === 'critical' 
                                            ? 'bg-rose-500/10 text-rose-400 ring-rose-500/20' 
                                            : 'bg-orange-500/10 text-orange-400 ring-orange-500/20'
                                        }`}>
                                            {p.severity}
                                        </span>
                                    </td>
                                    <td className="relative whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm font-medium">
                                        <div className="flex justify-end gap-3 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openEdit(p)} className="text-zinc-400 hover:text-indigo-400 transition-colors">Edit</button>
                                            <button onClick={() => deletePolicy(p.id)} className="text-zinc-500 hover:text-red-400 transition-colors">Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {policies.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-zinc-500 font-medium">No active policies established.</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {isFormOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[200] animate-fade-in">
                    <div className="bg-[#0f172a] rounded-2xl shadow-2xl shadow-black p-8 w-full max-w-xl border border-zinc-700/50 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />
                        
                        <div className="relative z-10">
                            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                                {formData.id ? 'Modify Policy' : 'Create Policy'}
                            </h3>
                            {formError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl mb-6 text-sm font-medium">{formError}</div>}
                            
                            <form onSubmit={savePolicy} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-zinc-300 mb-1.5">Policy Name</label>
                                    <input required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} type="text" placeholder="e.g. Prevent SSH root login" className="block w-full bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 rounded-xl px-4 py-2.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium" />
                                </div>
                                
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="block text-sm font-semibold text-zinc-300 mb-1.5">Target Vendor</label>
                                        <select value={formData.vendorMatch} onChange={e=>setFormData({...formData, vendorMatch: e.target.value})} className="block w-full bg-zinc-900 border border-zinc-700 text-white rounded-xl px-4 py-2.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium appearance-none">
                                            <option value="all">All Vendors</option>
                                            <option value="cisco">Cisco</option>
                                            <option value="mikrotik">MikroTik</option>
                                            <option value="huawei">Huawei</option>
                                            <option value="juniper">Juniper</option>
                                            <option value="vyos">VyOS</option>
                                            <option value="danos">DANOS</option>
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-sm font-semibold text-zinc-300 mb-1.5">Severity</label>
                                        <select value={formData.severity} onChange={e=>setFormData({...formData, severity: e.target.value})} className="block w-full bg-zinc-900 border border-zinc-700 text-white rounded-xl px-4 py-2.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium appearance-none">
                                            <option value="warning">Warning</option>
                                            <option value="critical">Critical</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-semibold text-zinc-300 mb-1.5">Enforcement Condition</label>
                                    <select value={formData.mustMatch ? 'true' : 'false'} onChange={e=>setFormData({...formData, mustMatch: e.target.value === 'true'})} className="block w-full bg-zinc-900 border border-zinc-700 text-white rounded-xl px-4 py-2.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium appearance-none">
                                        <option value="true">Must be present in config (Required)</option>
                                        <option value="false">Must NOT be present in config (Forbidden)</option>
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-semibold text-zinc-300 mb-1.5">Regex Match String</label>
                                    <input required value={formData.regexPattern} onChange={e=>setFormData({...formData, regexPattern: e.target.value})} type="text" placeholder="e.g. ip telnet server\s*on" className="block w-full font-mono bg-zinc-900 border border-zinc-700 text-indigo-300 placeholder-zinc-600 rounded-xl px-4 py-2.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" />
                                    <p className="text-xs text-zinc-500 mt-2">JavaScript RegExp syntax. Automatically applied globally and case-insensitive.</p>
                                </div>

                                <div className="flex items-center pt-2">
                                    <input id="isActive" type="checkbox" checked={formData.isActive} onChange={e=>setFormData({...formData, isActive: e.target.checked})} className="h-5 w-5 bg-zinc-900 border-zinc-700 text-indigo-500 focus:ring-indigo-500 rounded" />
                                    <label htmlFor="isActive" className="ml-3 block text-sm font-bold text-white cursor-pointer select-none">Active / Enforce on Scans</label>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button type="submit" className="flex-1 justify-center rounded-xl border border-transparent px-5 py-3 bg-indigo-600 text-base font-bold text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98]">
                                        Save Policy
                                    </button>
                                    <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 justify-center rounded-xl border border-zinc-700 px-5 py-3 bg-zinc-800 text-base font-bold text-white hover:bg-zinc-700 transition-all active:scale-[0.98]">
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
