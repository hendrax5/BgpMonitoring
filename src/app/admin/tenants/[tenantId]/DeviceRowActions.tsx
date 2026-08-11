'use client';

import { useState } from 'react';

interface Device { id: number; hostname: string; ipAddress: string; vendor: string; snmpCommunity?: string | null; }

const VENDORS = ['mikrotik', 'cisco', 'juniper', 'danos', 'vyos', 'huawei', 'arista'];

export default function DeviceRowActions({
    device, tenantId, updateAction, deleteAction,
}: {
    device: Device;
    tenantId: string;
    updateAction: (fd: FormData) => Promise<void>;
    deleteAction: (fd: FormData) => Promise<void>;
}) {
    const [editing, setEditing] = useState(false);
    const [confirming, setConfirming] = useState(false);

    return (
        <>
            <div className="flex items-center gap-2">
                <button onClick={() => setEditing(true)} className="btn-ghost text-xs" data-testid={`edit-device-${device.id}`}>
                    <span className="material-symbols-outlined text-sm">edit</span> Edit
                </button>
                <button onClick={() => setConfirming(true)} className="btn-danger" style={{ padding: '0.3rem 0.7rem' }} data-testid={`delete-device-${device.id}`}>
                    <span className="material-symbols-outlined text-sm">delete</span>
                </button>
            </div>

            {editing && (
                <div className="modal-backdrop" onClick={() => setEditing(false)}>
                    <div className="modal-panel" style={{ maxWidth: '32rem' }} onClick={e => e.stopPropagation()} data-testid={`edit-device-modal-${device.id}`}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                            <h3 className="font-bold text-white text-lg">Edit Device</h3>
                            <button onClick={() => setEditing(false)} className="btn-ghost p-1.5" aria-label="Close">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <form action={updateAction} className="p-6 space-y-4">
                            <input type="hidden" name="deviceId" value={device.id} />
                            <input type="hidden" name="tenantId" value={tenantId} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Hostname</label>
                                    <input name="hostname" defaultValue={device.hostname} className="form-input" required data-testid={`edit-hostname-${device.id}`} />
                                </div>
                                <div>
                                    <label className="form-label">IP Address</label>
                                    <input name="ipAddress" defaultValue={device.ipAddress} className="form-input" required data-testid={`edit-ip-${device.id}`} />
                                </div>
                                <div>
                                    <label className="form-label">Vendor</label>
                                    <select name="vendor" defaultValue={device.vendor} className="form-select">
                                        {VENDORS.map(v => <option key={v} value={v} className="capitalize">{v}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">SNMP Community</label>
                                    <input name="snmpCommunity" defaultValue={device.snmpCommunity || ''} className="form-input" placeholder="public" />
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-3 pt-1">
                                <button type="button" onClick={() => setEditing(false)} className="btn-ghost">Cancel</button>
                                <button type="submit" onClick={() => setTimeout(() => setEditing(false), 50)} className="btn-primary" data-testid={`save-device-${device.id}`}>Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {confirming && (
                <div className="modal-backdrop" onClick={() => setConfirming(false)}>
                    <div className="modal-panel" style={{ maxWidth: '24rem' }} onClick={e => e.stopPropagation()}>
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(251,113,133,0.12)', color: '#fb7185' }}>
                                    <span className="material-symbols-outlined">warning</span>
                                </div>
                                <h3 className="font-bold text-white text-lg">Delete Device?</h3>
                            </div>
                            <p className="text-sm mb-5" style={{ color: '#94a3b8' }}>
                                Remove <span className="font-mono text-white">{device.hostname}</span> ({device.ipAddress})? This cannot be undone.
                            </p>
                            <div className="flex items-center justify-end gap-3">
                                <button onClick={() => setConfirming(false)} className="btn-ghost">Cancel</button>
                                <form action={deleteAction}>
                                    <input type="hidden" name="deviceId" value={device.id} />
                                    <input type="hidden" name="tenantId" value={tenantId} />
                                    <button type="submit" className="btn-primary" style={{ background: 'linear-gradient(135deg,#fb7185,#e11d48)', color: 'white' }} data-testid={`confirm-delete-device-${device.id}`}>Delete</button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
