'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addDeviceQuick } from '@/app/actions/devices';

interface TenantOpt { id: string; name: string; }

const VENDORS = ['mikrotik', 'cisco', 'juniper', 'huawei', 'arista', 'vyos', 'danos'];
const POLL_METHODS = [
    { value: 'snmp_ssh_mix', label: 'SNMP + SSH' },
    { value: 'snmp_only', label: 'SNMP only' },
    { value: 'ssh_only', label: 'SSH only' },
    { value: 'telnet_only', label: 'Telnet only' },
];

export default function QuickAddDevice({ isSuperAdmin, tenants }: { isSuperAdmin: boolean; tenants: TenantOpt[] }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState('');
    const [pending, start] = useTransition();

    function submit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError('');
        const fd = new FormData(e.currentTarget);
        start(async () => {
            const res = await addDeviceQuick(fd);
            if (res.success) {
                setOpen(false);
                setToast('Device added successfully.');
                setTimeout(() => setToast(''), 3500);
                router.refresh();
            } else {
                setError(res.error || 'Failed to add device.');
            }
        });
    }

    return (
        <>
            <button data-testid="dashboard-add-device-btn" onClick={() => { setError(''); setOpen(true); }} className="btn-primary">
                <span className="material-symbols-outlined text-base">add</span>
                Add Device
            </button>

            {open && (
                <div className="modal-backdrop" onClick={() => !pending && setOpen(false)}>
                    <div className="modal-panel" style={{ maxWidth: '40rem' }} onClick={e => e.stopPropagation()} data-testid="quick-add-device-modal">
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(34,211,238,0.12)', color: '#22d3ee' }}>
                                    <span className="material-symbols-outlined">router</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-lg">Add Device</h3>
                                    <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>Register a router/switch for monitoring & config backup.</p>
                                </div>
                            </div>
                            <button onClick={() => setOpen(false)} className="btn-ghost p-1.5" aria-label="Close">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={submit} className="p-6 space-y-5" data-testid="quick-add-device-form">
                            {error && (
                                <div className="p-3 rounded-lg text-sm font-medium" data-testid="quick-add-device-error"
                                    style={{ backgroundColor: 'rgba(251,113,133,0.1)', color: '#fb7185', border: '1px solid rgba(251,113,133,0.25)' }}>
                                    {error}
                                </div>
                            )}

                            {isSuperAdmin && (
                                <div>
                                    <label className="form-label">Organization <span style={{ color: '#fb7185' }}>*</span></label>
                                    <select name="tenantId" className="form-select" required data-testid="qad-tenant">
                                        <option value="">— Select organization —</option>
                                        {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Hostname <span style={{ color: '#fb7185' }}>*</span></label>
                                    <input name="hostname" className="form-input" placeholder="core-rtr-01" required data-testid="qad-hostname" />
                                </div>
                                <div>
                                    <label className="form-label">IP Address <span style={{ color: '#fb7185' }}>*</span></label>
                                    <input name="ipAddress" className="form-input" placeholder="10.0.0.1" required data-testid="qad-ip" />
                                </div>
                                <div>
                                    <label className="form-label">Vendor</label>
                                    <select name="vendor" className="form-select" defaultValue="mikrotik" data-testid="qad-vendor">
                                        {VENDORS.map(v => <option key={v} value={v} className="capitalize">{v}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Poll Method</label>
                                    <select name="pollMethod" className="form-select" defaultValue="snmp_ssh_mix" data-testid="qad-pollmethod">
                                        {POLL_METHODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">SNMP Community</label>
                                    <input name="snmpCommunity" className="form-input" placeholder="public" data-testid="qad-snmp" />
                                </div>
                                <div />
                            </div>

                            <div className="pt-1">
                                <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: '#64748b' }}>SSH Credentials (optional — for config backup)</p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <input name="sshUser" className="form-input" placeholder="ssh user" data-testid="qad-sshuser" />
                                    <input name="sshPass" type="password" className="form-input" placeholder="ssh password" data-testid="qad-sshpass" />
                                    <input name="sshPort" className="form-input" placeholder="22" defaultValue="22" data-testid="qad-sshport" />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-1">
                                <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
                                <button type="submit" disabled={pending} className="btn-primary" data-testid="qad-submit">
                                    {pending ? 'Adding…' : 'Add Device'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {toast && (
                <div className="fixed bottom-6 right-6 z-[70] px-4 py-3 rounded-xl text-sm font-medium glass animate-rise" data-testid="qad-toast"
                    style={{ color: '#34d399', borderColor: 'rgba(52,211,153,0.3)' }}>
                    <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-base">check_circle</span>{toast}
                    </span>
                </div>
            )}
        </>
    );
}
