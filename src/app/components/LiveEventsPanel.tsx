'use client';

import { useState, useEffect } from 'react';

type LiveSessionOutput = {
    deviceName: string;
    deviceId: number;
    vendor: string;
    output?: string;
    message?: string; // fallback
};

type Props = {
    devices: { id: number; hostname: string; ipAddress: string; vendor: string }[];
};

export default function LiveEventsPanel({ devices }: Props) {
    // null = All Devices (default), number = specific deviceId
    const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [events, setEvents] = useState<LiveSessionOutput[]>([]);
    const [lastFetched, setLastFetched] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function fetchEvents(deviceId: number | null) {
        setLoading(true);
        setError(null);
        try {
            const url = deviceId === null
                ? '/api/device-events/all'
                : `/api/device-events/${deviceId}`;
            const res = await fetch(url, { cache: 'no-store' });
            const json = await res.json();

            if (deviceId === null) {
                // All: json.events already has deviceName
                setEvents(json.events || []);
            } else {
                // Single device: add deviceName from local devices list
                const device = devices.find(d => d.id === deviceId);
                const evs = (json.events || []).map((e: LiveSessionOutput) => ({
                    ...e,
                    deviceName: device?.hostname || '',
                }));
                setEvents(evs);
            }
            if (json.error) setError(json.error);
            setLastFetched(new Date().toLocaleTimeString());
        } catch {
            setError('Request failed');
        } finally {
            setLoading(false);
        }
    }

    // Auto-fetch on mount and when device selection changes
    useEffect(() => {
        if (devices.length > 0) fetchEvents(selectedDeviceId);
    }, [selectedDeviceId]);

    const displayed = events; // already filtered by API

    return (
        <div>
            {/* Device Filter Tabs */}
            <div className="px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap"
                style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* All Devices tab */}
                    <button
                        onClick={() => setSelectedDeviceId(null)}
                        className="text-xs px-3 py-1 rounded-lg transition-all font-medium"
                        style={{
                            backgroundColor: selectedDeviceId === null ? 'rgba(19,164,236,0.15)' : 'rgba(255,255,255,0.04)',
                            color: selectedDeviceId === null ? '#13a4ec' : '#64748b',
                            border: '1px solid',
                            borderColor: selectedDeviceId === null ? 'rgba(19,164,236,0.3)' : 'rgba(255,255,255,0.06)',
                        }}
                    >
                        All Devices
                    </button>
                    {/* Per-device tabs */}
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
                        onClick={() => fetchEvents(selectedDeviceId)}
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
                        <span className="material-symbols-outlined text-2xl block mb-2 animate-spin" style={{ color: '#13a4ec' }}>
                            hourglass_empty
                        </span>
                        <p className="text-xs" style={{ color: '#475569' }}>
                            {selectedDeviceId === null ? 'Fetching live BGP status from all devices...' : 'Fetching live BGP status...'}
                        </p>
                    </div>
                ) : error && displayed.length === 0 ? (
                    <div className="p-5 flex items-center gap-3">
                        <span className="material-symbols-outlined text-lg" style={{ color: '#f59e0b' }}>warning</span>
                        <div>
                            <p className="text-xs font-medium text-white">Cannot fetch SSH live sessions</p>
                            <p className="text-[10px] mt-0.5" style={{ color: '#64748b' }}>{error}</p>
                        </div>
                    </div>
                ) : displayed.length === 0 ? (
                    <div className="p-6 text-center">
                        <span className="material-symbols-outlined text-3xl block mb-2" style={{ color: '#334155' }}>info</span>
                        <p className="text-sm text-white mb-1">No live session data</p>
                        <p className="text-xs" style={{ color: '#475569' }}>
                            Select a device to test its live SSH connection.
                        </p>
                    </div>
                ) : (
                    <div className="p-4 space-y-6">
                        {displayed.map((event, i) => (
                            <div key={i}>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{ backgroundColor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' }}>
                                        {event.deviceName} <span style={{ color: '#64748b' }}>({event.vendor})</span>
                                    </span>
                                </div>
                                <pre className="text-[11px] font-mono whitespace-pre-wrap overflow-x-auto p-3 rounded" style={{ backgroundColor: '#0f172a', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.05)', maxHeight: '400px', overflowY: 'auto' }}>
                                    {event.output || event.message || "No output returned"}
                                </pre>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
