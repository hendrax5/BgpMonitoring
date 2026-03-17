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
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-semibold text-gray-800">Compliance Policies</h2>
                    <p className="text-sm text-gray-500">Global rules to audit router configurations across all tenants. Authorized for Superadmin only.</p>
                </div>
                <button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors">
                    + Add New Policy
                </button>
            </div>

            {loading ? (
                <div className="text-center py-10">Loading Rules...</div>
            ) : (
                <div className="overflow-x-auto shadow-sm ring-1 ring-black ring-opacity-5 rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Name</th>
                                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Vendor</th>
                                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Condition</th>
                                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Regex</th>
                                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Severity</th>
                                <th className="relative py-3.5 pl-3 pr-4 sm:pr-6 whitespace-nowrap"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {policies.map(p => (
                                <tr key={p.id}>
                                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${p.isActive ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                                            {p.name}
                                        </div>
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 capitalize">{p.vendorMatch}</td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                        {p.mustMatch ? 
                                            <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-medium">Must Present</span> : 
                                            <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-medium">Forbidden</span>
                                        }
                                    </td>
                                    <td className="px-3 py-4 text-sm font-mono text-gray-600 bg-gray-50 max-w-xs truncate" title={p.regexPattern}>
                                        {p.regexPattern}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 uppercase">{p.severity}</td>
                                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                        <button onClick={() => openEdit(p)} className="text-indigo-600 hover:text-indigo-900 mr-4">Edit</button>
                                        <button onClick={() => deletePolicy(p.id)} className="text-red-600 hover:text-red-900">Delete</button>
                                    </td>
                                </tr>
                            ))}
                            {policies.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-gray-500">No policies defined</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {isFormOpen && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-[100]">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg border border-gray-200">
                        <h3 className="text-xl font-bold mb-4">{formData.id ? 'Edit Policy' : 'Create Policy'}</h3>
                        {formError && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{formError}</div>}
                        
                        <form onSubmit={savePolicy} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Name</label>
                                <input required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} type="text" placeholder="e.g. Prevent SSH root login" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
                            </div>
                            
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700">Vendor Match</label>
                                    <select value={formData.vendorMatch} onChange={e=>setFormData({...formData, vendorMatch: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border">
                                        <option value="all">All Vendors</option>
                                        <option value="cisco">Cisco</option>
                                        <option value="mikrotik">MikroTik</option>
                                        <option value="huawei">Huawei</option>
                                        <option value="juniper">Juniper</option>
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700">Severity</label>
                                    <select value={formData.severity} onChange={e=>setFormData({...formData, severity: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border">
                                        <option value="warning">Warning</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Rule Condition</label>
                                <select value={formData.mustMatch ? 'true' : 'false'} onChange={e=>setFormData({...formData, mustMatch: e.target.value === 'true'})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border">
                                    <option value="true">Must be present in config (Required)</option>
                                    <option value="false">Must NOT be present in config (Forbidden)</option>
                                </select>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Regex Pattern</label>
                                <input required value={formData.regexPattern} onChange={e=>setFormData({...formData, regexPattern: e.target.value})} type="text" placeholder="e.g. ip telnet server\s*on" className="font-mono mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
                                <p className="text-xs text-gray-500 mt-1">JavaScript RegExp string (case-insensitive flag is automatically applied on the worker).</p>
                            </div>

                            <div className="flex items-center mt-2">
                                <input id="isActive" type="checkbox" checked={formData.isActive} onChange={e=>setFormData({...formData, isActive: e.target.checked})} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                                <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">Active (Enforce Policy)</label>
                            </div>

                            <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3 flex gap-3">
                                <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm">
                                    Save
                                </button>
                                <button type="button" onClick={() => setIsFormOpen(false)} className="mt-0 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
