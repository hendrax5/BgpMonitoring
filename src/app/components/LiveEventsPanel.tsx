'use client';

import { useState, useEffect } from 'react';

type BgpEventLog = {
    timestamp: string;
    peerIp: string;
    eventType: 'UP' | 'DOWN' | 'INFO';
    message: string;
};

type DeviceEvents = {
    deviceName: string;
    deviceIp: string;
    vendor: string;
    events: BgpEventLog[];
    error?: string;
};

type Props = {
    devices: { id: number; hostname: string; ipAddress: string; vendor: string }[];
};

export default function LiveEventsPanel({ devices }: Props) {
    const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(devices[0]?.id ?? null);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<DeviceEvents | null>(null);
    const [lastFetched, setLastFetched] = useState<string | null>(null);

    async function fetchEvents(deviceId: number) {
        setLoading(true);
        try {
            const res = await fetch(`/api/device-events/${deviceId}`, { cache: 'no-store' });
            const json = await res.json();
            setData(json);
            setLastFetched(new Date().toLocaleTimeString());
        } catch {
            setData(null);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (selectedDeviceId) fetchEvents(selectedDeviceId);
    }, [selectedDeviceId]);

    const selectedDevice = devices.find(d => d.id === selectedDeviceId);

    return (
        <div>
            {/* Device Selector */}
            <div className="px-4 py-3 border-b flex items-center justify-between gap-3" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-2 flex-wrap">
                    {devices.map(d => (
                        <button
                            key={d.id}
                            onClick={() => setSelectedDeviceId(d.id)}
                            className="text-xs px-3 py-1 rounded-lg transition-all font-medium"
                            style={{
                                backgroundColor: selectedDeviceId === d.id ? 'rgba(19,164,236,0.15)' : 'rgba(255,255,255,0.04)',
                                color: selectedDeviceId === d.id ? '#13a4ec' : '#64748b',
                                border: '1px solid',
                                borderColor: selectedDeviceId === d.id ? 'rgba(19,164,236,0.3)' : 'rgba(255,255,255,0.06)',
                            }}
                        >
                            {d.hostname}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    {lastFetched && <span className="text-[10px]" style={{ color: '#475569' }}>Updated: {lastFetched}</span>}
                    <button
                        onClick={() => selectedDeviceId && fetchEvents(selectedDeviceId)}
                        disabled={loading}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                        style={{
                            backgroundColor: 'rgba(19,164,236,0.08)',
                            color: '#13a4ec',
                            border: '1px solid rgba(19,164,236,0.2)',
                            opacity: loading ? 0.5 : 1
                        }}
                    >
                        <span className="material-symbols-outlined text-sm">{loading ? 'hourglass_empty' : 'refresh'}</span>
                    </button>
                </div>
            </div>

            {/* Events List */}
            <div className="divide-y divide-white/[0.05]">
                {loading ? (
                    <div className="p-6 text-center">
                        <span className="material-symbols-outlined text-2xl block mb-2 animate-spin" style={{ color: '#13a4ec' }}>hourglass_empty</span>
                        <p className="text-xs" style={{ color: '#475569' }}>Fetching logs from {selectedDevice?.hostname}...</p>
                    </div>
                ) : data?.error ? (
                    <div className="p-5 flex items-center gap-3">
                        <span className="material-symbols-outlined text-lg" style={{ color: '#f59e0b' }}>warning</span>
                        <div>
                            <p className="text-xs font-medium text-white">Cannot fetch SSH logs</p>
                            <p className="text-[10px] mt-0.5" style={{ color: '#64748b' }}>{data.error}</p>
                        </div>
                    </div>
                ) : !data || data.events.length === 0 ? (
                    <div className="p-6 text-center">
                        <span className="material-symbols-outlined text-3xl block mb-2" style={{ color: '#334155' }}>info</span>
                        <p className="text-sm text-white mb-1">No recent BGP log entries</p>
                        <p className="text-xs" style={{ color: '#475569' }}>The device may not have recent BGP events or the log command may differ.</p>
                    </div>
                ) : (
                    data.events.slice().reverse().map((event, i) => (
                        <div key={i} className="px-4 py-2.5 flex items-start gap-3 hover:bg-white/[0.02] transition-colors">
                            <div className="flex-shrink-0 mt-0.5">
                                <span
                                    className="w-2 h-2 rounded-full inline-block"
                                    style={{
                                        backgroundColor:
                                            event.eventType === 'UP' ? '#10b981' :
                                            event.eventType === 'DOWN' ? '#f43f5e' : '#64748b'
                                    }}
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                    {event.peerIp && (
                                        <code className="text-[10px] font-mono" style={{ color: '#94a3b8' }}>{event.peerIp}</code>
                                    )}
                                    <span
                                        className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase"
                                        style={{
                                            backgroundColor:
                                                event.eventType === 'UP' ? 'rgba(16,185,129,0.15)' :
                                                event.eventType === 'DOWN' ? 'rgba(244,63,94,0.15)' : 'rgba(255,255,255,0.06)',
                                            color:
                                                event.eventType === 'UP' ? '#10b981' :
                                                event.eventType === 'DOWN' ? '#f43f5e' : '#64748b',
                                        }}
                                    >
                                        {event.eventType}
                                    </span>
                                </div>
                                <p className="text-[11px] truncate" style={{ color: '#94a3b8' }} title={event.message}>
                                    {event.message}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
