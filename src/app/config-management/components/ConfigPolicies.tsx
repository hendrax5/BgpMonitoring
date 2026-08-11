'use client';

import React, { useState, useEffect } from 'react';

const POLICY_TEMPLATES = [
    { slug: 'no-telnet', name: 'No Telnet Access', hint: 'Telnet must be disabled', icon: 'block', vendorMatch: 'all', mustMatch: false, regexPattern: 'transport input telnet|ip telnet server', severity: 'critical' },
    { slug: 'ssh-only', name: 'SSH Management Enabled', hint: 'SSH must be configured', icon: 'lock', vendorMatch: 'all', mustMatch: true, regexPattern: 'transport input ssh|ip ssh version', severity: 'warning' },
    { slug: 'ntp-set', name: 'NTP Configured', hint: 'At least one NTP server set', icon: 'schedule', vendorMatch: 'all', mustMatch: true, regexPattern: 'ntp server', severity: 'warning' },
    { slug: 'no-default-snmp', name: 'No Default SNMP Community', hint: 'Forbid public/private communities', icon: 'vpn_key', vendorMatch: 'all', mustMatch: false, regexPattern: 'snmp-server community (public|private)', severity: 'critical' },
    { slug: 'password-encryption', name: 'Password Encryption', hint: 'service password-encryption on', icon: 'password', vendorMatch: 'cisco', mustMatch: true, regexPattern: 'service password-encryption', severity: 'warning' },
    { slug: 'logging-enabled', name: 'Central Logging', hint: 'Syslog / logging host set', icon: 'description', vendorMatch: 'all', mustMatch: true, regexPattern: 'logging (host|buffered|server)', severity: 'warning' },
];

export default function ConfigPolicies() {
    const [policies, setPolicies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [formError, setFormError] = useState('');
    const [applying, setApplying] = useState('');
    const [toast, setToast] = useState('');

    const loadPolicies = () => {
        setLoading(true);
        fetch('/api/config-management/policies')
            .then(r => r.json())
            .then(d => { if (d.policies) setPolicies(d.policies); setLoading(false); })
            .catch(() => setLoading(false));
    };

    useEffect(() => { loadPolicies(); }, []);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState({
        id: '', name: '', description: '', vendorMatch: 'all',
        mustMatch: true, regexPattern: '', severity: 'warning', isActive: true,
    });

    const openCreate = () => {
        setFormError('');
        setFormData({ id: '', name: '', description: '', vendorMatch: 'all', mustMatch: true, regexPattern: '', severity: 'warning', isActive: true });
        setIsFormOpen(true);
    };
    const openEdit = (p: any) => { setFormError(''); setFormData({ ...p, id: p.id.toString() }); setIsFormOpen(true); };

    const deletePolicy = async (id: number) => {
        if (!confirm('Are you sure you want to delete this policy?')) return;
        try {
            await fetch('/api/config-management/policies', {
                method: 'POST', body: JSON.stringify({ action: 'delete', id }), headers: { 'Content-Type': 'application/json' },
            });
            loadPolicies();
        } catch (e) { console.error(e); }
    };

    const savePolicy = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');
        try {
            const res = await fetch('/api/config-management/policies', {
                method: 'POST',
                body: JSON.stringify({ action: formData.id ? 'update' : 'create', ...formData }),
                headers: { 'Content-Type': 'application/json' },
            });
            const d = await res.json();
            if (d.error) setFormError(d.error);
            else { setIsFormOpen(false); loadPolicies(); fetch('/api/config-management/scan', { method: 'POST' }).catch(() => {}); }
        } catch (err: any) { setFormError(err.message); }
    };

    const applyTemplate = async (tpl: any) => {
        setApplying(tpl.name);
        try {
            const res = await fetch('/api/config-management/policies', {
                method: 'POST',
                body: JSON.stringify({ action: 'create', ...tpl, isActive: true }),
                headers: { 'Content-Type': 'application/json' },
            });
            const d = await res.json();
            if (d.error) { setToast(d.error); }
            else {
                loadPolicies();
                // Scan On Save: keep compliance results current
                fetch('/api/config-management/scan', { method: 'POST' }).catch(() => {});
                setToast(`Enabled: ${tpl.name} — devices rescanned`);
            }
        } catch (err: any) { setToast(err.message); }
        setApplying('');
        setTimeout(() => setToast(''), 3500);
    };

    const existingNames = new Set(policies.map(p => p.name));

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">Compliance Policies</h2>
                    <p className="text-sm mt-1" style={{ color: '#64748b' }}>
                        Global audit rules enforced on every config scan. <span className="font-bold" style={{ color: '#818cf8' }}>Superadmin only</span>.
                    </p>
                </div>
                <button onClick={openCreate} data-testid="new-policy-btn" className="btn-primary"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#4338ca)', color: '#fff' }}>
                    <span className="material-symbols-outlined text-base">add</span>
                    New Policy
                </button>
            </div>

            {/* One-click templates */}
            <div className="card p-5" data-testid="policy-templates">
                <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined" style={{ color: '#818cf8' }}>bolt</span>
                    <h3 className="text-sm font-bold text-white">Quick Templates</h3>
                    <span className="text-xs" style={{ color: '#64748b' }}>— enable common hardening rules in one click</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {POLICY_TEMPLATES.map(tpl => {
                        const added = existingNames.has(tpl.name);
                        return (
                            <div key={tpl.name} className="flex items-start gap-3 p-3 rounded-xl"
                                style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)' }}>
                                <span className="material-symbols-outlined text-lg mt-0.5" style={{ color: tpl.severity === 'critical' ? '#fb7185' : '#fbbf24' }}>{tpl.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-white truncate">{tpl.name}</p>
                                    <p className="text-[11px] mb-2" style={{ color: '#64748b' }}>{tpl.hint}</p>
                                    <button
                                        data-testid={`apply-template-${tpl.slug}`}
                                        onClick={() => applyTemplate(tpl)}
                                        disabled={added || applying === tpl.name}
                                        className={added ? 'btn-ghost text-xs' : 'btn-primary text-xs'}
                                        style={added ? { opacity: 0.6 } : { background: 'linear-gradient(135deg,#6366f1,#4338ca)', color: '#fff' }}>
                                        <span className="material-symbols-outlined text-sm">{added ? 'check' : 'add'}</span>
                                        {added ? 'Enabled' : applying === tpl.name ? 'Enabling…' : 'Enable'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
                {toast && (
                    <div className="mt-3 text-xs font-medium px-3 py-2 rounded-lg" data-testid="template-toast"
                        style={{ backgroundColor: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                        {toast}
                    </div>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <span className="material-symbols-outlined animate-spin text-2xl" style={{ color: '#818cf8' }}>progress_activity</span>
                </div>
            ) : (
                <div className="card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full data-table" data-testid="policies-table">
                            <thead>
                                <tr>
                                    <th>Policy Name</th>
                                    <th>Vendor</th>
                                    <th>Condition</th>
                                    <th>Regex Pattern</th>
                                    <th>Severity</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {policies.map(p => (
                                    <tr key={p.id}>
                                        <td>
                                            <div className="flex items-center gap-2.5 font-semibold text-white text-sm">
                                                <span className="dot" style={{ backgroundColor: p.isActive ? '#34d399' : '#64748b' }} />
                                                {p.name}
                                            </div>
                                        </td>
                                        <td><span className="chip capitalize">{p.vendorMatch}</span></td>
                                        <td>
                                            {p.mustMatch
                                                ? <span className="badge-established">Must Present</span>
                                                : <span className="badge-down">Forbidden</span>}
                                        </td>
                                        <td className="max-w-xs truncate" title={p.regexPattern}>
                                            <span className="font-mono text-xs" style={{ color: '#a5b4fc' }}>{p.regexPattern}</span>
                                        </td>
                                        <td>
                                            <span className={p.severity === 'critical' ? 'badge-down' : 'badge-warning'}>{p.severity}</span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => openEdit(p)} className="btn-ghost text-xs" data-testid={`edit-policy-${p.id}`}>
                                                    <span className="material-symbols-outlined text-sm">edit</span>Edit
                                                </button>
                                                <button onClick={() => deletePolicy(p.id)} className="btn-danger" data-testid={`delete-policy-${p.id}`}>
                                                    <span className="material-symbols-outlined text-sm">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {policies.length === 0 && (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem' }}>
                                        <span className="material-symbols-outlined text-4xl block mb-3" style={{ color: '#334155' }}>gavel</span>
                                        <p className="text-white font-medium">No active policies established</p>
                                        <p className="text-xs mt-1" style={{ color: '#475569' }}>Create a policy to start enforcing compliance.</p>
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {isFormOpen && (
                <div className="modal-backdrop" onClick={() => setIsFormOpen(false)}>
                    <div className="modal-panel" style={{ maxWidth: '34rem' }} onClick={e => e.stopPropagation()} data-testid="policy-modal">
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                            <h3 className="text-lg font-bold text-white">{formData.id ? 'Modify Policy' : 'Create Policy'}</h3>
                            <button onClick={() => setIsFormOpen(false)} className="btn-ghost p-1.5" aria-label="Close">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <form onSubmit={savePolicy} className="p-6 space-y-5">
                            {formError && (
                                <div className="p-3 rounded-lg text-sm font-medium"
                                    style={{ backgroundColor: 'rgba(251,113,133,0.1)', color: '#fb7185', border: '1px solid rgba(251,113,133,0.25)' }}>
                                    {formError}
                                </div>
                            )}
                            <div>
                                <label className="form-label">Policy Name</label>
                                <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    type="text" placeholder="e.g. Prevent SSH root login" className="form-input" data-testid="policy-name" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Target Vendor</label>
                                    <select value={formData.vendorMatch} onChange={e => setFormData({ ...formData, vendorMatch: e.target.value })} className="form-select">
                                        <option value="all">All Vendors</option>
                                        <option value="cisco">Cisco</option>
                                        <option value="mikrotik">MikroTik</option>
                                        <option value="huawei">Huawei</option>
                                        <option value="juniper">Juniper</option>
                                        <option value="vyos">VyOS</option>
                                        <option value="danos">DANOS</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Severity</label>
                                    <select value={formData.severity} onChange={e => setFormData({ ...formData, severity: e.target.value })} className="form-select">
                                        <option value="warning">Warning</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="form-label">Enforcement Condition</label>
                                <select value={formData.mustMatch ? 'true' : 'false'} onChange={e => setFormData({ ...formData, mustMatch: e.target.value === 'true' })} className="form-select">
                                    <option value="true">Must be present in config (Required)</option>
                                    <option value="false">Must NOT be present in config (Forbidden)</option>
                                </select>
                            </div>
                            <div>
                                <label className="form-label">Regex Match String</label>
                                <input required value={formData.regexPattern} onChange={e => setFormData({ ...formData, regexPattern: e.target.value })}
                                    type="text" placeholder="e.g. ip telnet server\s*on" className="form-input" style={{ fontFamily: 'ui-monospace, monospace', color: '#a5b4fc' }} data-testid="policy-regex" />
                                <p className="text-[11px] mt-1.5" style={{ color: '#475569' }}>JavaScript RegExp syntax. Applied globally, case-insensitive.</p>
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer select-none">
                                <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="h-5 w-5 rounded" style={{ accentColor: '#6366f1' }} />
                                <span className="text-sm font-semibold text-white">Active / Enforce on scans</span>
                            </label>
                            <div className="flex gap-3 pt-2">
                                <button type="submit" className="btn-primary flex-1 justify-center" style={{ background: 'linear-gradient(135deg,#6366f1,#4338ca)', color: '#fff', padding: '0.7rem' }} data-testid="save-policy">
                                    Save Policy
                                </button>
                                <button type="button" onClick={() => setIsFormOpen(false)} className="btn-ghost flex-1 justify-center" style={{ padding: '0.7rem' }}>
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
