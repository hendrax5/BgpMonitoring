'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { createBgpPeer, updateBgpPeer, deleteBgpPeer, toggleBgpPeerStatus, attachDeviceToPeer } from '@/app/actions/bgp-peers';

export interface BgpPeer {
    id: number;
    peerIp: string;
    peerName: string | null;
    remoteAsn: string;
    localAsn: string | null;
    addressFamily: string;
    prefixLimit: number | null;
    prefixList: string | null;
    routePolicyIn: string | null;
    routePolicyOut: string | null;
    password: string | null;
    description: string | null;
    adminStatus: string;
    deviceId: number | null;
    tenantName: string | null;
    lastPushStatus: string | null;
    lastPushedAt: string | null;
    updatedAt: string;
}

export interface LiveMatch {
    bgpState: string;
    acceptedPrefixes: number;
    advertisedPrefixes: number;
    deviceName: string;
}

interface DeviceOpt { id: number; hostname: string; ipAddress: string; vendor?: string; }
interface TenantOpt { id: string; name: string; }
interface DriftPeer { id: number; peerIp: string; remoteAsn: string; state: string; }

const AF_OPTIONS = [
    { value: 'ipv4-unicast', label: 'IPv4 Unicast' },
    { value: 'ipv6-unicast', label: 'IPv6 Unicast' },
    { value: 'vpnv4', label: 'VPNv4' },
    { value: 'vpnv6', label: 'VPNv6' },
    { value: 'l2vpn-evpn', label: 'L2VPN EVPN' },
];
const AF_LABEL: Record<string, string> = Object.fromEntries(AF_OPTIONS.map(o => [o.value, o.label]));

const STATUS_META: Record<string, { label: string; cls: string; color: string }> = {
    enabled: { label: 'Enabled', cls: 'badge-established', color: '#34d399' },
    disabled: { label: 'Disabled', cls: 'badge-neutral', color: '#94a3b8' },
    shutdown: { label: 'Shutdown', cls: 'badge-down', color: '#fb7185' },
};

export default function BgpPeerManager({
    peers, devices, canManage, liveMap, isSuperAdmin, tenants, activeTenant, driftPeers,
}: {
    peers: BgpPeer[];
    devices: DeviceOpt[];
    canManage: boolean;
    liveMap: Record<string, LiveMatch>;
    isSuperAdmin: boolean;
    tenants: TenantOpt[];
    activeTenant: string | null;
    driftPeers: DriftPeer[];
}) {
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [afFilter, setAfFilter] = useState('all');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<BgpPeer | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<BgpPeer | null>(null);
    const [formError, setFormError] = useState('');
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
    const [isPending, startTransition] = useTransition();
    const [driftDismissed, setDriftDismissed] = useState(false);

    // Push modal state
    const [pushPeer, setPushPeer] = useState<BgpPeer | null>(null);
    const [pushLoading, setPushLoading] = useState(false);
    const [pushApplying, setPushApplying] = useState(false);
    const [pushData, setPushData] = useState<{ config: string; vendor: string; device: any } | null>(null);
    const [pushResult, setPushResult] = useState<{ ok: boolean; text: string } | null>(null);
    const [pushTab, setPushTab] = useState<'config' | 'diff'>('config');
    const [diffData, setDiffData] = useState<{ current: string; generated: string } | null>(null);
    const [diffLoading, setDiffLoading] = useState(false);
    const [attachSel, setAttachSel] = useState<string>('');

    const showTenantCol = isSuperAdmin && !activeTenant;
    const canAdd = canManage && (!isSuperAdmin || !!activeTenant);

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        return peers.filter(p => {
            if (afFilter !== 'all' && p.addressFamily !== afFilter) return false;
            if (!q) return true;
            return (
                p.peerIp.toLowerCase().includes(q) ||
                p.remoteAsn.includes(q) ||
                (p.peerName || '').toLowerCase().includes(q) ||
                (p.description || '').toLowerCase().includes(q)
            );
        });
    }, [peers, search, afFilter]);

    function showToast(msg: string, ok: boolean) {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 3500);
    }

    function openAdd() { setEditing(null); setFormError(''); setModalOpen(true); }
    function openEdit(p: BgpPeer) { setEditing(p); setFormError(''); setModalOpen(true); }

    function handleTenantChange(v: string) {
        const url = v === 'all' ? '/bgp-peers' : `/bgp-peers?tenant=${encodeURIComponent(v)}`;
        startTransition(() => router.push(url));
    }

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setFormError('');
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
            const res = editing ? await updateBgpPeer(formData) : await createBgpPeer(formData);
            if (res.success) {
                setModalOpen(false);
                showToast(editing ? 'BGP peer updated.' : 'BGP peer created.', true);
                router.refresh();
            } else {
                setFormError(res.error || 'Something went wrong.');
            }
        });
    }

    function handleDelete(p: BgpPeer) {
        startTransition(async () => {
            const res = await deleteBgpPeer(p.id);
            setConfirmDelete(null);
            if (res.success) { showToast('BGP peer deleted.', true); router.refresh(); }
            else showToast(res.error || 'Delete failed.', false);
        });
    }

    function handleToggle(p: BgpPeer) {
        const next = p.adminStatus === 'enabled' ? 'disabled' : 'enabled';
        startTransition(async () => {
            const res = await toggleBgpPeerStatus(p.id, next);
            if (res.success) { showToast(`Peer ${next}.`, true); router.refresh(); }
            else showToast(res.error || 'Update failed.', false);
        });
    }

    // ── Push to Router ──
    async function openPush(p: BgpPeer) {
        setPushPeer(p);
        setPushData(null);
        setPushResult(null);
        setPushTab('config');
        setDiffData(null);
        setAttachSel('');
        setPushLoading(true);
        try {
            const res = await fetch('/api/bgp-peers/push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: p.id, mode: 'preview' }),
            });
            const data = await res.json();
            if (res.ok) setPushData({ config: data.config, vendor: data.vendor, device: data.device });
            else setPushResult({ ok: false, text: data.error || 'Failed to generate config.' });
        } catch (e: any) {
            setPushResult({ ok: false, text: e.message });
        }
        setPushLoading(false);
    }

    async function loadDiff() {
        if (!pushPeer || !pushData?.device) return;
        setPushTab('diff');
        if (diffData) return;
        setDiffLoading(true);
        try {
            const res = await fetch('/api/bgp-peers/push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: pushPeer.id, mode: 'diff' }),
            });
            const data = await res.json();
            if (res.ok) setDiffData({ current: data.currentConfig || '', generated: data.config || '' });
            else setPushResult({ ok: false, text: data.error || 'Failed to fetch current config.' });
        } catch (e: any) {
            setPushResult({ ok: false, text: e.message });
        }
        setDiffLoading(false);
    }

    async function handleAttach() {
        if (!pushPeer || !attachSel) return;
        startTransition(async () => {
            const res = await attachDeviceToPeer(pushPeer.id, parseInt(attachSel, 10));
            if (res.success) {
                showToast('Device attached to peer.', true);
                router.refresh();
                // re-open preview with the newly attached device
                openPush({ ...pushPeer, deviceId: parseInt(attachSel, 10) });
            } else {
                showToast(res.error || 'Attach failed.', false);
            }
        });
    }

    async function applyPush() {
        if (!pushPeer) return;
        setPushApplying(true);
        setPushResult(null);
        try {
            const res = await fetch('/api/bgp-peers/push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: pushPeer.id, mode: 'apply' }),
            });
            const data = await res.json();
            if (res.ok) {
                setPushResult({ ok: true, text: data.output || 'Configuration applied successfully.' });
                showToast('Config pushed to router.', true);
                router.refresh();
            } else {
                setPushResult({ ok: false, text: (data.error || 'Push failed') + (data.output ? `\n\n${data.output}` : '') });
                showToast('Push failed — see details.', false);
                router.refresh();
            }
        } catch (e: any) {
            setPushResult({ ok: false, text: e.message });
        }
        setPushApplying(false);
    }

    const colSpan = 7 + (showTenantCol ? 1 : 0);

    return (
        <div className="space-y-5">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg" style={{ color: '#475569' }}>search</span>
                    <input data-testid="bgp-peer-search" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search peer IP, ASN, name…" className="form-input" style={{ paddingLeft: '2.4rem' }} />
                </div>
                <select data-testid="bgp-peer-af-filter" value={afFilter} onChange={e => setAfFilter(e.target.value)}
                    className="form-select" style={{ maxWidth: '11rem' }}>
                    <option value="all">All Address Families</option>
                    {AF_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>

                {isSuperAdmin && (
                    <select data-testid="bgp-tenant-switcher" value={activeTenant || 'all'} onChange={e => handleTenantChange(e.target.value)}
                        className="form-select" style={{ maxWidth: '13rem' }} disabled={isPending}>
                        <option value="all">All Organizations</option>
                        {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                )}

                <div className="flex-1" />
                {canManage && (
                    <button data-testid="add-bgp-peer-btn" onClick={openAdd} disabled={!canAdd} className="btn-primary"
                        title={!canAdd ? 'Select an organization first' : 'Add a BGP peer'}>
                        <span className="material-symbols-outlined text-base">add</span>
                        Add BGP Peer
                    </button>
                )}
            </div>

            {isSuperAdmin && !activeTenant && (
                <div className="text-xs px-4 py-2 rounded-lg" data-testid="tenant-hint"
                    style={{ backgroundColor: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}>
                    Viewing peers across all organizations. Select a specific organization above to add new peers.
                </div>
            )}

            {/* Config Drift Alerts */}
            {driftPeers.length > 0 && !driftDismissed && (
                <div className="rounded-xl p-4 animate-rise" data-testid="drift-alert-banner"
                    style={{ backgroundColor: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.3)' }}>
                    <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined alert-pulse" style={{ color: '#fb7185' }}>warning</span>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm" style={{ color: '#fb7185' }}>
                                Config Drift Detected — {driftPeers.length} peer{driftPeers.length !== 1 ? 's' : ''} enabled but not Established
                            </p>
                            <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
                                {driftPeers.map(d => (
                                    <span key={d.id} className="inline-flex items-center gap-1 mr-3">
                                        <span className="font-mono text-white">{d.peerIp}</span>
                                        <span className="chip" style={{ padding: '0 0.4rem' }}>AS{d.remoteAsn}</span>
                                        <span style={{ color: '#fb7185' }}>{d.state}</span>
                                    </span>
                                ))}
                            </p>
                        </div>
                        <button onClick={() => setDriftDismissed(true)} className="btn-ghost p-1" data-testid="dismiss-drift" aria-label="Dismiss">
                            <span className="material-symbols-outlined text-base">close</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="card overflow-hidden">
                <div className="overflow-x-auto" role="region" aria-label="BGP peers table" tabIndex={0}>
                    <table className="w-full data-table" data-testid="bgp-peers-table">
                        <thead>
                            <tr>
                                {showTenantCol && <th>Organization</th>}
                                <th>Neighbor / Peer</th>
                                <th>Remote AS</th>
                                <th>Address Family</th>
                                <th>Route Policy (in / out)</th>
                                <th>Config Status</th>
                                <th>Live Match</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={colSpan} style={{ textAlign: 'center', padding: '3.5rem' }}>
                                        <span className="material-symbols-outlined text-4xl block mb-3" style={{ color: '#334155' }}>lan</span>
                                        <p className="font-medium text-white mb-1">No BGP peers configured</p>
                                        <p className="text-xs" style={{ color: '#475569' }}>
                                            {canAdd ? 'Click “Add BGP Peer” to define your first neighbor.' : 'Nothing to show for this scope.'}
                                        </p>
                                    </td>
                                </tr>
                            ) : filtered.map(p => {
                                const st = STATUS_META[p.adminStatus] || STATUS_META.enabled;
                                const live = liveMap[p.peerIp];
                                const liveUp = live?.bgpState === 'Established';
                                const drift = p.adminStatus === 'enabled' && live && !liveUp;
                                return (
                                    <tr key={p.id} data-testid={`bgp-peer-row-${p.id}`}>
                                        {showTenantCol && (
                                            <td><span className="text-xs" style={{ color: '#a5b4c8' }}>{p.tenantName || '—'}</span></td>
                                        )}
                                        <td>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-bold text-white text-sm font-mono">{p.peerIp}</span>
                                                {p.peerName && <span className="text-xs" style={{ color: '#94a3b8' }}>{p.peerName}</span>}
                                                {p.description && <span className="text-[11px]" style={{ color: '#64748b' }}>{p.description}</span>}
                                            </div>
                                        </td>
                                        <td><span className="chip">AS{p.remoteAsn}</span></td>
                                        <td><span className="text-xs" style={{ color: '#a5b4c8' }}>{AF_LABEL[p.addressFamily] || p.addressFamily}</span></td>
                                        <td>
                                            <div className="flex flex-col gap-1 text-[11px] font-mono">
                                                <span style={{ color: p.routePolicyIn ? '#34d399' : '#475569' }}>↓ {p.routePolicyIn || '—'}</span>
                                                <span style={{ color: p.routePolicyOut ? '#22d3ee' : '#475569' }}>↑ {p.routePolicyOut || '—'}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex flex-col gap-1">
                                                <span className={st.cls}><span className="dot" style={{ backgroundColor: st.color }} />{st.label}</span>
                                                {p.lastPushStatus && (
                                                    <span className="text-[10px] font-mono flex items-center gap-1"
                                                        style={{ color: p.lastPushStatus === 'success' ? '#34d399' : '#fb7185' }}
                                                        data-testid={`push-status-${p.id}`}>
                                                        <span className="material-symbols-outlined text-[13px]">{p.lastPushStatus === 'success' ? 'cloud_done' : 'cloud_off'}</span>
                                                        {p.lastPushStatus === 'success' ? 'Pushed' : 'Push failed'}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td data-testid={`live-match-${p.id}`}>
                                            {!live ? (
                                                <span className="badge-neutral"><span className="dot" style={{ backgroundColor: '#64748b' }} />Not monitored</span>
                                            ) : liveUp ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="badge-established"><span className="dot" style={{ backgroundColor: '#34d399' }} />Established</span>
                                                    <span className="text-[10px] font-mono" style={{ color: '#64748b' }}>{live.acceptedPrefixes.toLocaleString()} pfx · {live.deviceName}</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="badge-down"><span className="dot" style={{ backgroundColor: '#fb7185' }} />{live.bgpState || 'Down'}</span>
                                                    {drift && <span className="text-[10px]" style={{ color: '#fbbf24' }}>⚠ config drift</span>}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div className="flex items-center justify-end gap-2">
                                                {canManage && (
                                                    <>
                                                        <button data-testid={`push-bgp-peer-${p.id}`} onClick={() => openPush(p)} className="btn-ghost text-xs"
                                                            title="Preview & push config to router">
                                                            <span className="material-symbols-outlined text-sm">cloud_upload</span>
                                                            Push
                                                        </button>
                                                        <button data-testid={`toggle-bgp-peer-${p.id}`} onClick={() => handleToggle(p)} className="btn-ghost text-xs"
                                                            title={p.adminStatus === 'enabled' ? 'Disable peer' : 'Enable peer'}>
                                                            <span className="material-symbols-outlined text-sm">{p.adminStatus === 'enabled' ? 'toggle_on' : 'toggle_off'}</span>
                                                        </button>
                                                        <button data-testid={`edit-bgp-peer-${p.id}`} onClick={() => openEdit(p)} className="btn-ghost text-xs">
                                                            <span className="material-symbols-outlined text-sm">edit</span>
                                                        </button>
                                                        <button data-testid={`delete-bgp-peer-${p.id}`} onClick={() => setConfirmDelete(p)} className="btn-danger">
                                                            <span className="material-symbols-outlined text-sm">delete</span>
                                                        </button>
                                                    </>
                                                )}
                                                {!canManage && <span className="text-xs" style={{ color: '#475569' }}>Read-only</span>}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="px-5 py-3 border-t text-xs" style={{ borderColor: 'var(--color-border)', color: '#64748b' }}>
                    Showing {filtered.length} of {peers.length} configured peer{peers.length !== 1 ? 's' : ''}
                </div>
            </div>

            {/* Add / Edit Modal */}
            {modalOpen && (
                <div className="modal-backdrop" onClick={() => !isPending && setModalOpen(false)}>
                    <div className="modal-panel" onClick={e => e.stopPropagation()} data-testid="bgp-peer-modal">
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                            <div>
                                <h3 className="font-bold text-white text-lg">{editing ? 'Edit BGP Peer' : 'Add BGP Peer'}</h3>
                                <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>Define neighbor, ASN, prefixes and route policies.</p>
                            </div>
                            <button onClick={() => setModalOpen(false)} className="btn-ghost p-1.5" aria-label="Close">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5" data-testid="bgp-peer-form">
                            {editing && <input type="hidden" name="id" value={editing.id} />}
                            {isSuperAdmin && activeTenant && <input type="hidden" name="tenantId" value={activeTenant} />}

                            {formError && (
                                <div className="p-3 rounded-lg text-sm font-medium" data-testid="bgp-peer-form-error"
                                    style={{ backgroundColor: 'rgba(251,113,133,0.1)', color: '#fb7185', border: '1px solid rgba(251,113,133,0.25)' }}>
                                    {formError}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Neighbor / Peer IP <span style={{ color: '#fb7185' }}>*</span></label>
                                    <input data-testid="field-peerIp" name="peerIp" defaultValue={editing?.peerIp || ''} placeholder="203.0.113.1" className="form-input" required />
                                </div>
                                <div>
                                    <label className="form-label">Peer Name / Neighbor</label>
                                    <input data-testid="field-peerName" name="peerName" defaultValue={editing?.peerName || ''} placeholder="upstream-telco-1" className="form-input" />
                                </div>
                                <div>
                                    <label className="form-label">Remote AS Number <span style={{ color: '#fb7185' }}>*</span></label>
                                    <input data-testid="field-remoteAsn" name="remoteAsn" defaultValue={editing?.remoteAsn || ''} placeholder="64512" className="form-input" required />
                                </div>
                                <div>
                                    <label className="form-label">Local AS Number</label>
                                    <input data-testid="field-localAsn" name="localAsn" defaultValue={editing?.localAsn || ''} placeholder="65000" className="form-input" />
                                </div>
                                <div>
                                    <label className="form-label">Address Family</label>
                                    <select data-testid="field-addressFamily" name="addressFamily" defaultValue={editing?.addressFamily || 'ipv4-unicast'} className="form-select">
                                        {AF_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Prefix Limit</label>
                                    <input data-testid="field-prefixLimit" name="prefixLimit" defaultValue={editing?.prefixLimit ?? ''} placeholder="1000" className="form-input" />
                                </div>
                                <div>
                                    <label className="form-label">Route Policy In</label>
                                    <input data-testid="field-routePolicyIn" name="routePolicyIn" defaultValue={editing?.routePolicyIn || ''} placeholder="RM-IMPORT-CUSTOMER" className="form-input" />
                                </div>
                                <div>
                                    <label className="form-label">Route Policy Out</label>
                                    <input data-testid="field-routePolicyOut" name="routePolicyOut" defaultValue={editing?.routePolicyOut || ''} placeholder="RM-EXPORT-DEFAULT" className="form-input" />
                                </div>
                                <div>
                                    <label className="form-label">Attached Device</label>
                                    <select data-testid="field-deviceId" name="deviceId" defaultValue={editing?.deviceId ?? ''} className="form-select">
                                        <option value="">— None —</option>
                                        {devices.map(d => <option key={d.id} value={d.id}>{d.hostname} ({d.ipAddress})</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Admin Status</label>
                                    <select data-testid="field-adminStatus" name="adminStatus" defaultValue={editing?.adminStatus || 'enabled'} className="form-select">
                                        <option value="enabled">Enabled</option>
                                        <option value="disabled">Disabled</option>
                                        <option value="shutdown">Shutdown</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">MD5 / Auth Password</label>
                                    <input data-testid="field-password" name="password" type="password" defaultValue={editing?.password || ''} placeholder="••••••••" className="form-input" />
                                </div>
                            </div>

                            <div>
                                <label className="form-label">Announced Prefixes</label>
                                <textarea data-testid="field-prefixList" name="prefixList" defaultValue={editing?.prefixList || ''} placeholder="203.0.113.0/24&#10;198.51.100.0/24" className="form-textarea" />
                                <p className="text-[11px] mt-1" style={{ color: '#475569' }}>One prefix per line, or comma-separated.</p>
                            </div>

                            <div>
                                <label className="form-label">Description</label>
                                <input data-testid="field-description" name="description" defaultValue={editing?.description || ''} placeholder="Primary transit provider — 10G port" className="form-input" />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost">Cancel</button>
                                <button type="submit" disabled={isPending} className="btn-primary" data-testid="submit-bgp-peer">
                                    {isPending ? 'Saving…' : editing ? 'Save Changes' : 'Create Peer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Push to Router Modal */}
            {pushPeer && (
                <div className="modal-backdrop" onClick={() => !pushApplying && setPushPeer(null)}>
                    <div className="modal-panel" style={{ maxWidth: '48rem' }} onClick={e => e.stopPropagation()} data-testid="push-modal">
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(34,211,238,0.12)', color: '#22d3ee' }}>
                                    <span className="material-symbols-outlined">cloud_upload</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-lg">Push to Router</h3>
                                    <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                                        Peer <span className="font-mono text-white">{pushPeer.peerIp}</span> · AS{pushPeer.remoteAsn}
                                        {pushData?.device ? <> · {pushData.device.hostname} ({pushData.vendor})</> : <> · no device attached</>}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setPushPeer(null)} className="btn-ghost p-1.5" aria-label="Close">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {pushLoading && (
                                <div className="flex flex-col items-center justify-center py-10 gap-3">
                                    <span className="material-symbols-outlined animate-spin text-2xl" style={{ color: '#22d3ee' }}>progress_activity</span>
                                    <p className="text-sm" style={{ color: '#94a3b8' }}>Generating vendor config…</p>
                                </div>
                            )}

                            {pushData && (
                                <>
                                    {/* Attach-device inline (when no device) */}
                                    {!pushData.device && (
                                        <div className="rounded-lg p-4 flex flex-col sm:flex-row sm:items-end gap-3" data-testid="attach-device-panel"
                                            style={{ backgroundColor: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
                                            <div className="flex-1">
                                                <label className="form-label" style={{ color: '#fbbf24' }}>Attach a device to enable SSH push</label>
                                                <select data-testid="attach-device-select" value={attachSel} onChange={e => setAttachSel(e.target.value)} className="form-select">
                                                    <option value="">— Select device —</option>
                                                    {devices.map(d => <option key={d.id} value={d.id}>{d.hostname} ({d.ipAddress}) · {d.vendor}</option>)}
                                                </select>
                                            </div>
                                            <button data-testid="attach-device-btn" onClick={handleAttach} disabled={!attachSel || isPending} className="btn-primary">
                                                <span className="material-symbols-outlined text-base">link</span>
                                                Attach
                                            </button>
                                        </div>
                                    )}

                                    {/* Tabs */}
                                    <div className="flex items-center gap-2">
                                        <button data-testid="push-tab-config" onClick={() => setPushTab('config')} className="btn-ghost text-xs"
                                            style={pushTab === 'config' ? { borderColor: '#22d3ee', color: '#22d3ee' } : {}}>
                                            Generated Config
                                        </button>
                                        <button data-testid="push-tab-diff" onClick={loadDiff} disabled={!pushData.device} className="btn-ghost text-xs"
                                            style={pushTab === 'diff' ? { borderColor: '#22d3ee', color: '#22d3ee' } : {}}
                                            title={!pushData.device ? 'Attach a device to diff against the router' : 'Diff against running config'}>
                                            Diff vs Router
                                        </button>
                                    </div>

                                    {pushTab === 'config' && (
                                        <div>
                                            <p className="form-label">Generated {pushData.vendor.toUpperCase()} configuration</p>
                                            <pre data-testid="push-config-preview" style={{
                                                backgroundColor: 'rgba(0,0,0,0.55)', color: '#a5f3fc', fontFamily: 'ui-monospace, monospace',
                                                fontSize: '0.75rem', lineHeight: 1.6, padding: '1rem', borderRadius: '0.7rem',
                                                overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                                border: '1px solid var(--color-border)', maxHeight: '18rem',
                                            }}>{pushData.config}</pre>
                                        </div>
                                    )}

                                    {pushTab === 'diff' && (
                                        <div data-testid="push-diff-view">
                                            {diffLoading ? (
                                                <div className="flex items-center gap-2 py-8 justify-center" style={{ color: '#94a3b8' }}>
                                                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                                    Fetching running config from router…
                                                </div>
                                            ) : diffData ? (
                                                <div className="rounded-lg overflow-hidden text-xs" style={{ border: '1px solid var(--color-border)', maxHeight: '20rem', overflowY: 'auto' }}>
                                                    <ReactDiffViewer
                                                        oldValue={diffData.current || '(empty — peer not configured on router)'}
                                                        newValue={diffData.generated}
                                                        splitView={false}
                                                        useDarkTheme
                                                        hideLineNumbers
                                                        leftTitle="On Router (current)"
                                                        rightTitle="Generated (to push)"
                                                    />
                                                </div>
                                            ) : (
                                                <p className="text-xs py-6 text-center" style={{ color: '#64748b' }}>No diff loaded.</p>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}

                            {pushResult && (
                                <div className="rounded-lg p-4" data-testid="push-result"
                                    style={{ backgroundColor: pushResult.ok ? 'rgba(52,211,153,0.08)' : 'rgba(251,113,133,0.08)', border: `1px solid ${pushResult.ok ? 'rgba(52,211,153,0.25)' : 'rgba(251,113,133,0.25)'}` }}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="material-symbols-outlined text-lg" style={{ color: pushResult.ok ? '#34d399' : '#fb7185' }}>{pushResult.ok ? 'check_circle' : 'error'}</span>
                                        <p className="font-bold" style={{ color: pushResult.ok ? '#34d399' : '#fb7185' }}>{pushResult.ok ? 'Applied to router' : 'Push failed'}</p>
                                    </div>
                                    <pre style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.72rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '12rem', overflowY: 'auto' }}>{pushResult.text}</pre>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                            <button onClick={() => setPushPeer(null)} className="btn-ghost">Close</button>
                            <button data-testid="apply-push-btn" onClick={applyPush} disabled={pushApplying || pushLoading || !pushData?.device} className="btn-primary"
                                title={!pushData?.device ? 'Attach a device to enable push' : 'Push config over SSH'}>
                                <span className="material-symbols-outlined text-base">{pushApplying ? 'progress_activity' : 'terminal'}</span>
                                {pushApplying ? 'Pushing…' : 'Push via SSH'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete confirm */}
            {confirmDelete && (
                <div className="modal-backdrop" onClick={() => !isPending && setConfirmDelete(null)}>
                    <div className="modal-panel" style={{ maxWidth: '26rem' }} onClick={e => e.stopPropagation()} data-testid="delete-confirm-modal">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(251,113,133,0.12)', color: '#fb7185' }}>
                                    <span className="material-symbols-outlined">warning</span>
                                </div>
                                <h3 className="font-bold text-white text-lg">Delete BGP Peer?</h3>
                            </div>
                            <p className="text-sm mb-5" style={{ color: '#94a3b8' }}>
                                This will permanently remove peer <span className="font-mono text-white">{confirmDelete.peerIp}</span> (AS{confirmDelete.remoteAsn}). This action cannot be undone.
                            </p>
                            <div className="flex items-center justify-end gap-3">
                                <button onClick={() => setConfirmDelete(null)} className="btn-ghost">Cancel</button>
                                <button onClick={() => handleDelete(confirmDelete)} disabled={isPending} data-testid="confirm-delete-btn"
                                    className="btn-primary" style={{ background: 'linear-gradient(135deg,#fb7185,#e11d48)', color: 'white' }}>
                                    {isPending ? 'Deleting…' : 'Delete Peer'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-[70] px-4 py-3 rounded-xl text-sm font-medium glass animate-rise" data-testid="bgp-toast"
                    style={{ color: toast.ok ? '#34d399' : '#fb7185', borderColor: toast.ok ? 'rgba(52,211,153,0.3)' : 'rgba(251,113,133,0.3)' }}>
                    <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-base">{toast.ok ? 'check_circle' : 'error'}</span>
                        {toast.msg}
                    </span>
                </div>
            )}
        </div>
    );
}
