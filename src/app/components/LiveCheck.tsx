'use client';

import { useState } from 'react';

interface LiveCheckProps {
    deviceIp: string;
    peerIp: string;
}

type CheckType = 'bgp-status' | 'received-routes' | 'advertised-routes' | 'ping' | 'logs';

const CHECKS: { id: CheckType; label: string; icon: string; description: string; color: string }[] = [
    { id: 'bgp-status',        label: 'BGP Detail',        icon: 'hub',          description: 'Full BGP neighbor status & timers', color: '#13a4ec' },
    { id: 'received-routes',   label: 'Received Prefixes', icon: 'download',     description: 'Prefixes received from this peer',   color: '#10b981' },
    { id: 'advertised-routes', label: 'Advertised Routes', icon: 'upload',       description: 'Prefixes we send to this peer',      color: '#f59e0b' },
    { id: 'ping',              label: 'Ping',              icon: 'network_ping', description: 'ICMP connectivity test × 5',         color: '#06b6d4' },
    { id: 'logs',              label: 'BGP Logs',          icon: 'receipt_long', description: 'Syslog filtered by peer IP',         color: '#a855f7' },
];

interface ModalState {
    open: boolean;
    check: (typeof CHECKS)[0] | null;
    loading: boolean;
    output: string | null;
    command: string;
    error: string | null;
    noCredentials: boolean;
}

export default function LiveCheck({ deviceIp, peerIp }: LiveCheckProps) {
    const [expanded, setExpanded] = useState(false);
    const [modal, setModal] = useState<ModalState>({
        open: false, check: null, loading: false,
        output: null, command: '', error: null, noCredentials: false,
    });

    const openModal = async (check: (typeof CHECKS)[0]) => {
        setModal({ open: true, check, loading: true, output: null, command: '', error: null, noCredentials: false });

        try {
            const res = await fetch('/api/live-check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceIp, peerIp, checkType: check.id }),
            });
            const data = await res.json();
            if (!res.ok) {
                setModal(m => ({ ...m, loading: false, error: data.error || 'Unknown error', noCredentials: !!data.noCredentials }));
            } else {
                setModal(m => ({ ...m, loading: false, output: data.output, command: data.command }));
            }
        } catch (e: any) {
            setModal(m => ({ ...m, loading: false, error: e.message }));
        }
    };

    const closeModal = () => setModal(m => ({ ...m, open: false }));

    return (
        <>
            {/* Live Check Card */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)', backgroundColor: '#0d1520' }}>
                <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-xl" style={{ color: '#13a4ec' }}>terminal</span>
                        <div>
                            <h3 className="font-bold text-white">Live SSH Diagnostics</h3>
                            <p className="text-[10px]" style={{ color: '#475569' }}>
                                Device: <span className="font-mono text-white">{deviceIp}</span>
                                {' · '}Peer: <span className="font-mono" style={{ color: '#13a4ec' }}>{peerIp}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setExpanded(e => !e)}
                        className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg transition-all"
                        style={{ backgroundColor: expanded ? 'rgba(255,255,255,0.06)' : '#13a4ec', color: expanded ? '#94a3b8' : 'white' }}
                    >
                        <span className="material-symbols-outlined text-sm">{expanded ? 'close' : 'play_arrow'}</span>
                        {expanded ? 'Close' : 'Run Live Check'}
                    </button>
                </div>

                {/* Command buttons — visible after clicking Run */}
                {expanded && (
                    <div className="px-5 pb-5 border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#475569' }}>
                            Select a diagnostic command to run:
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {CHECKS.map(check => (
                                <button
                                    key={check.id}
                                    onClick={() => openModal(check)}
                                    className="flex items-center gap-2 px-3 py-3 rounded-lg text-left transition-all group"
                                    style={{
                                        backgroundColor: 'rgba(255,255,255,0.03)',
                                        border: `1px solid rgba(255,255,255,0.07)`,
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.borderColor = `${check.color}50`)}
                                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
                                >
                                    <span className="material-symbols-outlined text-xl flex-shrink-0 transition-colors"
                                        style={{ color: check.color }}>{check.icon}</span>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-white truncate">{check.label}</p>
                                        <p className="text-[10px] leading-tight truncate" style={{ color: '#475569' }}>{check.description}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal */}
            {modal.open && modal.check && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
                    onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
                >
                    <div className="w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl"
                        style={{ backgroundColor: '#0d1520', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>

                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
                            style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg" style={{ backgroundColor: `${modal.check.color}15` }}>
                                    <span className="material-symbols-outlined text-xl" style={{ color: modal.check.color }}>{modal.check.icon}</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">{modal.check.label}</h3>
                                    <p className="text-xs" style={{ color: '#475569' }}>
                                        {deviceIp} → peer <span className="font-mono" style={{ color: modal.check.color }}>{peerIp}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {!modal.loading && !modal.error && (
                                    <button onClick={() => openModal(modal.check!)}
                                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg"
                                        style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                                        <span className="material-symbols-outlined text-sm">refresh</span>
                                        Re-run
                                    </button>
                                )}
                                <button onClick={closeModal}
                                    className="p-1.5 rounded-lg transition-colors"
                                    style={{ color: '#475569' }}>
                                    <span className="material-symbols-outlined text-xl">close</span>
                                </button>
                            </div>
                        </div>

                        {/* Modal body */}
                        <div className="p-6 overflow-y-auto flex-1">
                            {modal.loading && (
                                <div className="flex flex-col items-center justify-center py-16 gap-4">
                                    <div className="animate-spin rounded-full w-10 h-10 border-2"
                                        style={{ borderColor: `${modal.check.color}30`, borderTopColor: modal.check.color }} />
                                    <p className="text-sm font-medium text-white">Connecting to {deviceIp}…</p>
                                    <p className="text-xs" style={{ color: '#475569' }}>Running {modal.check.label}</p>
                                </div>
                            )}

                            {modal.error && (
                                <div className="rounded-xl px-5 py-4" style={{ backgroundColor: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="material-symbols-outlined text-lg" style={{ color: '#f43f5e' }}>error</span>
                                        <p className="font-bold" style={{ color: '#f43f5e' }}>Command Failed</p>
                                    </div>
                                    <p className="text-sm" style={{ color: '#94a3b8' }}>{modal.error}</p>
                                    {modal.noCredentials && (
                                        <a href="/settings/devices"
                                            className="inline-flex items-center gap-1 text-xs mt-3 font-bold px-3 py-1.5 rounded-lg"
                                            style={{ backgroundColor: 'rgba(19,164,236,0.12)', color: '#13a4ec' }}>
                                            <span className="material-symbols-outlined text-sm">settings</span>
                                            Configure SSH in Settings → Device Credentials
                                        </a>
                                    )}
                                </div>
                            )}

                            {modal.output !== null && !modal.loading && (
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <code className="text-xs px-3 py-1.5 rounded-lg font-mono"
                                            style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#64748b' }}>
                                            $ {modal.command}
                                        </code>
                                        <span className="flex items-center gap-1.5 text-xs" style={{ color: '#10b981' }}>
                                            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#10b981' }} />
                                            Connected · {new Date().toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <pre
                                        style={{
                                            backgroundColor: 'rgba(0,0,0,0.5)',
                                            color: '#94a3b8',
                                            fontFamily: 'monospace',
                                            fontSize: '0.75rem',
                                            lineHeight: '1.6',
                                            padding: '1.25rem',
                                            borderRadius: '0.75rem',
                                            overflowX: 'auto',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            border: '1px solid rgba(255,255,255,0.05)',
                                        }}
                                    >
                                        {modal.output || '(no output)'}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
